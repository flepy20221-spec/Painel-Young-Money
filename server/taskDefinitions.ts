import { randomBytes } from "node:crypto";
import { getPool as getRailwayPool } from "./railwayDb";

type MissionInput = {
  title: string;
  description: string;
  icon: string;
  pointsReward: number;
  frequency: "once" | "daily";
  targetUrl?: string;
  waitSeconds?: number;
  isActive: boolean;
};

async function getMissionPool() {
  const pool = await getRailwayPool();
  if (!pool) throw new Error("Banco das missões indisponível.");
  return pool;
}

async function ensureCatalog() {
  const db = await getMissionPool();
  await db.query(`CREATE TABLE IF NOT EXISTS daily_task_definitions (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    icon VARCHAR(255) NOT NULL DEFAULT 'star',
    points_reward INT NOT NULL DEFAULT 0,
    frequency ENUM('daily', 'once') NOT NULL DEFAULT 'daily',
    action_type ENUM('builtin', 'link') NOT NULL DEFAULT 'link',
    target_url VARCHAR(512) DEFAULT NULL,
    wait_seconds SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    requires_ad TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // A API mantém estes mesmos IDs e só insere linhas ausentes: edições não são sobrescritas.
  const defaults: Array<[string, string, string, number, string]> = [
    ["candy_level", "Passar Level no Planet Crush", "game", 40000, "builtin"],
    ["spin", "Girar a Roleta", "spin", 50000, "builtin"],
    ["checkin", "Fazer Check-in Diário", "calendar", 30000, "builtin"],
    ["video", "Assistir Vídeo", "video", 20000, "builtin"],
    ["invite", "Convidar Amigos", "people", 30000, "builtin"],
    ["community", "Entrar na Comunidade", "people", 30000, "builtin"],
    ["ranking", "Visitar o Ranking", "trophy", 10000, "builtin"],
  ];
  for (const [id, title, icon, points, type] of defaults) {
    await db.query(`INSERT IGNORE INTO daily_task_definitions
      (id, title, icon, points_reward, frequency, action_type, requires_ad, is_active)
      VALUES (?, ?, ?, ?, 'daily', ?, 1, ?)`, [id, title, icon, points, type, id === "ranking" ? 0 : 1]);
  }
  for (const [id, title, url] of [
    ["store_youngmoney", "Conheça o Young Money na Play Store", "https://play.google.com/store/apps/details?id=com.youngmoney2"],
    ["store_cashpix", "Conheça o CashPix na Play Store", "https://play.google.com/store/apps/details?id=com.madagascarmods"],
  ]) {
    await db.query(`INSERT IGNORE INTO daily_task_definitions
      (id, title, description, icon, points_reward, frequency, action_type, target_url, wait_seconds, requires_ad)
      VALUES (?, ?, 'Visite a página do aplicativo.', 'store', 20000, 'once', 'link', ?, 20, 0)`, [id, title, url]);
  }
}

export async function listTaskDefinitions() {
  await ensureCatalog();
  const [rows] = await (await getMissionPool()).query(`SELECT id, title, description, icon, points_reward, frequency,
    action_type, target_url, wait_seconds, requires_ad, is_active
    FROM daily_task_definitions ORDER BY created_at, id`);
  return rows as Array<Record<string, unknown>>;
}

export async function createTaskDefinition(input: MissionInput) {
  await ensureCatalog();
  const id = `custom_${randomBytes(8).toString("hex")}`;
  await (await getMissionPool()).query(`INSERT INTO daily_task_definitions
    (id, title, description, icon, points_reward, frequency, action_type, target_url, wait_seconds, requires_ad, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 'link', ?, ?, 0, ?)`, [
    id, input.title, input.description, input.icon, input.pointsReward,
    input.frequency, input.targetUrl, input.waitSeconds ?? 20, Number(input.isActive),
  ]);
  return id;
}

export async function updateTaskDefinition(id: string, input: MissionInput) {
  await ensureCatalog();
  const [rows] = await (await getMissionPool()).query(`SELECT action_type FROM daily_task_definitions WHERE id = ?`, [id]);
  const existing = (rows as Array<{ action_type: string }>)[0];
  if (!existing) throw new Error("Missão não encontrada.");
  const link = existing.action_type === "link";
  await (await getMissionPool()).query(`UPDATE daily_task_definitions SET title = ?, description = ?, icon = ?,
    points_reward = ?, frequency = ?, target_url = ?, wait_seconds = ?, is_active = ? WHERE id = ?`, [
    input.title, input.description, input.icon, input.pointsReward, input.frequency,
    link ? input.targetUrl : null, link ? (input.waitSeconds ?? 20) : 0,
    Number(input.isActive), id,
  ]);
}
