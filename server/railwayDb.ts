import mysql from "mysql2/promise";
import { randomBytes } from "crypto";
import { buildRewardSearch } from "./rewardsSearch";

// Conexão direta com o banco MySQL do Railway
const RAILWAY_DB_URL = process.env.RAILWAY_DB_URL ?? process.env.DATABASE_URL;

let _pool: mysql.Pool | null = null;
let _permanentEmailBanTableReady = false;

export async function getPool() {
  if (!RAILWAY_DB_URL) {
    throw new Error("Configure RAILWAY_DB_URL ou DATABASE_URL para acessar os usuários.");
  }
  if (!_pool) {
    try {
      _pool = mysql.createPool({
        uri: RAILWAY_DB_URL,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
      console.log("[Railway DB] Pool created successfully");
    } catch (error) {
      console.warn("[Railway DB] Failed to create pool:", error);
      _pool = null;
    }
  }
  return _pool;
}

// Função para executar queries SQL diretas
export async function executeRawQuery(query: string, params: any[] = []) {
  const pool = await getPool();
  if (!pool) {
    console.warn("[Railway DB] Pool not available");
    return [];
  }
  try {
    // Usar query() em vez de execute() para evitar problemas com tipos de parâmetros
    const [rows] = await pool.query(query, params);
    return rows as any[];
  } catch (error) {
    console.error("[Railway DB] Query error:", error);
    return [];
  }
}

export async function ensurePermanentEmailBansTable() {
  if (_permanentEmailBanTableReady) return;
  const pool = await getPool();
  if (!pool) throw new Error("Banco de dados indisponível para preparar banimentos permanentes.");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS permanent_email_bans (
      normalized_email VARCHAR(320) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
      reason VARCHAR(500) NOT NULL DEFAULT '',
      banned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_permanent_email_bans_banned_at (banned_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS permanent_email_ban_user_state (
      normalized_email VARCHAR(320) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      user_id INT NOT NULL,
      ranking_participant_before TINYINT NOT NULL DEFAULT 0,
      PRIMARY KEY (normalized_email, user_id),
      INDEX idx_permanent_email_ban_state_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  _permanentEmailBanTableReady = true;
}

// ============= USUÁRIOS DO APP (tabela users do Railway) =============

export async function getAllRailwayUsers(limit = 100, offset = 0) {
  try {
    await ensurePermanentEmailBansTable();
    const rows = await executeRawQuery(
      `SELECT u.*,
              CASE WHEN peb.normalized_email IS NULL THEN 0 ELSE 1 END AS permanent_email_banned
       FROM users u
       LEFT JOIN permanent_email_bans peb
         ON peb.normalized_email = LOWER(TRIM(u.email)) COLLATE utf8mb4_bin
       ORDER BY u.id DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching users:", error);
    return [];
  }
}

// Consulta exclusiva da tela de Recompensas: busca e paginação no banco,
// preservando appUsers.list e as outras telas que dependem dele.
export async function getRewardUsersPage(
  limit: number,
  offset: number,
  search: string
) {
  await ensurePermanentEmailBansTable();
  const pool = await getPool();
  if (!pool) throw new Error("Banco de usuários indisponível.");

  const { where, params } = buildRewardSearch(search);
  const [countRows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM users u${where}`,
    params
  );
  const total = Number(countRows[0]?.count ?? 0);
  const [users] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT u.id, u.name, u.username, u.email, u.points, u.is_banned,
            u.photo_url, u.profile_picture,
            CASE WHEN peb.normalized_email IS NULL THEN 0 ELSE 1 END AS permanent_email_banned
     FROM users u
     LEFT JOIN permanent_email_bans peb
       ON peb.normalized_email = LOWER(TRIM(u.email)) COLLATE utf8mb4_bin
     ${where}
     ORDER BY u.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return { users, total };
}

export async function getRailwayUserById(id: number) {
  try {
    const rows = await executeRawQuery(
      `SELECT * FROM users WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  } catch (error) {
    console.warn("[Railway DB] Error fetching user:", error);
    return null;
  }
}

export async function getRailwayUserCount() {
  try {
    const rows = await executeRawQuery(`SELECT COUNT(*) as count FROM users`);
    return rows[0]?.count || 0;
  } catch (error) {
    console.warn("[Railway DB] Error counting users:", error);
    return 0;
  }
}

export async function updateRailwayUserPoints(userId: number, points: number) {
  try {
    await executeRawQuery(
      `UPDATE users SET points = ? WHERE id = ?`,
      [points, userId]
    );
    return true;
  } catch (error) {
    console.warn("[Railway DB] Error updating points:", error);
    return false;
  }
}

export async function updateRailwayUserBalance(userId: number, balance: number) {
  try {
    await executeRawQuery(
      `UPDATE users SET balance = ? WHERE id = ?`,
      [balance, userId]
    );
    return true;
  } catch (error) {
    console.warn("[Railway DB] Error updating balance:", error);
    return false;
  }
}

// ============= TRANSAÇÕES DE PONTOS =============

export async function getRailwayPointTransactions(userId?: number, limit = 100) {
  try {
    let query = `SELECT * FROM point_transactions ORDER BY id DESC LIMIT ?`;
    let params: any[] = [limit];
    
    if (userId) {
      query = `SELECT * FROM point_transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?`;
      params = [userId, limit];
    }
    
    const rows = await executeRawQuery(query, params);
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching point transactions:", error);
    return [];
  }
}

// ============= SAQUES =============

export async function getRailwayWithdrawals(status?: string, limit = 100) {
  try {
    let query = `SELECT w.*, u.name as user_name, u.email as user_email 
                 FROM withdrawals w 
                 LEFT JOIN users u ON w.user_id = u.id 
                 ORDER BY w.id DESC LIMIT ?`;
    let params: any[] = [limit];
    
    if (status) {
      query = `SELECT w.*, u.name as user_name, u.email as user_email 
               FROM withdrawals w 
               LEFT JOIN users u ON w.user_id = u.id 
               WHERE w.status = ? 
               ORDER BY w.id DESC LIMIT ?`;
      params = [status, limit];
    }
    
    const rows = await executeRawQuery(query, params);
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching withdrawals:", error);
    return [];
  }
}

export async function updateRailwayWithdrawalStatus(withdrawalId: number, status: string, receiptUrl?: string) {
  const pool = await getPool();
  if (!pool) throw new Error("Conexão com o banco indisponível");

  if (status === "rejected") {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(
        `SELECT id, user_id, status, amount, points_debited
         FROM withdrawals WHERE id = ? FOR UPDATE`,
        [withdrawalId]
      );
      const withdrawal = (rows as any[])[0];
      if (!withdrawal) throw new Error("Saque não encontrado");

      // Uma rejeição repetida não pode devolver os pontos mais de uma vez.
      if (withdrawal.status === "rejected") {
        await connection.commit();
        return true;
      }
      if (withdrawal.status !== "pending") {
        throw new Error("Só é possível cancelar um saque pendente");
      }

      const recordedPoints = Number(withdrawal.points_debited);
      const pointsToRefund = Number.isFinite(recordedPoints) && recordedPoints > 0
        ? Math.round(recordedPoints)
        : Math.round(Number(withdrawal.amount) * 2_000_000);
      if (!Number.isSafeInteger(pointsToRefund) || pointsToRefund <= 0) {
        throw new Error("Não foi possível determinar os pontos debitados deste saque");
      }

      const userId = Number(withdrawal.user_id);
      const [userUpdate] = await connection.query(
        `UPDATE users SET points = points + ?, updated_at = NOW() WHERE id = ?`,
        [pointsToRefund, userId]
      );
      if (Number((userUpdate as any).affectedRows) !== 1) {
        throw new Error("Conta do usuário não encontrada para devolver os pontos");
      }

      const description = "Chave PIX incorreta";
      await connection.query(
        `INSERT INTO points_history (user_id, points, description, created_at)
         VALUES (?, ?, ?, NOW())`,
        [userId, pointsToRefund, description]
      );
      try {
        await connection.query(
          `INSERT INTO point_transactions (user_id, points, type, description, created_at)
           VALUES (?, ?, 'credit', ?, NOW())`,
          [userId, pointsToRefund, description]
        );
      } catch (historyError) {
        // point_transactions é complementar; points_history é o histórico do app.
        console.warn("[Railway DB] Could not add refund to point_transactions:", historyError);
      }

      const [withdrawalUpdate] = await connection.query(
        `UPDATE withdrawals SET status = 'rejected', updated_at = NOW()
         WHERE id = ? AND status = 'pending'`,
        [withdrawalId]
      );
      if (Number((withdrawalUpdate as any).affectedRows) !== 1) {
        throw new Error("O status do saque mudou antes de concluir o cancelamento");
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      console.warn("[Railway DB] Error refunding rejected withdrawal:", error);
      throw error;
    } finally {
      connection.release();
    }
  }

  try {
    if (receiptUrl) {
      await executeRawQuery(
        `UPDATE withdrawals SET status = ?, receipt_url = ?, updated_at = NOW() WHERE id = ?`,
        [status, receiptUrl, withdrawalId]
      );
    } else {
      await executeRawQuery(
        `UPDATE withdrawals SET status = ?, updated_at = NOW() WHERE id = ?`,
        [status, withdrawalId]
      );
    }
    return true;
  } catch (error) {
    console.warn("[Railway DB] Error updating withdrawal:", error);
    return false;
  }
}


export async function getRailwayWithdrawalStats() {
  try {
    const pending = await executeRawQuery(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE status = 'pending'`
    );
    const approved = await executeRawQuery(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE status = 'approved'`
    );
    const rejected = await executeRawQuery(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE status = 'rejected'`
    );
    
    return {
      pending: { count: pending[0]?.count || 0, total: pending[0]?.total || 0 },
      approved: { count: approved[0]?.count || 0, total: approved[0]?.total || 0 },
      rejected: { count: rejected[0]?.count || 0, total: rejected[0]?.total || 0 },
    };
  } catch (error) {
    console.warn("[Railway DB] Error fetching withdrawal stats:", error);
    return {
      pending: { count: 0, total: 0 },
      approved: { count: 0, total: 0 },
      rejected: { count: 0, total: 0 },
    };
  }
}

// ============= REFERÊNCIAS/CONVITES =============

export async function getRailwayReferrals(limit = 100) {
  try {
    const rows = await executeRawQuery(
      `SELECT r.*, 
              u1.name as referrer_name, u1.email as referrer_email,
              u2.name as referred_name, u2.email as referred_email
       FROM referrals r
       LEFT JOIN users u1 ON r.referrer_id = u1.id
       LEFT JOIN users u2 ON r.referred_id = u2.id
       ORDER BY r.id DESC LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching referrals:", error);
    return [];
  }
}

// ============= RANKING =============

// Buscar ranking SEM filtro de cooldown (para visualização no admin)
export async function getRailwayRanking(limit = 10000) {
  try {
    await ensurePermanentEmailBansTable();
    const rows = await executeRawQuery(
      `SELECT u.id, u.name, u.email, u.points, u.daily_points, u.balance, u.photo_url, u.profile_picture
       FROM users u
       WHERE NOT EXISTS (
         SELECT 1 FROM permanent_email_bans peb
         WHERE peb.normalized_email = LOWER(TRIM(u.email)) COLLATE utf8mb4_bin
       )
       ORDER BY u.daily_points DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching ranking:", error);
    return [];
  }
}

// Buscar ranking COM filtro de cooldown (ranking real para pagamentos)
// Exclui usuários em período de cooldown ativo
export async function getRailwayRankingWithCooldown(limit = 10) {
  try {
    await ensurePermanentEmailBansTable();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const rows = await executeRawQuery(
      `SELECT u.id, u.name, u.email, u.points, u.daily_points, u.balance, u.photo_url, u.profile_picture, u.pix_key, u.pix_key_type
       FROM users u
       LEFT JOIN ranking_cooldowns rc ON u.id = rc.user_id AND rc.cooldown_until > ?
       WHERE u.daily_points > 0
         AND u.pix_key IS NOT NULL
         AND u.pix_key != ''
         AND rc.id IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM permanent_email_bans peb
           WHERE peb.normalized_email = LOWER(TRIM(u.email)) COLLATE utf8mb4_bin
         )
       ORDER BY u.daily_points DESC, u.created_at ASC
       LIMIT ?`,
      [now, limit]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching ranking with cooldown:", error);
    return [];
  }
}

// Verificar cooldowns ativos
export async function getActiveCooldowns() {
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const rows = await executeRawQuery(
      `SELECT rc.*, u.name, u.email 
       FROM ranking_cooldowns rc
       JOIN users u ON rc.user_id = u.id
       WHERE rc.cooldown_until > ?
       ORDER BY rc.cooldown_until DESC`,
      [now]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching active cooldowns:", error);
    return [];
  }
}

// ============= ATUALIZAR PONTOS DIÁRIOS =============

export async function updateDailyPoints(userId: number, points: number, operation: 'add' | 'subtract' | 'set') {
  try {
    let query = '';
    if (operation === 'add') {
      query = `UPDATE users SET daily_points = daily_points + ?, updated_at = NOW() WHERE id = ?`;
    } else if (operation === 'subtract') {
      query = `UPDATE users SET daily_points = daily_points - ?, updated_at = NOW() WHERE id = ?`;
    } else {
      query = `UPDATE users SET daily_points = ?, updated_at = NOW() WHERE id = ?`;
    }
    await executeRawQuery(query, [points, userId]);
    return true;
  } catch (error) {
    console.error("[Railway DB] Error updating daily points:", error);
    return false;
  }
}

// ============= ESTATÍSTICAS GERAIS =============

export async function getRailwayDashboardStats() {
  try {
    const userCount = await executeRawQuery(`SELECT COUNT(*) as count FROM users`);
    const totalPoints = await executeRawQuery(`SELECT COALESCE(SUM(points), 0) as total FROM users`);
    const totalBalance = await executeRawQuery(`SELECT COALESCE(SUM(balance), 0) as total FROM users`);
    const pendingWithdrawals = await executeRawQuery(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE status = 'pending'`
    );
    const approvedWithdrawals = await executeRawQuery(
      `SELECT COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE status = 'approved'`
    );
    
    // Usuários ativos hoje
    const today = new Date().toISOString().split('T')[0];
    const activeToday = await executeRawQuery(
      `SELECT COUNT(*) as count FROM users WHERE DATE(last_login_at) = ?`,
      [today]
    );
    
    return {
      totalUsers: userCount[0]?.count || 0,
      totalPoints: totalPoints[0]?.total || 0,
      totalBalance: totalBalance[0]?.total || 0,
      pendingWithdrawals: pendingWithdrawals[0]?.count || 0,
      pendingWithdrawalsAmount: pendingWithdrawals[0]?.total || 0,
      totalWithdrawn: approvedWithdrawals[0]?.total || 0,
      activeUsersToday: activeToday[0]?.count || 0,
    };
  } catch (error) {
    console.warn("[Railway DB] Error fetching dashboard stats:", error);
    return {
      totalUsers: 0,
      totalPoints: 0,
      totalBalance: 0,
      pendingWithdrawals: 0,
      pendingWithdrawalsAmount: 0,
      totalWithdrawn: 0,
      activeUsersToday: 0,
    };
  }
}

// ============= LISTAR TABELAS =============

export async function listRailwayTables() {
  try {
    const rows = await executeRawQuery(`SHOW TABLES`);
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error listing tables:", error);
    return [];
  }
}

// ============= DESCREVER TABELA =============

export async function describeRailwayTable(tableName: string) {
  try {
    const rows = await executeRawQuery(`DESCRIBE ${tableName}`);
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error describing table:", error);
    return [];
  }
}

// ============= CRIAR SAQUE =============

export async function createRailwayWithdrawal(data: {
  userId: number;
  amount: number;
  pixType: string;
  pixKey: string;
  status?: string;
}) {
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const result = await executeRawQuery(
      `INSERT INTO withdrawals (user_id, amount, pix_type, pix_key, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.userId, data.amount, data.pixType, data.pixKey, data.status || 'pending', now, now]
    );
    return result;
  } catch (error) {
    console.error("[Railway DB] Error creating withdrawal:", error);
    throw error;
  }
}

// ============= BUSCAR CHAVE PIX DO USUÁRIO =============

export async function getRailwayUserPixKey(userId: number) {
  try {
    const rows = await executeRawQuery(
      `SELECT * FROM pix_keys WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  } catch (error) {
    console.warn("[Railway DB] Error fetching user pix key:", error);
    return null;
  }
}


// ============= CONFIGURAÇÕES DO SISTEMA =============

export async function getSystemSettings() {
  try {
    const rows = await executeRawQuery(`SELECT * FROM system_settings ORDER BY id`);
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching system settings:", error);
    return [];
  }
}

export async function updateSystemSetting(key: string, value: string) {
  try {
    // Usar INSERT ON DUPLICATE KEY UPDATE para criar se não existir
    await executeRawQuery(
      `INSERT INTO system_settings (setting_key, setting_value, created_at, updated_at) 
       VALUES (?, ?, NOW(), NOW()) 
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [key, value]
    );
    return true;
  } catch (error) {
    console.error("[Railway DB] Error updating system setting:", error);
    return false;
  }
}

export async function getWithdrawalQuickValues() {
  try {
    const rows = await executeRawQuery(
      `SELECT id, value_amount, is_active, display_order, updated_at
       FROM withdrawal_quick_values
       WHERE is_active = 1
       ORDER BY display_order ASC, value_amount ASC`
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching withdrawal quick values:", error);
    return [];
  }
}

export async function replaceWithdrawalQuickValues(values: number[]) {
  try {
    const sanitizedValues = Array.from(
      new Set(
        values
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
      )
    ).sort((a, b) => a - b);

    await executeRawQuery(
      `UPDATE withdrawal_quick_values SET is_active = 0, updated_at = NOW()`
    );

    for (const [index, value] of sanitizedValues.entries()) {
      await executeRawQuery(
        `INSERT INTO withdrawal_quick_values (value_amount, display_order, is_active, created_at, updated_at)
         VALUES (?, ?, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           display_order = VALUES(display_order),
           is_active = 1,
           updated_at = NOW()`,
        [value, index + 1]
      );
    }

    return sanitizedValues;
  } catch (error) {
    console.error("[Railway DB] Error replacing withdrawal quick values:", error);
    throw error;
  }
}

// ============= ROLETA - CONFIGURAÇÕES =============

export async function getRouletteSettings() {
  try {
    const rows = await executeRawQuery(`SELECT * FROM roulette_settings ORDER BY id`);
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching roulette settings:", error);
    return [];
  }
}

export async function updateRouletteSetting(key: string, value: string) {
  try {
    await executeRawQuery(
      `UPDATE roulette_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?`,
      [value, key]
    );
    return true;
  } catch (error) {
    console.error("[Railway DB] Error updating roulette setting:", error);
    return false;
  }
}

// ============= ROLETA - PRÊMIOS =============

export async function getRoulettePrizes() {
  try {
    const rows = await executeRawQuery(`SELECT * FROM roulette_prizes ORDER BY id`);
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching roulette prizes:", error);
    return [];
  }
}

export async function updateRoulettePrize(id: number, prizeName: string, prizeValue: number, probability: number, isActive: boolean) {
  try {
    await executeRawQuery(
      `UPDATE roulette_prizes SET prize_name = ?, prize_value = ?, probability = ?, is_active = ? WHERE id = ?`,
      [prizeName, prizeValue, probability, isActive ? 1 : 0, id]
    );
    return true;
  } catch (error) {
    console.error("[Railway DB] Error updating roulette prize:", error);
    return false;
  }
}

// ============= SPINS (GIROS DA ROLETA) =============

export async function getSpinHistory(limit = 100) {
  try {
    const rows = await executeRawQuery(
      `SELECT s.*, u.name as user_name, u.email as user_email 
       FROM spins s 
       LEFT JOIN users u ON s.user_id = u.id 
       ORDER BY s.id DESC LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching spin history:", error);
    return [];
  }
}

// ============= CHECK-IN DIÁRIO =============

export async function getDailyCheckins(limit = 100) {
  try {
    const rows = await executeRawQuery(
      `SELECT dc.*, u.name as user_name, u.email as user_email 
       FROM daily_checkin dc 
       LEFT JOIN users u ON dc.user_id = u.id 
       ORDER BY dc.id DESC LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching daily checkins:", error);
    return [];
  }
}

// ============= TAREFAS DIÁRIAS =============

export async function getDailyTasks() {
  try {
    const rows = await executeRawQuery(`SELECT * FROM daily_tasks ORDER BY id`);
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching daily tasks:", error);
    return [];
  }
}

export async function updateDailyTask(id: number, data: { task_name?: string; points_reward?: number; is_active?: boolean }) {
  try {
    const updates: string[] = [];
    const params: any[] = [];
    
    if (data.task_name !== undefined) {
      updates.push('task_name = ?');
      params.push(data.task_name);
    }
    if (data.points_reward !== undefined) {
      updates.push('points_reward = ?');
      params.push(data.points_reward);
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(data.is_active ? 1 : 0);
    }
    
    if (updates.length === 0) return false;
    
    params.push(id);
    await executeRawQuery(
      `UPDATE daily_tasks SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    return true;
  } catch (error) {
    console.error("[Railway DB] Error updating daily task:", error);
    return false;
  }
}

// ============= PROGRESSO DE TAREFAS DO USUÁRIO =============

/**
 * Verifica se um usuário completou uma tarefa específica
 * @param userId ID do usuário
 * @param taskType Tipo de tarefa (ex: 'impression', 'roulette_spin', etc)
 * @returns true se a tarefa foi completada, false caso contrário
 */
export async function checkUserTaskCompletion(userId: number, taskType: string) {
  try {
    const rows = await executeRawQuery(
      `SELECT is_completed, completed_at FROM daily_tasks WHERE user_id = ? AND task_type = ? AND DATE(created_at) = CURDATE()`,
      [userId, taskType]
    );
    
    if (rows.length === 0) {
      console.log(`[Railway DB] Task '${taskType}' not found for user ${userId}`);
      return false;
    }
    
    const isCompleted = rows[0]?.is_completed === 1 || rows[0]?.is_completed === true;
    console.log(`[Railway DB] Task '${taskType}' for user ${userId}: ${isCompleted ? 'COMPLETED' : 'PENDING'}`);
    return isCompleted;
  } catch (error) {
    console.error("[Railway DB] Error checking task completion:", error);
    return false;
  }
}

/**
 * Marca uma tarefa como completa para um usuário
 * @param userId ID do usuário
 * @param taskType Tipo de tarefa
 * @param pointsAwarded Pontos a serem concedidos
 * @returns true se atualizado com sucesso
 */
export async function completeUserTask(userId: number, taskType: string, pointsAwarded: number = 0) {
  try {
    // Verificar se tarefa já existe para hoje
    const existingTask = await executeRawQuery(
      `SELECT id FROM daily_tasks WHERE user_id = ? AND task_type = ? AND DATE(created_at) = CURDATE()`,
      [userId, taskType]
    );
    
    if (existingTask.length > 0) {
      // Atualizar tarefa existente
      await executeRawQuery(
        `UPDATE daily_tasks SET is_completed = 1, completed_at = NOW(), points_awarded = ? WHERE id = ?`,
        [pointsAwarded, existingTask[0].id]
      );
      console.log(`[Railway DB] Task '${taskType}' marked as completed for user ${userId}`);
    } else {
      // Criar nova tarefa
      await executeRawQuery(
        `INSERT INTO daily_tasks (user_id, task_type, is_completed, points_awarded, completed_at, created_at) VALUES (?, ?, 1, ?, NOW(), NOW())`,
        [userId, taskType, pointsAwarded]
      );
      console.log(`[Railway DB] New task '${taskType}' created and marked as completed for user ${userId}`);
    }
    
    // Adicionar pontos ao usuário se especificado
    if (pointsAwarded > 0) {
      await executeRawQuery(
        `UPDATE users SET points = points + ? WHERE id = ?`,
        [pointsAwarded, userId]
      );
      console.log(`[Railway DB] Added ${pointsAwarded} points to user ${userId} for task '${taskType}'`);
    }
    
    return true;
  } catch (error) {
    console.error("[Railway DB] Error completing task:", error);
    return false;
  }
}

/**
 * Obtém o progresso de uma tarefa específica para um usuário
 * @param userId ID do usuário
 * @param taskType Tipo de tarefa
 * @returns Objeto com informações do progresso
 */
export async function getUserTaskProgress(userId: number, taskType: string) {
  try {
    const rows = await executeRawQuery(
      `SELECT id, task_type, is_completed, points_awarded, completed_at, created_at FROM daily_tasks WHERE user_id = ? AND task_type = ? AND DATE(created_at) = CURDATE()`,
      [userId, taskType]
    );
    
    if (rows.length === 0) {
      return {
        found: false,
        completed: false,
        points: 0,
        completedAt: null
      };
    }
    
    const task = rows[0];
    return {
      found: true,
      completed: task.is_completed === 1 || task.is_completed === true,
      points: task.points_awarded || 0,
      completedAt: task.completed_at,
      createdAt: task.created_at
    };
  } catch (error) {
    console.error("[Railway DB] Error fetching task progress:", error);
    return {
      found: false,
      completed: false,
      points: 0,
      completedAt: null
    };
  }
}

// ============= NOTIFICAÇÕES =============

export async function getNotifications(limit = 100) {
  try {
    const rows = await executeRawQuery(
      `SELECT n.*, u.name as user_name, u.email as user_email 
       FROM notifications n 
       LEFT JOIN users u ON n.user_id = u.id 
       ORDER BY n.created_at DESC LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching notifications:", error);
    return [];
  }
}

export async function createNotification(userId: number, title: string, message: string, type: string = 'info', points: number = 0) {
  try {
    await executeRawQuery(
      `INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())`,
      [userId, title, message, type]
    );
    
    // Adicionar pontos ao usuário se especificado
    if (points > 0) {
      await executeRawQuery(
        `UPDATE users SET points = points + ? WHERE id = ?`,
        [points, userId]
      );
      console.log(`[Railway DB] Added ${points} points to user ${userId}`);
    }
    
    return true;
  } catch (error) {
    console.error("[Railway DB] Error creating notification:", error);
    return false;
  }
}

export async function sendBroadcastNotification(title: string, message: string, type: string = 'info', points: number = 0) {
  try {
    const users = await executeRawQuery(`SELECT id FROM users`);
    for (const user of users) {
      await createNotification(user.id, title, message, type, points);
    }
    return true;
  } catch (error) {
    console.error("[Railway DB] Error sending broadcast notification:", error);
    return false;
  }
}

// ============= BLACKLIST DE DISPOSITIVOS =============

export async function getDeviceBlacklist(limit = 100) {
  try {
    const rows = await executeRawQuery(`SELECT * FROM device_blacklist ORDER BY created_at DESC LIMIT ?`, [limit]);
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching device blacklist:", error);
    return [];
  }
}

export async function addToDeviceBlacklist(deviceId: string, reason: string) {
  try {
    await executeRawQuery(
      `INSERT INTO device_blacklist (device_id, reason, created_at) VALUES (?, ?, NOW())`,
      [deviceId, reason]
    );
    return true;
  } catch (error) {
    console.error("[Railway DB] Error adding to device blacklist:", error);
    return false;
  }
}

// ============= VIOLAÇÕES DE SEGURANÇA =============

export async function getSecurityViolations(limit = 100) {
  try {
    const rows = await executeRawQuery(
      `SELECT sv.*, u.name as user_name, u.email as user_email 
       FROM security_violations sv 
       LEFT JOIN users u ON sv.user_id = u.id 
       ORDER BY sv.created_at DESC LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching security violations:", error);
    return [];
  }
}

// ============= SESSÕES ATIVAS =============

export async function getActiveSessions(limit = 100) {
  try {
    const rows = await executeRawQuery(
      `SELECT as2.*, u.name as user_name, u.email as user_email 
       FROM active_sessions as2 
       LEFT JOIN users u ON as2.user_id = u.id 
       ORDER BY as2.id DESC LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching active sessions:", error);
    return [];
  }
}

export async function terminateSession(sessionId: number) {
  try {
    await executeRawQuery(`DELETE FROM active_sessions WHERE id = ?`, [sessionId]);
    return true;
  } catch (error) {
    console.error("[Railway DB] Error terminating session:", error);
    return false;
  }
}

// ============= MONETAG EVENTS =============

export async function getMonetag_Events(limit = 100) {
  try {
    // Primeiro tenta buscar da monetag_events com value enriquecido
    const rows = await executeRawQuery(
      `SELECT me.*, u.name as user_name, u.email as user_email
       FROM monetag_events me 
       LEFT JOIN users u ON me.user_id = u.id 
       ORDER BY me.id DESC LIMIT ?`,
      [limit]
    );
    
    // Verificar se todos os values são zero
    const hasAnyValue = rows.some((r: any) => Number(r.value || 0) > 0);
    
    if (!hasAnyValue && rows.length > 0) {
      // Se todos os values são zero, tentar enriquecer com monetag_postbacks
      // Buscar postbacks recentes para fazer o match
      const postbacks = await executeRawQuery(
        `SELECT ymid, event_type, estimated_price, created_at 
         FROM monetag_postbacks 
         WHERE ymid IS NOT NULL AND ymid != '' 
         ORDER BY id DESC LIMIT ?`,
        [limit * 2]
      );
      
      if (postbacks.length > 0) {
        // Criar mapa de postbacks por ymid+event_type+timestamp
        for (const row of rows) {
          if (Number(row.value || 0) <= 0) {
            const userId = String(row.user_id);
            const eventDate = new Date(row.created_at).getTime();
            
            // Encontrar o postback mais próximo em tempo
            let bestMatch: any = null;
            let bestDiff = Infinity;
            
            for (const pb of postbacks) {
              if (pb.ymid === userId && pb.event_type === row.event_type) {
                const pbDate = new Date(pb.created_at).getTime();
                const diff = Math.abs(pbDate - eventDate);
                if (diff < 120000 && diff < bestDiff) { // 2 minutos de tolerância
                  bestDiff = diff;
                  bestMatch = pb;
                }
              }
            }
            
            if (bestMatch) {
              row.value = bestMatch.estimated_price;
            }
          }
        }
      }
    }
    
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching monetag events:", error);
    return [];
  }
}

// Buscar ganhos Monetag de um usuário em uma data específica
// Usa monetag_postbacks (que tem estimated_price real) como fonte primária
export async function getMonetag_UserDayEarnings(userId: number, dateStr: string) {
  try {
    // Tentar primeiro com monetag_postbacks (tem estimated_price real)
    const postbackRows = await executeRawQuery(
      `SELECT COALESCE(SUM(estimated_price), 0) as user_day_total
       FROM monetag_postbacks
       WHERE ymid = CAST(? AS CHAR) AND DATE(created_at) = DATE(?)`,
      [userId, dateStr]
    );
    const postbackTotal = Number(postbackRows[0]?.user_day_total || 0);
    if (postbackTotal > 0) return postbackTotal;

    // Fallback para monetag_events
    const rows = await executeRawQuery(
      `SELECT COALESCE(SUM(value), 0) as user_day_total
       FROM monetag_events
       WHERE user_id = ? AND DATE(created_at) = DATE(?)`,
      [userId, dateStr]
    );
    return Number(rows[0]?.user_day_total || 0);
  } catch (error) {
    console.warn("[Railway DB] Error fetching user day earnings:", error);
    return 0;
  }
}

// Buscar total ganho de TODOS os usuários em uma data específica
// Usa monetag_postbacks como fonte primária
export async function getMonetag_AllUsersDayEarnings(dateStr: string) {
  try {
    // Tentar primeiro com monetag_postbacks
    const postbackRows = await executeRawQuery(
      `SELECT COALESCE(SUM(estimated_price), 0) as all_day_total
       FROM monetag_postbacks
       WHERE DATE(created_at) = DATE(?)`,
      [dateStr]
    );
    const postbackTotal = Number(postbackRows[0]?.all_day_total || 0);
    if (postbackTotal > 0) return postbackTotal;

    // Fallback para monetag_events
    const rows = await executeRawQuery(
      `SELECT COALESCE(SUM(value), 0) as all_day_total
       FROM monetag_events
       WHERE DATE(created_at) = DATE(?)`,
      [dateStr]
    );
    return Number(rows[0]?.all_day_total || 0);
  } catch (error) {
    console.warn("[Railway DB] Error fetching all users day earnings:", error);
    return 0;
  }
}

// Buscar ganhos Monetag em lote para vários usuários+datas (otimizado)
// Usa monetag_postbacks como fonte primária (tem estimated_price real)
export async function getMonetag_BatchEarnings(withdrawals: Array<{ user_id: number; created_at: string }>) {
  try {
    if (!withdrawals.length) return { userDayMap: {}, dayTotalMap: {} };

    // Extrair datas únicas
    const uniqueDates = [...new Set(withdrawals.map(w => {
      const d = new Date(w.created_at);
      return d.toISOString().slice(0, 10);
    }))];

    // 1. Buscar totais por usuário+dia usando monetag_postbacks (ymid = user_id como string)
    const userDayMap: Record<string, number> = {};
    if (uniqueDates.length > 0) {
      const userDayRows = await executeRawQuery(
        `SELECT ymid as user_id, DATE(created_at) as event_date, COALESCE(SUM(estimated_price), 0) as total
         FROM monetag_postbacks
         WHERE DATE(created_at) IN (${uniqueDates.map(() => '?').join(',')})
         AND ymid IS NOT NULL AND ymid != ''
         GROUP BY ymid, DATE(created_at)`,
        [...uniqueDates]
      );
      for (const row of userDayRows) {
        const dateKey = new Date(row.event_date).toISOString().slice(0, 10);
        userDayMap[`${row.user_id}_${dateKey}`] = Number(row.total || 0);
      }
    }

    // Se não encontrou dados em postbacks, tentar monetag_events como fallback
    if (Object.keys(userDayMap).length === 0 && uniqueDates.length > 0) {
      const userDayRows = await executeRawQuery(
        `SELECT user_id, DATE(created_at) as event_date, COALESCE(SUM(value), 0) as total
         FROM monetag_events
         WHERE DATE(created_at) IN (${uniqueDates.map(() => '?').join(',')})
         GROUP BY user_id, DATE(created_at)`,
        [...uniqueDates]
      );
      for (const row of userDayRows) {
        const dateKey = new Date(row.event_date).toISOString().slice(0, 10);
        userDayMap[`${row.user_id}_${dateKey}`] = Number(row.total || 0);
      }
    }

    // 2. Buscar totais de todos os usuários por dia usando monetag_postbacks
    const dayTotalMap: Record<string, number> = {};
    if (uniqueDates.length > 0) {
      const dayTotalRows = await executeRawQuery(
        `SELECT DATE(created_at) as event_date, COALESCE(SUM(estimated_price), 0) as total
         FROM monetag_postbacks
         WHERE DATE(created_at) IN (${uniqueDates.map(() => '?').join(',')})
         GROUP BY DATE(created_at)`,
        [...uniqueDates]
      );
      for (const row of dayTotalRows) {
        const dateKey = new Date(row.event_date).toISOString().slice(0, 10);
        dayTotalMap[dateKey] = Number(row.total || 0);
      }
    }

    // Se não encontrou totais em postbacks, tentar monetag_events
    if (Object.keys(dayTotalMap).length === 0 && uniqueDates.length > 0) {
      const dayTotalRows = await executeRawQuery(
        `SELECT DATE(created_at) as event_date, COALESCE(SUM(value), 0) as total
         FROM monetag_events
         WHERE DATE(created_at) IN (${uniqueDates.map(() => '?').join(',')})
         GROUP BY DATE(created_at)`,
        [...uniqueDates]
      );
      for (const row of dayTotalRows) {
        const dateKey = new Date(row.event_date).toISOString().slice(0, 10);
        dayTotalMap[dateKey] = Number(row.total || 0);
      }
    }

    return { userDayMap, dayTotalMap };
  } catch (error) {
    console.warn("[Railway DB] Error fetching batch earnings:", error);
    return { userDayMap: {}, dayTotalMap: {} };
  }
}

export async function getMonetag_Postbacks(limit = 100) {
  try {
    const rows = await executeRawQuery(`SELECT * FROM monetag_postbacks ORDER BY id DESC LIMIT ?`, [limit]);
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching monetag postbacks:", error);
    return [];
  }
}

// ============= PIX PAYMENTS =============

export async function getPixPayments(limit = 100) {
  try {
    const rows = await executeRawQuery(
      `SELECT pp.*, u.name as user_name, u.email as user_email 
       FROM pix_payments pp 
       LEFT JOIN users u ON pp.user_id = u.id 
       ORDER BY pp.id DESC LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching pix payments:", error);
    return [];
  }
}

// ============= POINT TRANSACTIONS =============

export async function getPointTransactions(limit = 100) {
  try {
    const rows = await executeRawQuery(
      `SELECT pt.*, u.name as user_name, u.email as user_email 
       FROM point_transactions pt 
       LEFT JOIN users u ON pt.user_id = u.id 
       ORDER BY pt.id DESC LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching point transactions:", error);
    return [];
  }
}

// ============= TRACKING EVENTS =============

export async function getTrackingEvents(limit = 100) {
  try {
    const rows = await executeRawQuery(
      `SELECT te.*, u.name as user_name, u.email as user_email 
       FROM tracking_events te 
       LEFT JOIN users u ON te.user_id = u.id 
       ORDER BY te.id DESC LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching tracking events:", error);
    return [];
  }
}

// ============= ADMIN LOGS =============

export async function getAdminLogs(limit = 100) {
  try {
    const rows = await executeRawQuery(`SELECT * FROM admin_logs ORDER BY id DESC LIMIT ?`, [limit]);
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching admin logs:", error);
    return [];
  }
}

export async function createAdminLog(action: string, details: string, adminId?: number) {
  try {
    await executeRawQuery(
      `INSERT INTO admin_logs (admin_id, action, details, created_at) VALUES (?, ?, ?, NOW())`,
      [adminId || null, action, details]
    );
    return true;
  } catch (error) {
    console.error("[Railway DB] Error creating admin log:", error);
    return false;
  }
}

// ============= WITHDRAWAL REQUESTS =============

export async function getWithdrawalRequests(limit = 100) {
  try {
    const rows = await executeRawQuery(
      `SELECT wr.*, u.name as user_name, u.email as user_email 
       FROM withdrawal_requests wr 
       LEFT JOIN users u ON wr.user_id = u.id 
       ORDER BY wr.id DESC LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching withdrawal requests:", error);
    return [];
  }
}

// ============= ATUALIZAR PONTOS DO USUÁRIO =============

export async function updateUserPoints(userId: number, points: number, operation: 'add' | 'subtract' | 'set') {
  try {
    let query = '';
    if (operation === 'add') {
      query = `UPDATE users SET points = points + ?, updated_at = NOW() WHERE id = ?`;
    } else if (operation === 'subtract') {
      query = `UPDATE users SET points = points - ?, updated_at = NOW() WHERE id = ?`;
    } else {
      query = `UPDATE users SET points = ?, updated_at = NOW() WHERE id = ?`;
    }
    await executeRawQuery(query, [points, userId]);
    return true;
  } catch (error) {
    console.error("[Railway DB] Error updating user points:", error);
    return false;
  }
}

// ============= CONSULTAR CONTAS BANIDAS =============

export async function getPermanentEmailBans(limit = 500) {
  try {
    await ensurePermanentEmailBansTable();
    const bans = await executeRawQuery(
      `SELECT normalized_email, reason, banned_at
       FROM permanent_email_bans
       ORDER BY banned_at DESC
       LIMIT ?`,
      [Math.min(Math.max(limit, 1), 1000)]
    );
    if (!bans.length) return [];

    const emails = bans.map((ban: any) => String(ban.normalized_email || "").trim().toLowerCase()).filter(Boolean);
    if (!emails.length) return [];
    const emailPlaceholders = emails.map(() => "?").join(", ");
    const accounts = await executeRawQuery(
      `SELECT LOWER(TRIM(u.email)) AS normalized_email,
              u.id, u.email, u.name, u.username, u.points, u.balance, u.created_at, u.device_id
       FROM users u
       WHERE LOWER(TRIM(u.email)) IN (${emailPlaceholders})
       ORDER BY u.id DESC`,
      emails
    );
    const userIds = Array.from(new Set(accounts.map((account: any) => Number(account.id))
      .filter((id: number) => Number.isInteger(id) && id > 0)));

    let bindings: any[] = [];
    if (userIds.length) {
      const userPlaceholders = userIds.map(() => "?").join(", ");
      bindings = await executeRawQuery(
        `SELECT LOWER(TRIM(email)) AS normalized_email, user_id, device_id, is_active
         FROM device_bindings
         WHERE LOWER(TRIM(email)) IN (${emailPlaceholders})
            OR user_id IN (${userPlaceholders})`,
        [...emails, ...userIds]
      );
    } else {
      bindings = await executeRawQuery(
        `SELECT LOWER(TRIM(email)) AS normalized_email, user_id, device_id, is_active
         FROM device_bindings
         WHERE LOWER(TRIM(email)) IN (${emailPlaceholders})`,
        emails
      );
    }

    const grouped = new Map<string, any>();
    for (const ban of bans) {
      const normalizedEmail = String(ban.normalized_email || "").trim().toLowerCase();
      grouped.set(normalizedEmail, {
        email: normalizedEmail,
        reason: ban.reason || "Sem motivo informado",
        bannedAt: ban.banned_at,
        accounts: [],
        devices: [],
      });
    }
    const deviceGroups = new Map<string, Map<string, boolean>>();
    for (const email of emails) deviceGroups.set(email, new Map());
    const addDevice = (email: string, deviceIdValue: unknown, active: unknown) => {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const deviceId = String(deviceIdValue || "").trim();
      if (!deviceId || !deviceGroups.has(normalizedEmail)) return;
      const devices = deviceGroups.get(normalizedEmail)!;
      const isActive = active === true || active === 1 || active === "1";
      devices.set(deviceId, Boolean(devices.get(deviceId) || isActive));
    };
    const emailByUserId = new Map<number, string>();

    for (const account of accounts) {
      const email = String(account.normalized_email || "").trim().toLowerCase();
      const group = grouped.get(email);
      if (!group) continue;
      const userId = Number(account.id);
      emailByUserId.set(userId, email);
      group.accounts.push({
        id: userId,
        email: account.email || email,
        name: account.name || "",
        username: account.username || "",
        points: Number(account.points || 0),
        balance: Number(account.balance || 0),
        createdAt: account.created_at || null,
        deviceId: account.device_id || null,
      });
      addDevice(email, account.device_id, true);
    }

    for (const binding of bindings) {
      const bindingEmail = String(binding.normalized_email || "").trim().toLowerCase();
      const email = grouped.has(bindingEmail)
        ? bindingEmail
        : emailByUserId.get(Number(binding.user_id)) || bindingEmail;
      addDevice(email, binding.device_id, binding.is_active);
    }

    return Array.from(grouped.values()).map(group => {
      const devices = Array.from(deviceGroups.get(group.email)?.entries() || [])
        .map(([id, active]) => ({ id, active }))
        .sort((a, b) => a.id.localeCompare(b.id));
      return {
        ...group,
        accountCount: group.accounts.length,
        deviceCount: devices.length,
        devices,
      };
    });
  } catch (error) {
    console.warn("[Railway DB] Error fetching permanent email bans:", error);
    return [];
  }
}

// ============= BANIR USUÁRIO PERMANENTEMENTE =============

export async function addUserDeviceToBlacklistByEmail(email: string, reason: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return {
      success: false as const,
      code: "BAD_REQUEST" as const,
      message: "Informe o e-mail da conta.",
    };
  }

  try {
    const pool = await getPool();
    if (!pool) throw new Error("Banco de dados indisponível.");

    const users = await executeRawQuery(
      `SELECT id, email, device_id FROM users WHERE LOWER(TRIM(email)) = ?`,
      [normalizedEmail]
    );
    if (users.length === 0) {
      return {
        success: false as const,
        code: "NOT_FOUND" as const,
        message: "Nenhuma conta encontrada com esse e-mail.",
      };
    }

    const userIds = users
      .map((user: any) => Number(user.id))
      .filter((userId: number) => Number.isInteger(userId) && userId > 0);
    if (userIds.length === 0) {
      return {
        success: false as const,
        code: "BAD_REQUEST" as const,
        message: "Não foi possível identificar os IDs das contas encontradas.",
      };
    }

    await ensurePermanentEmailBansTable();
    const existingBan = await executeRawQuery(
      `SELECT normalized_email FROM permanent_email_bans WHERE normalized_email = ? LIMIT 1`,
      [normalizedEmail]
    );
    if (existingBan.length === 0) {
      const rankingState = await executeRawQuery(
        `SELECT id, COALESCE(ranking_participant, 0) AS ranking_participant_before
         FROM users WHERE id IN (${userIds.map(() => "?").join(", ")})`,
        userIds
      );
      for (const state of rankingState) {
        await pool.query(
          `INSERT IGNORE INTO permanent_email_ban_user_state
             (normalized_email, user_id, ranking_participant_before)
           VALUES (?, ?, ?)`,
          [normalizedEmail, Number(state.id), Number(state.ranking_participant_before) === 1 ? 1 : 0]
        );
      }
      const savedStates = await executeRawQuery(
        `SELECT COUNT(DISTINCT user_id) AS saved_count
         FROM permanent_email_ban_user_state WHERE normalized_email = ?`,
        [normalizedEmail]
      );
      if (Number(savedStates[0]?.saved_count || 0) < userIds.length) {
        throw new Error("Não foi possível guardar o estado anterior do ranking.");
      }
    }
    await pool.query(
      `INSERT INTO permanent_email_bans (normalized_email, reason)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason)`,
      [normalizedEmail, reason.slice(0, 500)]
    );
    const confirmedBan = await executeRawQuery(
      `SELECT normalized_email FROM permanent_email_bans WHERE normalized_email = ? LIMIT 1`,
      [normalizedEmail]
    );
    if (confirmedBan.length === 0) {
      throw new Error("O banimento permanente não foi confirmado no banco.");
    }

    const placeholders = userIds.map(() => "?").join(", ");
    const bindings = await executeRawQuery(
      `SELECT DISTINCT device_id FROM device_bindings
       WHERE user_id IN (${placeholders}) OR LOWER(TRIM(email)) = ?`,
      [...userIds, normalizedEmail]
    );
    const deviceIds = Array.from(
      new Set([
        ...users.map((user: any) => String(user.device_id || "").trim()),
        ...bindings.map((binding: any) => String(binding.device_id || "").trim()),
      ].filter((deviceId: string) => deviceId.length > 0))
    );

    // Bloqueia ranking e sessões sem apagar pontos, saldo ou histórico.
    for (const userId of userIds) {
      try {
        await pool.query(`UPDATE users SET ranking_participant = 0 WHERE id = ?`, [userId]);
      } catch (error) {
        console.error("[Railway DB] Could not remove banned account from ranking:", error);
      }
      try {
        await pool.query(`UPDATE users SET token = ? WHERE id = ?`, [randomBytes(32).toString("hex"), userId]);
      } catch (error) {
        console.error("[Railway DB] Could not invalidate a banned account session:", error);
      }
    }

    let newlyBlockedDevices = 0;
    for (const deviceId of deviceIds) {
      try {
        const existing = await executeRawQuery(
          `SELECT id FROM device_blacklist WHERE device_id = ? LIMIT 1`,
          [deviceId]
        );
        if (existing.length > 0) continue;

        await pool.query(
          `INSERT INTO device_blacklist (device_id, reason, created_at) VALUES (?, ?, NOW())`,
          [deviceId, reason]
        );
        newlyBlockedDevices += 1;
      } catch (error) {
        console.error("[Railway DB] Could not blacklist a linked device:", error);
      }
    }

    return {
      success: true as const,
      permanent: true as const,
      email: normalizedEmail,
      matchedAccounts: users.length,
      matchedDevices: deviceIds.length,
      newlyBlockedDevices,
      userIds,
    };
  } catch (error) {
    console.error("[Railway DB] Error permanently banning account by email:", error);
    return {
      success: false as const,
      code: "INTERNAL_SERVER_ERROR" as const,
      message: "Não foi possível confirmar o banimento permanente da conta.",
    };
  }
}

export async function banUserByEmail(email: string, reason: string) {
  const result = await addUserDeviceToBlacklistByEmail(email, reason);
  if (!result.success) return result;

  await createAdminLog(
    "BAN_USER",
    `E-mail ${result.email}: ${result.matchedAccounts} conta(s), ` +
      `${result.matchedDevices} dispositivo(s) bloqueado(s). Motivo: ${reason}`
  );
  return result;
}

export async function unbanUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return {
      success: false as const,
      code: "BAD_REQUEST" as const,
      message: "Informe o e-mail da conta.",
    };
  }

  let connection: mysql.PoolConnection | null = null;
  let transactionStarted = false;
  try {
    const pool = await getPool();
    if (!pool) throw new Error("Banco de dados indisponível.");
    await ensurePermanentEmailBansTable();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [banRows] = await connection.query(
      `SELECT normalized_email FROM permanent_email_bans WHERE normalized_email = ? LIMIT 1 FOR UPDATE`,
      [normalizedEmail]
    );
    if (!(banRows as any[]).length) {
      await connection.rollback();
      transactionStarted = false;
      return {
        success: false as const,
        code: "NOT_FOUND" as const,
        message: "Não há um banimento ativo para esse e-mail.",
      };
    }

    const [usersRaw] = await connection.query(
      `SELECT id, device_id FROM users WHERE LOWER(TRIM(email)) = ? FOR UPDATE`,
      [normalizedEmail]
    );
    const users = usersRaw as any[];
    const userIds = users.map(user => Number(user.id)).filter(id => Number.isInteger(id) && id > 0);
    const bindingQuery = userIds.length
      ? `SELECT DISTINCT device_id FROM device_bindings
         WHERE user_id IN (${userIds.map(() => "?").join(", ")}) OR LOWER(TRIM(email)) = ? FOR UPDATE`
      : `SELECT DISTINCT device_id FROM device_bindings WHERE LOWER(TRIM(email)) = ? FOR UPDATE`;
    const bindingParams = userIds.length ? [...userIds, normalizedEmail] : [normalizedEmail];
    const [bindingRows] = await connection.query(bindingQuery, bindingParams);
    const bindings = bindingRows as any[];
    const deviceIds = Array.from(new Set([
      ...users.map(user => String(user.device_id || "").trim()),
      ...bindings.map(binding => String(binding.device_id || "").trim()),
    ].filter((deviceId: string) => deviceId.length > 0)));

    const [stateRows] = await connection.query(
      `SELECT user_id, ranking_participant_before
       FROM permanent_email_ban_user_state WHERE normalized_email = ? FOR UPDATE`,
      [normalizedEmail]
    );
    const previousRankingState = new Map<number, number>(
      (stateRows as any[]).map((row): [number, number] => [
        Number(row.user_id),
        Number(row.ranking_participant_before) === 1 ? 1 : 0,
      ])
    );

    // Restaura a participação anterior; para banimentos antigos sem snapshot, reativa a participação.
    for (const userId of userIds) {
      const previousValue = previousRankingState.has(userId) ? previousRankingState.get(userId)! : 1;
      await connection.query(`UPDATE users SET ranking_participant = ? WHERE id = ?`, [previousValue, userId]);
    }

    let removedDevices = 0;
    for (const deviceId of deviceIds) {
      const [otherUserBans] = await connection.query(
        `SELECT 1
         FROM users u
         INNER JOIN permanent_email_bans peb
           ON peb.normalized_email = LOWER(TRIM(u.email)) COLLATE utf8mb4_bin
         WHERE BINARY u.device_id = BINARY ?
           AND peb.normalized_email <> ?
         LIMIT 1`,
        [deviceId, normalizedEmail]
      );
      const [otherBindingBans] = await connection.query(
        `SELECT 1
         FROM device_bindings db
         LEFT JOIN users u ON u.id = db.user_id
         INNER JOIN permanent_email_bans peb
           ON peb.normalized_email = LOWER(TRIM(COALESCE(NULLIF(db.email, ''), u.email))) COLLATE utf8mb4_bin
         WHERE BINARY db.device_id = BINARY ?
           AND peb.normalized_email <> ?
         LIMIT 1`,
        [deviceId, normalizedEmail]
      );
      if ((otherUserBans as any[]).length > 0 || (otherBindingBans as any[]).length > 0) continue;

      const [deleteResult] = await connection.query(
        `DELETE FROM device_blacklist WHERE BINARY device_id = BINARY ?`,
        [deviceId]
      );
      removedDevices += Number((deleteResult as any).affectedRows || 0);
    }

    // Remova o snapshot e, por último, o e-mail banido. Pontos, saldo, históricos e saques nunca são alterados.
    await connection.query(
      `DELETE FROM permanent_email_ban_user_state WHERE normalized_email = ?`,
      [normalizedEmail]
    );
    await connection.query(
      `DELETE FROM permanent_email_bans WHERE normalized_email = ?`,
      [normalizedEmail]
    );
    await connection.commit();
    transactionStarted = false;

    return {
      success: true as const,
      email: normalizedEmail,
      matchedAccounts: users.length,
      removedDevices,
    };
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("[Railway DB] Error rolling back email unban:", rollbackError);
      }
    }
    console.error("[Railway DB] Error unbanning account by email:", error);
    return {
      success: false as const,
      code: "INTERNAL_SERVER_ERROR" as const,
      message: "Não foi possível remover o banimento dessa conta.",
    };
  } finally {
    connection?.release();
  }
}

export async function deleteAllUsers() {
  try {
    // Primeiro conta quantos usuários serão excluídos
    const countResult = await executeRawQuery(`SELECT COUNT(*) as count FROM users`);
    const count = countResult[0]?.count || 0;
    
    // Exclui todos os registros relacionados primeiro (para evitar erros de foreign key)
    await executeRawQuery(`DELETE FROM withdrawals`);
    await executeRawQuery(`DELETE FROM point_transactions`);
    await executeRawQuery(`DELETE FROM referrals`);
    await executeRawQuery(`DELETE FROM daily_tasks`);
    
    // Exclui todos os usuários
    await executeRawQuery(`DELETE FROM users`);
    
    console.log(`[Railway DB] Deleted all users. Count: ${count}`);
    return { success: true, count };
  } catch (error) {
    console.error("[Railway DB] Error deleting all users:", error);
    return { success: false, count: 0 };
  }
}


// ============= HISTÓRICO DE PONTOS DO USUÁRIO =============

export async function getUserPointsHistory(userId: number, limit = 100, selectedDate?: string) {
  try {
    const rows = await executeRawQuery(
      `SELECT *,
              DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '-03:00'), '%Y-%m-%d') as history_date
       FROM points_history 
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC`,
      [userId]
    );

    const totalPointsEarned = rows.reduce((total: number, row: any) => {
      const rawValue = Number(row?.points ?? row?.amount ?? 0);
      return rawValue > 0 ? total + rawValue : total;
    }, 0);

    const dailySummariesMap = rows.reduce((acc: Map<string, { date: string; totalPoints: number; entryCount: number }>, row: any) => {
      const dateKey = row?.history_date || new Date(row?.created_at || Date.now()).toISOString().slice(0, 10);
      const rawValue = Number(row?.points ?? row?.amount ?? 0);
      const current = acc.get(dateKey) || { date: dateKey, totalPoints: 0, entryCount: 0 };

      current.entryCount += 1;
      if (rawValue > 0) {
        current.totalPoints += rawValue;
      }

      acc.set(dateKey, current);
      return acc;
    }, new Map<string, { date: string; totalPoints: number; entryCount: number }>());

    const dailySummaries = Array.from(dailySummariesMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    const dailyTotalsByDate = dailySummaries.reduce((acc: Record<string, number>, item) => {
      acc[item.date] = item.totalPoints;
      return acc;
    }, {});

    const filteredRows = selectedDate
      ? rows.filter((row: any) => row?.history_date === selectedDate)
      : rows;
    const normalizedRows = typeof limit === 'number' && limit > 0 ? filteredRows.slice(0, limit) : filteredRows;
    const activeReferenceDate = selectedDate || dailySummaries[0]?.date || new Date().toISOString().slice(0, 10);

    return {
      referenceDate: activeReferenceDate,
      dailyTotal: dailyTotalsByDate[activeReferenceDate] ?? 0,
      totalEntries: filteredRows.length,
      totalEntriesAll: rows.length,
      totalDays: dailySummaries.length,
      totalPointsEarned,
      selectedDate: selectedDate || null,
      dailySummaries,
      dailyTotalsByDate,
      entries: normalizedRows,
    };
  } catch (error) {
    console.warn("[Railway DB] Error fetching user points history:", error);
    return {
      referenceDate: selectedDate ?? new Date().toISOString().slice(0, 10),
      dailyTotal: 0,
      totalEntries: 0,
      totalEntriesAll: 0,
      totalDays: 0,
      totalPointsEarned: 0,
      selectedDate: selectedDate || null,
      dailySummaries: [],
      dailyTotalsByDate: {},
      entries: [],
    };
  }
}


// ============= USUÁRIOS ONLINE =============

export async function getOnlineUsersCount(minutesThreshold = 5) {
  try {
    const rows = await executeRawQuery(
      `SELECT COUNT(*) as online_count 
       FROM users 
       WHERE updated_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [minutesThreshold]
    );
    return rows[0]?.online_count || 0;
  } catch (error) {
    console.warn("[Railway DB] Error counting online users:", error);
    return 0;
  }
}

export async function getOnlineUsers(minutesThreshold = 5, limit = 100) {
  try {
    const rows = await executeRawQuery(
      `SELECT id, name, email, username, photo_url, profile_picture, updated_at
       FROM users 
       WHERE updated_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
       ORDER BY updated_at DESC
       LIMIT ?`,
      [minutesThreshold, limit]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching online users:", error);
    return [];
  }
}

export async function getOnlineUsersStats(minutesThreshold = 5) {
  try {
    // Usuários online agora
    const onlineRows = await executeRawQuery(
      `SELECT COUNT(*) as count 
       FROM users 
       WHERE updated_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [minutesThreshold]
    );
    
    // Usuários ativos hoje
    const todayRows = await executeRawQuery(
      `SELECT COUNT(*) as count 
       FROM users 
       WHERE DATE(updated_at) = CURDATE()`
    );
    
    // Usuários ativos na última hora
    const hourRows = await executeRawQuery(
      `SELECT COUNT(*) as count 
       FROM users 
       WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`
    );
    
    return {
      onlineNow: onlineRows[0]?.count || 0,
      activeToday: todayRows[0]?.count || 0,
      activeLastHour: hourRows[0]?.count || 0,
      thresholdMinutes: minutesThreshold
    };
  } catch (error) {
    console.warn("[Railway DB] Error fetching online users stats:", error);
    return {
      onlineNow: 0,
      activeToday: 0,
      activeLastHour: 0,
      thresholdMinutes: minutesThreshold
    };
  }
}

// ============= DISPOSITIVOS VINCULADOS (device_bindings) =============

/**
 * Lista dispositivos ativos e inativos, com paginação e busca.
 * Manter o histórico visível permite localizar e liberar aparelhos antigos.
 */
export async function getDeviceBindings(limit = 50, offset = 0, search?: string) {
  try {
    let where = "WHERE 1 = 1";
    let params: any[] = [];

    if (search) {
      where += " AND (u.name LIKE ? OR u.email LIKE ? OR db.device_id LIKE ? OR db.model LIKE ?)";
      const s = `%${search}%`;
      params = [s, s, s, s];
    }

    // Count total
    const countRows = await executeRawQuery(
      `SELECT COUNT(*) as total FROM device_bindings db LEFT JOIN users u ON db.user_id = u.id ${where}`,
      params
    );
    const total = countRows[0]?.total || 0;

    // Fetch page
    const rows = await executeRawQuery(
      `SELECT db.id as binding_id, db.user_id, db.email, db.device_id, db.model,
              db.android_version, db.fingerprint, db.ip_address, db.is_active,
              db.created_at, db.last_seen,
              u.name as user_name, u.profile_picture, u.photo_url
       FROM device_bindings db
       LEFT JOIN users u ON db.user_id = u.id
       ${where}
       ORDER BY db.is_active DESC, db.last_seen DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { devices: rows, total };
  } catch (error) {
    console.warn("[Railway DB] Error fetching device bindings:", error);
    return { devices: [], total: 0 };
  }
}

/**
 * Lista dispositivos vinculados de um usuário específico
 */
export async function getUserDeviceBindings(userId: number) {
  try {
    const rows = await executeRawQuery(
      `SELECT id as binding_id, user_id, email, device_id, model,
              android_version, fingerprint, ip_address, is_active,
              created_at, last_seen
       FROM device_bindings
       WHERE user_id = ?
       ORDER BY is_active DESC, last_seen DESC`,
      [userId]
    );
    return rows;
  } catch (error) {
    console.warn("[Railway DB] Error fetching user device bindings:", error);
    return [];
  }
}

/**
 * Exclui somente o vínculo selecionado. IDs legados e fingerprints podem
 * colidir entre aparelhos; eliminar registros semelhantes atingiria terceiros.
 */
export async function unlinkDeviceByBindingId(
  bindingId: number
): Promise<{ success: boolean; affected: number }> {
  const pool = await getPool();
  if (!pool) return { success: false, affected: 0 };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT id
       FROM device_bindings
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [bindingId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return { success: false, affected: 0 };
    }

    const [result] = await connection.query<mysql.ResultSetHeader>(
      `DELETE FROM device_bindings WHERE id = ?`,
      [bindingId]
    );

    await connection.commit();
    return { success: true, affected: result.affectedRows };
  } catch (error) {
    await connection.rollback();
    console.warn("[Railway DB] Error deleting device identity:", error);
    return { success: false, affected: 0 };
  } finally {
    connection.release();
  }
}

/**
 * Reseta completamente a conta removendo todos os vínculos de aparelhos,
 * inclusive o histórico inativo. Após a exclusão, o usuário fica sem device
 * associado e poderá vincular novamente no próximo login.
 */
export async function unlinkAllUserDevices(
  userId: number
): Promise<{ success: boolean; affected: number }> {
  const pool = await getPool();
  if (!pool) return { success: false, affected: 0 };

  try {
    const [result] = await pool.query<mysql.ResultSetHeader>(
      `DELETE FROM device_bindings WHERE user_id = ?`,
      [userId]
    );
    return { success: true, affected: result.affectedRows };
  } catch (error) {
    console.warn("[Railway DB] Error resetting user device bindings:", error);
    return { success: false, affected: 0 };
  }
}

/**
 * RESET GLOBAL: remove TODOS os vínculos de dispositivos de TODOS os usuários,
 * incluindo ativos e inativos. Retorna quantos registros foram excluídos.
 */
export async function unlinkAllDevicesGlobal(): Promise<{ success: boolean; affected: number }> {
  const pool = await getPool();
  if (!pool) return { success: false, affected: 0 };

  try {
    const [result] = await pool.query<mysql.ResultSetHeader>(
      `DELETE FROM device_bindings`
    );
    return { success: true, affected: result.affectedRows };
  } catch (error) {
    console.warn("[Railway DB] Error deleting ALL device bindings (global reset):", error);
    return { success: false, affected: 0 };
  }
}

/**
 * Conta dispositivos ativos vinculados
 */
export async function getDeviceBindingsStats() {
  try {
    const totalActive = await executeRawQuery(
      `SELECT COUNT(*) as count FROM device_bindings WHERE is_active = 1`
    );
    const totalInactive = await executeRawQuery(
      `SELECT COUNT(*) as count FROM device_bindings WHERE is_active = 0`
    );
    const uniqueUsers = await executeRawQuery(
      `SELECT COUNT(DISTINCT user_id) as count FROM device_bindings WHERE is_active = 1`
    );
    return {
      active: totalActive[0]?.count || 0,
      inactive: totalInactive[0]?.count || 0,
      uniqueUsers: uniqueUsers[0]?.count || 0,
    };
  } catch (error) {
    console.warn("[Railway DB] Error fetching device bindings stats:", error);
    return { active: 0, inactive: 0, uniqueUsers: 0 };
  }
}

// ============= LUCKY POPUP =============

// Garante que as tabelas existam (rápido, síncrono)
async function lpEnsureTables(): Promise<void> {
  await executeRawQuery(`
    CREATE TABLE IF NOT EXISTS lucky_popup_slots (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      user_id     INT NOT NULL,
      slot_date   DATE NOT NULL,
      slot_time   TIME NOT NULL,
      base_points INT NOT NULL DEFAULT 0,
      claimed     TINYINT(1) NOT NULL DEFAULT 0,
      doubled     TINYINT(1) NOT NULL DEFAULT 0,
      ssv_token   VARCHAR(64) DEFAULT NULL,
      claimed_at  DATETIME DEFAULT NULL,
      INDEX idx_user_date (user_id, slot_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await executeRawQuery(`
    CREATE TABLE IF NOT EXISTS lucky_popup_doubles (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      user_id     INT NOT NULL,
      double_date DATE NOT NULL,
      count       INT NOT NULL DEFAULT 0,
      UNIQUE KEY uq_user_date (user_id, double_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

// Mutex por data para evitar geração paralela de slots
const _lpGenerating = new Set<string>();

// Gera slots em background (não bloqueia a resposta da API)
function lpGenerateSlotsBackground(date: string): void {
  // Evitar execuções paralelas para a mesma data
  if (_lpGenerating.has(date)) return;
  _lpGenerating.add(date);

  setImmediate(async () => {
    try {
      const usersWithoutSlots = await executeRawQuery(`
        SELECT id FROM users
        WHERE id NOT IN (
          SELECT DISTINCT user_id FROM lucky_popup_slots WHERE slot_date = ?
        )
        ORDER BY id ASC
        LIMIT 500
      `, [date]);

      if (usersWithoutSlots.length === 0) return;

      const LP_POPUPS_PER_DAY = 20;
      const LP_MIN_POINTS = 1000;
      const LP_MAX_POINTS = 3000;
      const LP_MIN_GAP = 30;
      const startMinute = 6 * 60;
      const endMinute = 23 * 60;
      const range = endMinute - startMinute;

      for (const userRow of usersWithoutSlots) {
        const userId = Number(userRow.id);

        // Verificar novamente se este usuário já tem slots (pode ter sido inserido por outra instância)
        const existing = await executeRawQuery(
          `SELECT COUNT(*) AS cnt FROM lucky_popup_slots WHERE user_id = ? AND slot_date = ?`,
          [userId, date]
        );
        if (Number(existing[0]?.cnt ?? 0) >= LP_POPUPS_PER_DAY) continue;

        const minutes: number[] = [];
        let attempts = 0;
        while (minutes.length < LP_POPUPS_PER_DAY && attempts < 2000) {
          attempts++;
          const candidate = startMinute + Math.floor(Math.random() * range);
          const tooClose = minutes.some(m => Math.abs(m - candidate) < LP_MIN_GAP);
          if (!tooClose) minutes.push(candidate);
        }
        minutes.sort((a, b) => a - b);

        // Batch INSERT para todos os slots do usuário de uma vez
        const values: any[] = [];
        const placeholders: string[] = [];
        for (const m of minutes) {
          const h = Math.floor(m / 60).toString().padStart(2, '0');
          const min = (m % 60).toString().padStart(2, '0');
          const time = `${h}:${min}:00`;
          const points = LP_MIN_POINTS + Math.floor(Math.random() * (LP_MAX_POINTS - LP_MIN_POINTS + 1));
          placeholders.push('(?, ?, ?, ?)');
          values.push(userId, date, time, points);
        }
        if (placeholders.length > 0) {
          await executeRawQuery(
            `INSERT IGNORE INTO lucky_popup_slots (user_id, slot_date, slot_time, base_points) VALUES ${placeholders.join(', ')}`,
            values
          );
        }
      }
    } catch (e) {
      console.warn('[Lucky Popup] Background slot generation error:', e);
    } finally {
      _lpGenerating.delete(date);
    }
  });
}

export async function getLuckyPopupStats(date: string) {
  try {
    await lpEnsureTables();
    lpGenerateSlotsBackground(date);
    const rows = await executeRawQuery(`
      SELECT
        COUNT(*)                                               AS total_slots,
        SUM(claimed = 1)                                       AS total_claimed,
        SUM(claimed = 0)                                       AS total_pending,
        SUM(doubled = 1)                                       AS total_doubled,
        COUNT(DISTINCT user_id)                                AS unique_users,
        SUM(CASE WHEN claimed=1 AND doubled=0 THEN base_points ELSE 0 END) AS pts_base,
        SUM(CASE WHEN doubled=1 THEN base_points*2 ELSE 0 END)             AS pts_doubled,
        ROUND(AVG(base_points), 0)                             AS avg_base_points
      FROM lucky_popup_slots
      WHERE slot_date = ?
    `, [date]);
    const r = rows[0] || {};
    const doublesRows = await executeRawQuery(
      `SELECT COALESCE(SUM(count),0) AS total FROM lucky_popup_doubles WHERE double_date = ?`,
      [date]
    );
    return {
      total_slots: Number(r.total_slots ?? 0),
      total_claimed: Number(r.total_claimed ?? 0),
      total_pending: Number(r.total_pending ?? 0),
      total_doubled: Number(r.total_doubled ?? 0),
      unique_users: Number(r.unique_users ?? 0),
      pts_base: Number(r.pts_base ?? 0),
      pts_doubled: Number(r.pts_doubled ?? 0),
      avg_base_points: Number(r.avg_base_points ?? 0),
      total_doubles_used: Number(doublesRows[0]?.total ?? 0),
    };
  } catch (e) {
    console.warn('[Railway DB] getLuckyPopupStats error:', e);
    return null;
  }
}

export async function getLuckyPopupUserList(date: string) {
  try {
    await lpEnsureTables();
    return await executeRawQuery(`
      SELECT
        s.user_id,
        u.name  AS user_name,
        u.email AS user_email,
        COUNT(*) AS total_slots,
        SUM(s.claimed=1) AS claimed,
        SUM(s.claimed=0) AS pending,
        SUM(s.doubled=1) AS doubled,
        SUM(CASE WHEN s.claimed=1 AND s.doubled=0 THEN s.base_points ELSE 0 END) AS pts_base,
        SUM(CASE WHEN s.doubled=1 THEN s.base_points*2 ELSE 0 END)               AS pts_doubled,
        MIN(s.slot_time) AS first_slot,
        MAX(s.slot_time) AS last_slot,
        COALESCE(d.count,0) AS doubles_used
      FROM lucky_popup_slots s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN lucky_popup_doubles d ON d.user_id=s.user_id AND d.double_date=s.slot_date
      WHERE s.slot_date = ?
      GROUP BY s.user_id, u.name, u.email, d.count
      ORDER BY s.user_id ASC
    `, [date]);
  } catch (e) {
    console.warn('[Railway DB] getLuckyPopupUserList error:', e);
    return [];
  }
}

export async function getLuckyPopupUserSlots(userId: number, date: string) {
  try {
    return await executeRawQuery(`
      SELECT
        s.id, s.user_id, u.name AS user_name, u.email AS user_email,
        s.slot_date, s.slot_time, s.base_points,
        s.claimed, s.doubled, s.claimed_at,
        COALESCE(d.count,0) AS doubles_used
      FROM lucky_popup_slots s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN lucky_popup_doubles d ON d.user_id=s.user_id AND d.double_date=s.slot_date
      WHERE s.user_id=? AND s.slot_date=?
      ORDER BY s.slot_time ASC
    `, [userId, date]);
  } catch (e) {
    console.warn('[Railway DB] getLuckyPopupUserSlots error:', e);
    return [];
  }
}

/**
 * Remove slots excedentes para uma data, mantendo apenas os 20 primeiros
 * (por slot_time ASC) de cada usuário. Slots já resgatados nunca são removidos.
 */
export async function cleanExcessLuckyPopupSlots(date: string): Promise<number> {
  try {
    const LP_POPUPS_PER_DAY = 20;

    // Buscar usuários com mais de LP_POPUPS_PER_DAY slots não resgatados
    const users = await executeRawQuery(`
      SELECT user_id, COUNT(*) AS cnt
      FROM lucky_popup_slots
      WHERE slot_date = ? AND claimed = 0
      GROUP BY user_id
      HAVING cnt > ?
    `, [date, LP_POPUPS_PER_DAY]);

    let totalDeleted = 0;

    for (const row of users) {
      const userId = Number(row.user_id);

      // Buscar os IDs dos 20 primeiros slots não resgatados (que devem ser mantidos)
      const keep = await executeRawQuery(`
        SELECT id FROM lucky_popup_slots
        WHERE user_id = ? AND slot_date = ? AND claimed = 0
        ORDER BY slot_time ASC
        LIMIT ?
      `, [userId, date, LP_POPUPS_PER_DAY]);

      if (keep.length === 0) continue;

      const keepIds = keep.map((r: any) => Number(r.id));
      const placeholders = keepIds.map(() => '?').join(', ');

      const result = await executeRawQuery(`
        DELETE FROM lucky_popup_slots
        WHERE user_id = ? AND slot_date = ? AND claimed = 0
          AND id NOT IN (${placeholders})
      `, [userId, date, ...keepIds]);

      totalDeleted += Number((result as any)?.affectedRows ?? 0);
    }

    return totalDeleted;
  } catch (e) {
    console.warn('[Lucky Popup] cleanExcessSlots error:', e);
    return 0;
  }
}

/**
 * Simula exatamente o GET /lucky_popup.php para um usuário específico.
 * Gera slots se não existirem, retorna o próximo slot disponível e todos os slots do dia.
 */
export async function testUserLuckyPopup(email: string, date: string, resetUser = false): Promise<{
  user: { id: number; name: string; email: string } | null;
  slotsExisted: number;
  slotsGenerated: number;
  resetDone: number;
  allSlots: any[];
  appResponse: any;
  nowTime: string;
  status: string;
}> {
  const LP_POPUPS_PER_DAY = 20;
  const LP_MIN_POINTS = 1000;
  const LP_MAX_POINTS = 3000;
  const LP_MAX_DOUBLES = 4;
  const LP_MIN_GAP = 30;

  // Hora atual em BRT
  const nowBRT = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
  const nowTime = nowBRT.substring(0, 8); // HH:MM:SS

  // Buscar usuário
  const users = await executeRawQuery(`SELECT id, name, email FROM users WHERE email = ? LIMIT 1`, [email]);
  if (!users || users.length === 0) {
    return { user: null, slotsExisted: 0, slotsGenerated: 0, resetDone: 0, allSlots: [], appResponse: { error: 'usuario_nao_encontrado' }, nowTime, status: 'ERRO' };
  }
  const user = { id: Number(users[0].id), name: String(users[0].name), email: String(users[0].email) };

  // Reset se solicitado
  let resetDone = 0;
  if (resetUser) {
    const res = await executeRawQuery(`DELETE FROM lucky_popup_slots WHERE user_id = ? AND slot_date = ? AND claimed = 0`, [user.id, date]);
    resetDone = Number((res as any)?.affectedRows ?? 0);
  }

  // Verificar slots existentes
  const countRes = await executeRawQuery(`SELECT COUNT(*) AS cnt FROM lucky_popup_slots WHERE user_id = ? AND slot_date = ?`, [user.id, date]);
  const slotsExisted = Number(countRes[0]?.cnt ?? 0);
  let slotsGenerated = 0;

  // Gerar slots se não existirem (replicar lpEnsureDailySlots)
  if (slotsExisted === 0) {
    const startMinute = 6 * 60;
    const endMinute = 23 * 60;
    const range = endMinute - startMinute;
    const minutes: number[] = [];
    let attempts = 0;
    while (minutes.length < LP_POPUPS_PER_DAY && attempts < 1000) {
      attempts++;
      const candidate = startMinute + Math.floor(Math.random() * range);
      const tooClose = minutes.some(m => Math.abs(m - candidate) < LP_MIN_GAP);
      if (!tooClose) minutes.push(candidate);
    }
    minutes.sort((a, b) => a - b);

    for (const m of minutes) {
      const h = Math.floor(m / 60).toString().padStart(2, '0');
      const min = (m % 60).toString().padStart(2, '0');
      const time = `${h}:${min}:00`;
      const points = LP_MIN_POINTS + Math.floor(Math.random() * (LP_MAX_POINTS - LP_MIN_POINTS + 1));
      await executeRawQuery(
        `INSERT INTO lucky_popup_slots (user_id, slot_date, slot_time, base_points) VALUES (?, ?, ?, ?)`,
        [user.id, date, time, points]
      );
      slotsGenerated++;
    }
  }

  // Próximo slot disponível (replicar lpNextAvailableSlot)
  const slotRes = await executeRawQuery(`
    SELECT id, slot_time, base_points FROM lucky_popup_slots
    WHERE user_id = ? AND slot_date = ? AND slot_time <= ? AND claimed = 0
    ORDER BY slot_time ASC LIMIT 1
  `, [user.id, date, nowTime]);
  const slot = slotRes[0] ?? null;

  // Dobramentos usados
  const doublesRes = await executeRawQuery(`SELECT COALESCE(count, 0) AS used FROM lucky_popup_doubles WHERE user_id = ? AND double_date = ?`, [user.id, date]);
  const doublesUsed = Number(doublesRes[0]?.used ?? 0);

  // Próximo slot futuro
  const nextRes = await executeRawQuery(`
    SELECT slot_time FROM lucky_popup_slots
    WHERE user_id = ? AND slot_date = ? AND claimed = 0
    ORDER BY slot_time ASC LIMIT 1
  `, [user.id, date]);
  const nextSlot = nextRes[0] ?? null;

  // Todos os slots do dia
  const allSlots = await executeRawQuery(`
    SELECT slot_time, base_points, claimed, claimed_at FROM lucky_popup_slots
    WHERE user_id = ? AND slot_date = ? ORDER BY slot_time ASC
  `, [user.id, date]);

  // Resposta idêntica ao app
  const appResponse = slot === null
    ? { success: true, popup: null, next_slot_at: nextSlot ? String(nextSlot.slot_time).substring(0, 5) : null, doubles_used: doublesUsed, doubles_max: LP_MAX_DOUBLES }
    : { success: true, popup: { slot_id: Number(slot.id), base_points: Number(slot.base_points), can_double: doublesUsed < LP_MAX_DOUBLES }, doubles_used: doublesUsed, doubles_max: LP_MAX_DOUBLES };

  const status = slot ? 'POPUP_DISPONIVEL_AGORA' : 'SEM_POPUP_AGORA';

  return { user, slotsExisted, slotsGenerated, resetDone, allSlots, appResponse, nowTime, status };
}

/**
 * Força um popup para o usuário inserindo um slot com o horário atual (BRT).
 * O próximo poll do app (até 1 min) vai encontrar esse slot e exibir o popup.
 */
export async function forcePopupNow(email: string, date: string): Promise<{
  success: boolean;
  error?: string;
  user?: { id: number; name: string; email: string };
  slot?: { id: number; slot_time: string; base_points: number };
  message: string;
}> {
  const LP_MIN_POINTS = 1000;
  const LP_MAX_POINTS = 3000;
  const pool = await getPool();
  if (!pool) {
    return { success: false, error: 'database_unavailable', message: 'Conexão com o banco indisponível; o popup não foi criado.' };
  }

  // Hora atual em BRT (ex: "18:42:00")
  const nowBRT = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
  const nowTime = nowBRT.substring(0, 8); // HH:MM:SS

  try {
    await lpEnsureTables();

    // Usar o pool diretamente: executeRawQuery engole erros e podia retornar sucesso falso.
    const [userRows] = await pool.query(
      `SELECT id, name, email FROM users WHERE email = ? ORDER BY id DESC LIMIT 1`,
      [email]
    );
    const userRow = (userRows as any[])[0];
    if (!userRow) {
      return { success: false, error: 'usuario_nao_encontrado', message: `Usuário "${email}" não encontrado.` };
    }
    const user = { id: Number(userRow.id), name: String(userRow.name), email: String(userRow.email) };

    // Reutilizar um slot já disponível para evitar criar recompensas duplicadas.
    const [existingRows] = await pool.query(
      `SELECT id, slot_time, base_points FROM lucky_popup_slots WHERE user_id = ? AND slot_date = ? AND slot_time <= ? AND claimed = 0 ORDER BY slot_time ASC LIMIT 1`,
      [user.id, date, nowTime]
    );
    const existing = (existingRows as any[])[0];
    if (existing) {
      return {
        success: true,
        user,
        slot: { id: Number(existing.id), slot_time: String(existing.slot_time), base_points: Number(existing.base_points) },
        message: `Já havia um popup disponível às ${String(existing.slot_time).substring(0, 5)}. O app deve exibi-lo no próximo ciclo de consulta.`,
      };
    }

    const points = LP_MIN_POINTS + Math.floor(Math.random() * (LP_MAX_POINTS - LP_MIN_POINTS + 1));
    const [insertResult] = await pool.query(
      `INSERT INTO lucky_popup_slots (user_id, slot_date, slot_time, base_points) VALUES (?, ?, ?, ?)`,
      [user.id, date, nowTime, points]
    );
    const insertId = Number((insertResult as any)?.insertId ?? 0);
    if (insertId <= 0) {
      return { success: false, error: 'slot_not_saved', message: 'O banco não confirmou a gravação do popup; nenhum sucesso foi registrado.' };
    }

    const [savedRows] = await pool.query(
      `SELECT id, slot_time, base_points FROM lucky_popup_slots WHERE id = ? AND user_id = ? AND slot_date = ? AND claimed = 0 LIMIT 1`,
      [insertId, user.id, date]
    );
    const saved = (savedRows as any[])[0];
    if (!saved) {
      return { success: false, error: 'slot_not_verified', message: 'O slot foi enviado ao banco, mas não pôde ser confirmado; tente novamente.' };
    }

    return {
      success: true,
      user,
      slot: { id: Number(saved.id), slot_time: String(saved.slot_time), base_points: Number(saved.base_points) },
      message: `Popup confirmado para ${nowTime.substring(0, 5)} com ${points} pts. O app deve exibi-lo no próximo ciclo de consulta.`,
    };
  } catch (error) {
    console.error('[Lucky Popup] forcePopupNow failed:', error);
    return { success: false, error: 'slot_creation_failed', message: 'Não foi possível gravar o popup no banco. Consulte os logs do painel.' };
  }
}
