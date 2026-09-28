import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { createPool } from "mysql2/promise";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";

type CredentialRow = RowDataPacket & {
  email: string;
  open_id: string;
  salt: string;
  password_hash: string;
};

type AdminRow = RowDataPacket & {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin" | "superadmin";
};

let pool: ReturnType<typeof createPool> | null = null;
let tableReady: Promise<void> | null = null;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured");
  if (!pool) pool = createPool(process.env.DATABASE_URL);
  return pool;
}

async function ensureCredentialTable() {
  if (!tableReady) {
    tableReady = getPool()
      .query(`CREATE TABLE IF NOT EXISTS admin_panel_credentials (
        singleton_id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
        email VARCHAR(320) NOT NULL,
        open_id VARCHAR(64) NOT NULL,
        salt CHAR(32) NOT NULL,
        password_hash CHAR(128) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      .then(() => undefined)
      .catch(error => {
        tableReady = null;
        throw error;
      });
  }
  await tableReady;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizedCredentials(body: unknown) {
  const value = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const password = typeof value.password === "string" ? value.password : "";
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (password.length < 8 || password.length > 1024) return null;
  return { email, password };
}

function hashPassword(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

function stableOpenId(email: string) {
  return `admin-password:${createHash("sha256").update(email).digest("hex").slice(0, 32)}`;
}

function clientAddress(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function loginRateLimited(req: Request, res: Response) {
  const key = clientAddress(req);
  const now = Date.now();
  let record = loginAttempts.get(key);
  if (!record || record.resetAt <= now) {
    record = { count: 0, resetAt: now + RATE_WINDOW_MS };
    loginAttempts.set(key, record);
  }
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil((record.resetAt - now) / 1000))));
    res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    return true;
  }
  record.count += 1;
  return false;
}

function normalizedEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function bootstrapAdmin(req: Request, res: Response) {
  const configuredKey = process.env.ADMIN_PANEL_BOOTSTRAP_KEY;
  const suppliedKey = req.get("x-admin-bootstrap-key") || "";
  if (!configuredKey || !safeEqual(suppliedKey, configuredKey)) {
    res.status(403).json({ error: "Acesso de configuração negado." });
    return;
  }

  const credentials = normalizedCredentials(req.body);
  if (!credentials) {
    res.status(400).json({ error: "Informe um e-mail válido e uma senha com pelo menos 8 caracteres." });
    return;
  }

  let connection: PoolConnection | undefined;
  try {
    await ensureCredentialTable();
    const salt = randomBytes(16).toString("hex");
    const passwordHash = (await hashPassword(credentials.password, salt)).toString("hex");
    const openId = stableOpenId(credentials.email);
    const db = getPool();
    connection = await db.getConnection();
    await connection.beginTransaction();
    await connection.execute(
      "INSERT INTO admin_panel_credentials (singleton_id, email, open_id, salt, password_hash) VALUES (1, ?, ?, ?, ?)",
      [credentials.email, openId, salt, passwordHash],
    );
    await connection.execute(
      `INSERT INTO admin_users (openId, name, email, loginMethod, role, lastSignedIn)
       VALUES (?, 'Young Money Admin', ?, 'email', 'admin', NOW())
       ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), loginMethod = VALUES(loginMethod), role = 'admin', lastSignedIn = NOW()`,
      [openId, credentials.email],
    );
    await connection.commit();
    res.status(201).json({ success: true });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch { /* no-op */ }
    }
    const code = (error as { code?: string })?.code;
    if (code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "A configuração inicial já foi concluída." });
      return;
    }
    console.error("[AdminAuth] Bootstrap failed", code || "database error");
    res.status(500).json({ error: "Não foi possível concluir a configuração inicial." });
  } finally {
    connection?.release();
  }
}

export async function loginAdmin(req: Request, res: Response) {
  if (loginRateLimited(req, res)) return;
  const credentials = normalizedCredentials(req.body);
  if (!credentials) {
    res.status(400).json({ error: "Informe um e-mail válido e uma senha." });
    return;
  }

  try {
    await ensureCredentialTable();
    const db = getPool();
    const [credentialRows] = await db.execute<CredentialRow[]>(
      "SELECT email, open_id, salt, password_hash FROM admin_panel_credentials WHERE singleton_id = 1 LIMIT 1",
    );
    const credential = credentialRows[0];
    const candidateHash = credential
      ? await hashPassword(credentials.password, credential.salt)
      : randomBytes(64);
    const expectedHash = credential ? Buffer.from(credential.password_hash, "hex") : randomBytes(64);
    const passwordMatches = candidateHash.length === expectedHash.length && timingSafeEqual(candidateHash, expectedHash);
    if (!credential || credential.email !== credentials.email || !passwordMatches) {
      res.status(401).json({ error: "E-mail ou senha incorretos." });
      return;
    }

    const [adminRows] = await db.execute<AdminRow[]>(
      "SELECT id, openId, name, email, role FROM admin_users WHERE openId = ? LIMIT 1",
      [credential.open_id],
    );
    const admin = adminRows[0];
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) {
      res.status(403).json({ error: "Esta conta não possui permissão de administrador." });
      return;
    }

    loginAttempts.delete(clientAddress(req));
    await db.execute("UPDATE admin_users SET lastSignedIn = NOW() WHERE openId = ?", [credential.open_id]);
    const token = await sdk.createSessionToken(credential.open_id, {
      name: admin.name || "Young Money Admin",
      expiresInMs: ONE_YEAR_MS,
    });
    res.cookie(COOKIE_NAME, token, {
      ...getSessionCookieOptions(req),
      maxAge: ONE_YEAR_MS,
    });
    res.json({ success: true, user: { name: admin.name, email: admin.email, role: admin.role } });
  } catch (error) {
    console.error("[AdminAuth] Login failed", (error as { code?: string })?.code || "database error");
    res.status(500).json({ error: "Não foi possível entrar agora. Tente novamente." });
  }
}

export function adminAuthRoutes(app: import("express").Express) {
  app.post("/api/admin/auth/bootstrap", bootstrapAdmin);
  app.post("/api/admin/auth/login", loginAdmin);
}
