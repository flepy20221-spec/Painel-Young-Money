import { createHash } from "node:crypto";
import { getPool } from "./railwayDb";

const MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_PUBLIC_API = "https://youngmoney-api-railway-production-5bf3.up.railway.app";

function imageType(bytes: Buffer): string | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function uploadTaskIcon(dataUrl: string): Promise<string> {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new Error("Escolha uma imagem PNG, JPG ou WebP.");

  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("O ícone deve ter no máximo 2 MB.");
  if (bytes.toString("base64") !== match[2] || imageType(bytes) !== match[1]) {
    throw new Error("Arquivo de imagem inválido.");
  }

  const base = process.env.TASKS_ICON_PUBLIC_BASE_URL || DEFAULT_PUBLIC_API;
  const url = new URL("/api/v1/mission_icon.php", base);
  if (url.protocol !== "https:") throw new Error("Configure uma URL pública HTTPS para os ícones.");

  const db = await getPool();
  if (!db) throw new Error("Banco das missões indisponível.");
  const id = createHash("sha256").update(bytes).digest("hex");
  await db.query(`CREATE TABLE IF NOT EXISTS daily_task_icons (
    id CHAR(64) NOT NULL PRIMARY KEY,
    mime_type VARCHAR(32) NOT NULL,
    image_data MEDIUMBLOB NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await db.query("INSERT IGNORE INTO daily_task_icons (id, mime_type, image_data) VALUES (?, ?, ?)", [id, match[1], bytes]);

  url.searchParams.set("id", id);
  return url.toString();
}
