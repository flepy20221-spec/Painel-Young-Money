import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { taskProgressRouter } from "./taskProgressRouter";
import { publicProcedure, adminProcedure, router, taskAdminProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as railwayDb from "./railwayDb";
import { createTaskDefinition, listTaskDefinitions, updateTaskDefinition } from "./taskDefinitions";
import { uploadTaskIcon } from "./taskIcons";
import { youngMoneyApi } from "./youngmoneyApi";
import { normalizePixKeyType, pixApi } from "./pixApi";
import { notifyNewPendingWithdrawals } from "./discord";

export const appRouter = router({
  system: systemRouter,
  taskProgress: taskProgressRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============= DASHBOARD =============
  dashboard: router({
    stats: adminProcedure.query(async () => {
      const stats = await railwayDb.getRailwayDashboardStats();
      return stats;
    }),
  }),

  // ============= APP USERS =============
  appUsers: router({
    rewardsList: adminProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(50).default(8),
        offset: z.number().int().min(0).default(0),
        search: z.string().max(320).default(''),
      }))
      .query(({ input }) => railwayDb.getRewardUsersPage(input.limit, input.offset, input.search)),

    list: adminProcedure
      .input(z.object({
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
        search: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const users = await railwayDb.getAllRailwayUsers(input.limit, input.offset);
        const total = await railwayDb.getRailwayUserCount();
        return { users, total };
      }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const user = await railwayDb.getRailwayUserById(input.id);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
        }
        return user;
      }),

    updatePoints: adminProcedure
      .input(z.object({
        id: z.number(),
        points: z.number(),
        operation: z.enum(['add', 'subtract', 'set']).optional().default('set'),
      }))
      .mutation(async ({ input }) => {
        await railwayDb.updateUserPoints(input.id, input.points, input.operation);
        await railwayDb.createAdminLog('UPDATE_POINTS', `Pontos do usuário ${input.id} atualizados: ${input.operation} ${input.points}`);
        return { success: true };
      }),

    updateBalance: adminProcedure
      .input(z.object({
        id: z.number(),
        balance: z.number(),
      }))
      .mutation(async ({ input }) => {
        await railwayDb.updateRailwayUserBalance(input.id, input.balance);
        await railwayDb.createAdminLog('UPDATE_BALANCE', `Saldo do usuário ${input.id} atualizado para ${input.balance}`);
        return { success: true };
      }),

    ban: adminProcedure
      .input(z.object({
        email: z.string().trim().email(),
        reason: z.string().trim().min(1).max(500),
      }))
      .mutation(async ({ input }) => {
        const result = await railwayDb.banUserByEmail(input.email, input.reason);
        if (!result.success) {
          throw new TRPCError({
            code: result.code,
            message: result.message,
          });
        }
        return {
          success: true,
          matchedAccounts: result.matchedAccounts,
          matchedDevices: result.matchedDevices,
          newlyBlockedDevices: result.newlyBlockedDevices,
        };
      }),

    deleteAll: adminProcedure
      .input(z.object({
        confirmText: z.string(),
      }))
      .mutation(async ({ input }) => {
        if (input.confirmText !== 'EXCLUIR TODOS') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Texto de confirmação incorreto' });
        }
        const result = await railwayDb.deleteAllUsers();
        await railwayDb.createAdminLog('DELETE_ALL_USERS', `Todos os usuários foram excluídos. Total: ${result.count}`);
        return { success: true, count: result.count };
      }),

    // Endpoint para contar usuários online
    onlineCount: adminProcedure
      .input(z.object({
        minutesThreshold: z.number().optional().default(5),
      }))
      .query(async ({ input }) => {
        const count = await railwayDb.getOnlineUsersCount(input.minutesThreshold);
        return { count, thresholdMinutes: input.minutesThreshold };
      }),

    // Endpoint para estatísticas de usuários online
    onlineStats: adminProcedure
      .input(z.object({
        minutesThreshold: z.number().optional().default(5),
      }))
      .query(async ({ input }) => {
        const stats = await railwayDb.getOnlineUsersStats(input.minutesThreshold);
        return stats;
      }),

    // Endpoint para listar usuários online
    onlineList: adminProcedure
      .input(z.object({
        minutesThreshold: z.number().optional().default(5),
        limit: z.number().optional().default(100),
      }))
      .query(async ({ input }) => {
        const users = await railwayDb.getOnlineUsers(input.minutesThreshold, input.limit);
        return users;
      }),
  }),

  // ============= POINT TRANSACTIONS =============
  pointTransactions: router({
    list: adminProcedure
      .input(z.object({
        userId: z.number().optional(),
        limit: z.number().optional().default(100),
      }))
      .query(async ({ input }) => {
        const transactions = await railwayDb.getPointTransactions(input.limit);
        return transactions;
      }),

    userHistory: adminProcedure
      .input(z.object({
        userId: z.number(),
        limit: z.number().optional().default(100),
        selectedDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const history = await railwayDb.getUserPointsHistory(input.userId, input.limit, input.selectedDate);
        return history;
      }),
  }),

  // ============= WITHDRAWALS =============
  withdrawals: router({
    list: adminProcedure
      .input(z.object({
        status: z.string().optional(),
        limit: z.number().optional().default(100),
      }))
      .query(async ({ input }) => {
        const withdrawals = await railwayDb.getRailwayWithdrawals(input.status, input.limit);
        if (input.status === "pending") {
          // Discord: notifica no canal no mesmo momento em que surgem pendentes no painel
          void notifyNewPendingWithdrawals(withdrawals).catch((err) =>
            console.warn("[Discord] notify error:", err)
          );
        }
        
        // Enriquecer com dados de ganhos Monetag
        try {
          const validWithdrawals = withdrawals.filter((w: any) => w.user_id && w.created_at);
          if (validWithdrawals.length > 0) {
            const { userDayMap, dayTotalMap } = await railwayDb.getMonetag_BatchEarnings(
              validWithdrawals.map((w: any) => ({ user_id: w.user_id, created_at: w.created_at }))
            );
            
            return withdrawals.map((w: any) => {
              if (!w.user_id || !w.created_at) {
                return { ...w, monetag_user_day: 0, monetag_all_day: 0 };
              }
              const dateKey = new Date(w.created_at).toISOString().slice(0, 10);
              return {
                ...w,
                monetag_user_day: userDayMap[`${w.user_id}_${dateKey}`] || 0,
                monetag_all_day: dayTotalMap[dateKey] || 0,
              };
            });
          }
        } catch (err) {
          console.warn('[Withdrawals] Error enriching with Monetag data:', err);
        }
        
        return withdrawals.map((w: any) => ({ ...w, monetag_user_day: 0, monetag_all_day: 0 }));
      }),

    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['pending', 'approved', 'rejected']),
        receiptUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const updated = await railwayDb.updateRailwayWithdrawalStatus(input.id, input.status, input.receiptUrl);
        if (!updated) throw new Error('Não foi possível atualizar o saque');
        const details = input.status === 'rejected'
          ? `Saque ${input.id} cancelado; pontos devolvidos. Histórico: Chave PIX incorreta.`
          : `Saque ${input.id} atualizado para ${input.status}${input.receiptUrl ? ' com comprovante' : ''}`;
        await railwayDb.createAdminLog('UPDATE_WITHDRAWAL', details);
        return { success: true };
      }),

    // Buscar saque por ID (para detalhes no dialog)
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const rows = await railwayDb.executeRawQuery(
          `SELECT w.*, u.name as user_name, u.email as user_email 
           FROM withdrawals w 
           LEFT JOIN users u ON w.user_id = u.id 
           WHERE w.id = ?`,
          [input.id]
        );
        return rows[0] || null;
      }),

    // Processar pagamento FaucetPay via backend PHP
    processFaucetPay: adminProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          // 1. Buscar dados do saque
          const rows = await railwayDb.executeRawQuery(
            `SELECT * FROM withdrawals WHERE id = ?`,
            [input.id]
          );
          const withdrawal = rows[0];
          if (!withdrawal) {
            return { success: false, message: 'Saque n\u00e3o encontrado', status: 'not_found' };
          }

          // 2. Verificar se \u00e9 FaucetPay
          const method = (withdrawal.payment_method || '').toLowerCase();
          if (method !== 'faucetpay') {
            return { success: false, message: 'Este saque n\u00e3o \u00e9 FaucetPay', status: 'invalid_method' };
          }

          // 3. Marcar como 'approved' antes de processar
          await railwayDb.updateRailwayWithdrawalStatus(input.id, 'approved');

          // 4. Chamar o backend PHP para processar o pagamento real
          const result = await youngMoneyApi.processWithdrawal(input.id);
          console.log('[Admin] FaucetPay process result:', JSON.stringify(result));

          // 5. Normalizar resposta do backend PHP
          // O backend PHP retorna: { status: "success", data: { tx_hash, status, ... } }
          // Precisamos extrair os dados de dentro de result.data quando existir
          const phpData = result.data || result;
          const isSuccess = result.success === true || result.status === 'success' || result.status === 'completed' || phpData.status === 'completed';

          // 6. Atualizar o banco com o resultado
          if (isSuccess) {
            // Pagamento enviado com sucesso
            const txHash = phpData.tx_hash || phpData.payout_id || phpData.payout_hash || result.tx_hash || result.payout_id || result.payout_hash || null;
            const payoutId = phpData.payout_id || result.payout_id || null;
            const balanceRemaining = phpData.balance || result.balance || null;
            const successMessage = phpData.message || result.message || 'Pagamento enviado com sucesso!';

            if (txHash) {
              await railwayDb.executeRawQuery(
                `UPDATE withdrawals SET status = 'approved', tx_hash = ?, gateway_response = ?, updated_at = NOW() WHERE id = ?`,
                [String(txHash), JSON.stringify(result), input.id]
              );
            }
            await railwayDb.createAdminLog('FAUCETPAY_PAYMENT', `Saque #${input.id} pago via FaucetPay. TX: ${txHash || 'N/A'}`);
            return {
              success: true,
              message: successMessage,
              status: 'completed',
              tx_hash: txHash,
              payout_id: payoutId,
              balance_remaining: balanceRemaining,
              raw: result,
            };
          } else {
            // Pagamento falhou - reverter para pending
            const failMessage = phpData.message || result.message || 'Erro desconhecido';
            await railwayDb.updateRailwayWithdrawalStatus(input.id, 'pending');
            await railwayDb.createAdminLog('FAUCETPAY_FAILED', `Saque #${input.id} falhou: ${failMessage}`);
            return {
              success: false,
              message: failMessage || 'Falha no pagamento FaucetPay',
              status: 'failed',
              raw: result,
            };
          }
        } catch (error: any) {
          console.error('[Admin] FaucetPay process error:', error);
          // Reverter para pending em caso de erro
          await railwayDb.updateRailwayWithdrawalStatus(input.id, 'pending');
          await railwayDb.createAdminLog('FAUCETPAY_ERROR', `Erro ao processar saque #${input.id}: ${error.message}`);
          return {
            success: false,
            message: `Erro de conex\u00e3o: ${error.message}`,
            status: 'error',
          };
        }
      }),

    // Processar saque PIX pela API PIX configurada no servidor do painel.
    processPix: adminProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        let withdrawal: any;
        let statusToRestore = 'pending';
        try {
          const rows = await railwayDb.executeRawQuery(
            `SELECT w.*, u.name as user_name, u.email as user_email
             FROM withdrawals w
             LEFT JOIN users u ON w.user_id = u.id
             WHERE w.id = ?`,
            [input.id]
          );
          withdrawal = rows[0];
          if (!withdrawal) {
            return { success: false, message: 'Saque não encontrado', status: 'not_found' };
          }

          const method = String(withdrawal.payment_method || 'pix').toLowerCase();
          if (method === 'faucetpay') {
            return { success: false, message: 'Este saque deve ser pago via FaucetPay', status: 'invalid_method' };
          }

          const currentStatus = String(withdrawal.status || 'pending').toLowerCase();
          const hasPaymentProof = Boolean(
            withdrawal.tx_hash || withdrawal.receipt_url || withdrawal.gateway_response
          );
          const canRetryApproved = currentStatus === 'approved' && !hasPaymentProof;
          if (currentStatus !== 'pending' && !canRetryApproved) {
            return {
              success: false,
              message: 'Este saque já possui pagamento ou não está disponível para reenvio',
              status: 'already_processed',
            };
          }
          statusToRestore = canRetryApproved ? 'approved' : 'pending';

          const keyType = normalizePixKeyType(withdrawal.pix_key_type || withdrawal.pix_type);
          const keyValue = String(withdrawal.pix_key || '').trim();
          const amount = Number(withdrawal.amount);
          if (!keyType || !keyValue || !Number.isFinite(amount) || amount <= 0) {
            return {
              success: false,
              message: 'O saque não possui chave PIX, tipo ou valor válido',
              status: 'invalid_data',
            };
          }

          // Reserva o saque antes da chamada externa para impedir dois pagamentos
          // quando o botão for acionado simultaneamente em duas abas.
          const claim = await railwayDb.executeRawQuery(
            `UPDATE withdrawals
             SET status = 'processing', updated_at = NOW()
             WHERE id = ? AND status = ?`,
            [input.id, currentStatus]
          ) as any;
          if (Number(claim?.affectedRows || 0) !== 1) {
            return {
              success: false,
              message: 'Este saque já está sendo processado ou não está pendente',
              status: 'already_processing',
            };
          }

          const result = await pixApi.payByKey({
            keyType,
            keyValue,
            amount: amount.toFixed(2),
            description: `Saque #${input.id}`,
          });
          const transaction = result.transaction || {};
          const references = transaction.references || {};
          const completed = result.success === true && transaction.status === 'completed';
          const receiptUrl = transaction.receipt_url || null;
          const transactionId = references.order_id || references.run_id || references.pix_id || null;

          await railwayDb.executeRawQuery(
            `UPDATE withdrawals
             SET status = ?, tx_hash = ?, receipt_url = ?, gateway_response = ?, updated_at = NOW()
             WHERE id = ?`,
            [completed ? 'approved' : statusToRestore, transactionId ? String(transactionId) : null, receiptUrl, JSON.stringify(result), input.id]
          );

          if (!completed) {
            const message = result.message || 'A API PIX não confirmou o pagamento';
            await railwayDb.createAdminLog('PIX_PAYMENT_FAILED', `Saque #${input.id} não concluído: ${message}`);
            return { success: false, message, status: transaction.status || 'failed', raw: result };
          }

          await railwayDb.createAdminLog(
            'PIX_PAYMENT',
            `Saque #${input.id} pago via PIX. Transação: ${transactionId || 'N/A'}`
          );
          return {
            success: true,
            message: result.message || 'Pagamento PIX enviado com sucesso',
            status: 'completed',
            tx_hash: transactionId ? String(transactionId) : null,
            receipt_url: receiptUrl,
            raw: result,
          };
        } catch (error: any) {
          console.error('[Admin] PIX process error:', error?.message || error);
          await railwayDb.updateRailwayWithdrawalStatus(input.id, statusToRestore ?? 'pending');
          await railwayDb.createAdminLog(
            'PIX_PAYMENT_ERROR',
            `Erro ao processar saque #${input.id}: ${error?.message || 'erro desconhecido'}`
          );
          return {
            success: false,
            message: error?.message || 'Erro ao processar o pagamento PIX',
            status: 'error',
          };
        }
      }),

    stats: adminProcedure.query(async () => {
      const stats = await railwayDb.getRailwayWithdrawalStats();
      return stats;
    }),

    create: adminProcedure
      .input(z.object({
        userId: z.number(),
        amount: z.number(),
        pixType: z.string(),
        pixKey: z.string(),
        status: z.string().optional().default('pending'),
      }))
      .mutation(async ({ input }) => {
        await railwayDb.createRailwayWithdrawal(input);
        await railwayDb.createAdminLog('CREATE_WITHDRAWAL', `Saque criado para usuário ${input.userId}: R$ ${input.amount}`);
        return { success: true };
      }),

    requests: adminProcedure
      .input(z.object({ limit: z.number().optional().default(100) }))
      .query(async ({ input }) => {
        const requests = await railwayDb.getWithdrawalRequests(input.limit);
        return requests;
      }),
  }),

  // ============= REFERRALS =============
  referrals: router({
    list: adminProcedure
      .input(z.object({
        limit: z.number().optional().default(100),
      }))
      .query(async ({ input }) => {
        const referrals = await railwayDb.getRailwayReferrals(input.limit);
        return referrals;
      }),
  }),

  // ============= RANKING =============
  ranking: router({
    // Lista todos os usuários (para visualização geral)
    list: adminProcedure
      .input(z.object({
        limit: z.number().optional().default(10000),
      }))
      .query(async ({ input }) => {
        const ranking = await railwayDb.getRailwayRanking(input.limit);
        return ranking;
      }),

    // Lista ranking REAL (com filtro de cooldown) - para pagamentos
    listWithCooldown: adminProcedure
      .input(z.object({
        limit: z.number().optional().default(10),
      }))
      .query(async ({ input }) => {
        const ranking = await railwayDb.getRailwayRankingWithCooldown(input.limit);
        return ranking;
      }),

    // Lista cooldowns ativos
    activeCooldowns: adminProcedure
      .query(async () => {
        const cooldowns = await railwayDb.getActiveCooldowns();
        return cooldowns;
      }),

    updateDailyPoints: adminProcedure
      .input(z.object({
        id: z.number(),
        points: z.number(),
        operation: z.enum(['add', 'subtract', 'set']).optional().default('set'),
      }))
      .mutation(async ({ input }) => {
        await railwayDb.updateDailyPoints(input.id, input.points, input.operation);
        await railwayDb.createAdminLog('UPDATE_DAILY_POINTS', `Pontos diários do usuário ${input.id} atualizados: ${input.operation} ${input.points}`);
        return { success: true };
      }),
  }),

  // ============= SYSTEM SETTINGS =============
  settings: router({
    list: adminProcedure.query(async () => {
      const settings = await railwayDb.getSystemSettings();
      return settings;
    }),

    update: adminProcedure
      .input(z.object({
        key: z.string(),
        value: z.string(),
      }))
      .mutation(async ({ input }) => {
        await railwayDb.updateSystemSetting(input.key, input.value);
        await railwayDb.createAdminLog('UPDATE_SETTING', `Configuração ${input.key} atualizada para ${input.value}`);
        return { success: true };
      }),

    withdrawalConfig: adminProcedure.query(async () => {
      const settings = await railwayDb.getSystemSettings();
      const quickValues = await railwayDb.getWithdrawalQuickValues();
      const settingsMap = Object.fromEntries(
        settings.map((setting: any) => [setting.setting_key, setting.setting_value])
      );

      return {
        min_withdrawal_brl: settingsMap.min_withdrawal_brl ?? settingsMap.min_withdrawal ?? '1.00',
        max_withdrawal_brl: settingsMap.max_withdrawal_brl ?? settingsMap.max_withdrawal ?? '1000.00',
        min_withdrawal_points: settingsMap.min_withdrawal_points ?? '2000',
        points_per_real: settingsMap.points_per_real ?? '2000',
        withdrawal_methods: settingsMap.withdrawal_methods ?? 'pix,binance,faucetpay',
        quick_values: quickValues.map((item: any) => Number(item.value_amount)).filter((value: number) => Number.isFinite(value) && value > 0),
      };
    }),

    saveWithdrawalConfig: adminProcedure
      .input(z.object({
        min_withdrawal_brl: z.string(),
        max_withdrawal_brl: z.string(),
        min_withdrawal_points: z.string(),
        points_per_real: z.string(),
        withdrawal_methods: z.string(),
        quick_values: z.array(z.number()).min(1).max(12),
      }))
      .mutation(async ({ input }) => {
        const settingsToSave = [
          { key: 'min_withdrawal_brl', value: input.min_withdrawal_brl },
          { key: 'min_withdrawal', value: input.min_withdrawal_brl },
          { key: 'max_withdrawal_brl', value: input.max_withdrawal_brl },
          { key: 'max_withdrawal', value: input.max_withdrawal_brl },
          { key: 'min_withdrawal_points', value: input.min_withdrawal_points },
          { key: 'points_per_real', value: input.points_per_real },
          { key: 'withdrawal_methods', value: input.withdrawal_methods },
          { key: 'quick_withdraw_values', value: JSON.stringify(input.quick_values) },
        ];

        for (const setting of settingsToSave) {
          await railwayDb.updateSystemSetting(setting.key, setting.value);
        }

        const quickValues = await railwayDb.replaceWithdrawalQuickValues(input.quick_values);

        await railwayDb.createAdminLog(
          'SAVE_WITHDRAWAL_CONFIG',
          `Configuração PIX atualizada - Min: R$ ${input.min_withdrawal_brl}, Max: R$ ${input.max_withdrawal_brl}, Pontos mínimos: ${input.min_withdrawal_points}, Conversão: ${input.points_per_real}, Valores rápidos: ${quickValues.join(', ')}`
        );

        return { success: true, quick_values: quickValues };
      }),

    // Sincronizar configurações de atualização do app com a API PHP
    syncAppUpdate: adminProcedure
      .input(z.object({
        app_update_enabled: z.string(),
        app_update_min_version: z.string(),
        app_update_download_url: z.string(),
        app_update_secondary_url: z.string(),
        app_update_force: z.string(),
        app_update_release_notes: z.string(),
      }))
      .mutation(async ({ input }) => {
        // 1. Salvar todas as settings no banco local
        const settingsToSave = [
          { key: 'app_update_enabled', value: input.app_update_enabled },
          { key: 'app_update_min_version', value: input.app_update_min_version },
          { key: 'app_update_download_url', value: input.app_update_download_url },
          { key: 'app_update_secondary_url', value: input.app_update_secondary_url },
          { key: 'app_update_force', value: input.app_update_force },
          { key: 'app_update_release_notes', value: input.app_update_release_notes },
        ];

        for (const setting of settingsToSave) {
          await railwayDb.updateSystemSetting(setting.key, setting.value);
        }

        // 2. Sincronizar com a API PHP para garantir que o check-update.php leia os dados corretos
        let phpSyncResult = null;
        try {
          const phpResponse = await youngMoneyApi.syncAppUpdateSettings(input);
          phpSyncResult = phpResponse;
          console.log('[AppUpdate] PHP API sync response:', JSON.stringify(phpResponse));
        } catch (error: any) {
          console.error('[AppUpdate] Erro ao sincronizar com PHP API:', error.message);
          phpSyncResult = { success: false, error: error.message };
        }

        await railwayDb.createAdminLog(
          'SYNC_APP_UPDATE',
          `Configurações de atualização sincronizadas - Enabled: ${input.app_update_enabled}, Min Version: ${input.app_update_min_version}, Force: ${input.app_update_force}, URL: ${input.app_update_download_url || '(vazio)'}`
        );

        return { success: true, php_sync: phpSyncResult };
      }),

    allowedMaintenanceEmails: adminProcedure.query(async () => {
      // 1. Tentar buscar da API PHP (fonte oficial do servidor)
      try {
        const emails = await youngMoneyApi.listAllowedMaintenanceEmails();
        if (Array.isArray(emails) && emails.length > 0) {
          // Sincronizar de volta no banco local para manter consistência
          try {
            await railwayDb.updateSystemSetting('maintenance_allowed_emails', JSON.stringify(emails));
          } catch (e) {
            // Ignorar erro de sync local
          }
          return emails;
        }
      } catch (error: any) {
        console.warn('[MaintenanceAllowedEmails] Erro ao buscar da API PHP, usando banco local:', error.message);
      }
      // 2. Fallback: banco local do painel
      const settings = await railwayDb.getSystemSettings();
      const row = settings.find((s: any) => s.setting_key === 'maintenance_allowed_emails');
      if (row && row.setting_value) {
        try {
          const parsed = JSON.parse(row.setting_value);
          if (Array.isArray(parsed)) return parsed as string[];
        } catch (e) {
          // Formato antigo
        }
      }
      return [];
    }),

    saveAllowedMaintenanceEmails: adminProcedure
      .input(z.object({
        emails: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        // Normalizar: minúsculas, únicos, apenas e-mails válidos
        const normalized = Array.from(
          new Set(
            input.emails
              .map((e) => e.trim().toLowerCase())
              .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
          )
        );

        // 1. Salvar no banco local
        await railwayDb.updateSystemSetting('maintenance_allowed_emails', JSON.stringify(normalized));

        // 2. Sincronizar com a API PHP (fonte do middleware de manutenção)
        let phpSyncResult = null;
        try {
          const emails = await youngMoneyApi.syncAllowedMaintenanceEmails(normalized);
          phpSyncResult = emails;
          console.log('[MaintenanceAllowedEmails] PHP API sync response:', JSON.stringify(emails));
        } catch (error: any) {
          console.error('[MaintenanceAllowedEmails] Erro ao sincronizar com PHP API:', error.message);
          phpSyncResult = { success: false, error: error.message };
        }

        await railwayDb.createAdminLog(
          'SAVE_ALLOWED_MAINTENANCE_EMAILS',
          `E-mails liberados durante manutenção atualizados: ${normalized.length > 0 ? normalized.join(', ') : '(lista vazia)'}`
        );

        return { success: true, emails: normalized, php_sync: phpSyncResult };
      }),

    toggleMaintenance: adminProcedure
      .input(z.object({
        enabled: z.boolean(),
        message: z.string(),
      }))
      .mutation(async ({ input }) => {
        // 1. Atualizar settings no banco local
        await railwayDb.updateSystemSetting('maintenance_mode', input.enabled ? '1' : '0');
        if (input.message.trim()) {
          await railwayDb.updateSystemSetting('maintenance_message', input.message);
        }

        // 2. Chamar endpoint PHP que dispara push notification via FCM
        let pushResult = null;
        try {
          const phpResponse = await youngMoneyApi.toggleMaintenance(input.enabled, input.message);
          pushResult = phpResponse?.push_notification ?? null;
          console.log('[Maintenance] PHP API response:', JSON.stringify(phpResponse));
        } catch (error: any) {
          console.error('[Maintenance] Erro ao chamar PHP API:', error.message);
          pushResult = { success: false, error: error.message };
        }

        await railwayDb.createAdminLog(
          'TOGGLE_MAINTENANCE',
          `Manutenção ${input.enabled ? 'ATIVADA' : 'DESATIVADA'} - Push FCM: ${pushResult?.success !== false ? 'enviada' : 'falhou'}`
        );

        return { success: true, push_notification: pushResult };
      }),
  }),

  // ============= ROULETTE =============
  roulette: router({
    settings: adminProcedure.query(async () => {
      const settings = await railwayDb.getRouletteSettings();
      return settings;
    }),

    updateSetting: adminProcedure
      .input(z.object({
        key: z.string(),
        value: z.string(),
      }))
      .mutation(async ({ input }) => {
        await railwayDb.updateRouletteSetting(input.key, input.value);
        await railwayDb.createAdminLog('UPDATE_ROULETTE', `Roleta ${input.key} atualizada para ${input.value}`);
        return { success: true };
      }),

    prizes: adminProcedure.query(async () => {
      const prizes = await railwayDb.getRoulettePrizes();
      return prizes;
    }),

    updatePrize: adminProcedure
      .input(z.object({
        id: z.number(),
        prizeName: z.string(),
        prizeValue: z.number(),
        probability: z.number(),
        isActive: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await railwayDb.updateRoulettePrize(input.id, input.prizeName, input.prizeValue, input.probability, input.isActive);
        await railwayDb.createAdminLog('UPDATE_PRIZE', `Prêmio ${input.id} atualizado`);
        return { success: true };
      }),

    spinHistory: adminProcedure
      .input(z.object({ limit: z.number().optional().default(100) }))
      .query(async ({ input }) => {
        const history = await railwayDb.getSpinHistory(input.limit);
        return history;
      }),
  }),

  // ============= DAILY CHECKIN =============
  checkin: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().optional().default(100) }))
      .query(async ({ input }) => {
        const checkins = await railwayDb.getDailyCheckins(input.limit);
        return checkins;
      }),
  }),

  // ============= DAILY TASKS =============
  tasks: router({
    list: adminProcedure.query(async () => {
      return listTaskDefinitions();
    }),

    uploadIcon: taskAdminProcedure
      .input(z.object({ dataUrl: z.string().max(2900000) }))
      .mutation(async ({ input }) => {
        const url = await uploadTaskIcon(input.dataUrl);
        await railwayDb.createAdminLog('UPLOAD_TASK_ICON', 'Ícone de missão enviado');
        return { url };
      }),

    create: taskAdminProcedure
      .input(z.object({
        title: z.string().trim().min(2).max(120),
        description: z.string().trim().max(255),
        icon: z.string().trim().min(1).max(255),
        pointsReward: z.number().int().min(1).max(1000000),
        frequency: z.enum(["once", "daily"]),
        targetUrl: z.string().url().max(512).refine(url => url.startsWith("https://")),
        waitSeconds: z.number().int().min(0).max(300),
        isActive: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const id = await createTaskDefinition(input);
        await railwayDb.createAdminLog('CREATE_TASK', `Missão ${id} criada`);
        return { success: true, id };
      }),

    update: taskAdminProcedure
      .input(z.object({
        id: z.string().min(1).max(50),
        title: z.string().trim().min(2).max(120),
        description: z.string().trim().max(255),
        icon: z.string().trim().min(1).max(255),
        pointsReward: z.number().int().min(1).max(1000000),
        frequency: z.enum(["once", "daily"]),
        targetUrl: z.string().url().max(512).refine(url => url.startsWith("https://")).optional(),
        waitSeconds: z.number().int().min(0).max(300),
        isActive: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await updateTaskDefinition(input.id, input);
        await railwayDb.createAdminLog('UPDATE_TASK', `Missão ${input.id} atualizada`);
        return { success: true };
      }),
  }),

  // ============= NOTIFICATIONS =============
  notifications: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().optional().default(100) }))
      .query(async ({ input }) => {
        const notifications = await railwayDb.getNotifications(input.limit);
        return notifications;
      }),

    create: adminProcedure
      .input(z.object({
        userId: z.number(),
        title: z.string(),
        message: z.string(),
        type: z.string().optional().default('info'),
        points: z.number().optional().default(0),
      }))
      .mutation(async ({ input }) => {
        await railwayDb.createNotification(input.userId, input.title, input.message, input.type, input.points);
        const pointsMsg = input.points > 0 ? ` (+${input.points} pontos)` : '';
        await railwayDb.createAdminLog('CREATE_NOTIFICATION', `Notificação enviada para usuário ${input.userId}${pointsMsg}`);
        return { success: true };
      }),

    broadcast: adminProcedure
      .input(z.object({
        title: z.string(),
        message: z.string(),
        type: z.string().optional().default('info'),
        points: z.number().optional().default(0),
      }))
      .mutation(async ({ input }) => {
        await railwayDb.sendBroadcastNotification(input.title, input.message, input.type, input.points);
        const pointsMsg = input.points > 0 ? ` (+${input.points} pontos para todos)` : '';
        await railwayDb.createAdminLog('BROADCAST_NOTIFICATION', `Notificação broadcast enviada: ${input.title}${pointsMsg}`);
        return { success: true };
      }),

    // Envia push notification FCM via PHP do Railway (via servidor para evitar problema de CORS / API_BASE no front)
    sendPush: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        body: z.string().min(1),
        target: z.enum(['all', 'topic', 'user']).default('all'),
        topic: z.string().optional().default('all'),
        userId: z.number().optional(),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await youngMoneyApi.sendPushNotification({
          title: input.title,
          body: input.body,
          target: input.target,
          topic: input.topic,
          user_id: input.userId,
          image_url: input.imageUrl,
          data: { type: 'admin_push' },
        });
        if (result?.status === 'success') {
          const dest = input.target === 'user' ? `usuario ${input.userId}` : input.target === 'topic' ? `topico ${input.topic}` : 'todos';
          await railwayDb.createAdminLog('SEND_PUSH', `Push enviado para ${dest}: ${input.title}`);
        }
        return result;
      }),
  }),

  // ============= DEVICE BLACKLIST =============
  blacklist: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().optional().default(100) }))
      .query(async ({ input }) => {
        const devices = await railwayDb.getDeviceBlacklist(input.limit);
        return devices;
      }),

    bannedAccounts: adminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(1000).optional().default(500) }))
      .query(async ({ input }) => railwayDb.getPermanentEmailBans(input.limit)),

    add: adminProcedure
      .input(z.object({
        email: z.string().trim().email(),
        reason: z.string().trim().min(1).max(500),
      }))
      .mutation(async ({ input }) => {
        const result = await railwayDb.addUserDeviceToBlacklistByEmail(
          input.email,
          input.reason
        );
        if (!result.success) {
          throw new TRPCError({
            code: result.code,
            message: result.message,
          });
        }
        await railwayDb.createAdminLog(
          "PERMANENT_BAN",
          `E-mail ${result.email}: ${result.matchedAccounts} conta(s), ` +
            `${result.matchedDevices} dispositivo(s) bloqueado(s) permanentemente`
        );
        return {
          success: true,
          permanent: true,
          matchedAccounts: result.matchedAccounts,
          matchedDevices: result.matchedDevices,
          newlyBlockedDevices: result.newlyBlockedDevices,
        };
      }),

    unbanByEmail: adminProcedure
      .input(z.object({ email: z.string().trim().email() }))
      .mutation(async ({ input }) => {
        const result = await railwayDb.unbanUserByEmail(input.email);
        if (!result.success) {
          throw new TRPCError({
            code: result.code,
            message: result.message,
          });
        }
        await railwayDb.createAdminLog(
          "UNBAN_USER",
          `E-mail ${result.email}: ${result.matchedAccounts} conta(s) liberada(s), ` +
            `${result.removedDevices} dispositivo(s) desbloqueado(s)`
        );
        return {
          success: true,
          matchedAccounts: result.matchedAccounts,
          removedDevices: result.removedDevices,
        };
      }),
  }),

  // ============= SECURITY VIOLATIONS =============
  security: router({
    violations: adminProcedure
      .input(z.object({ limit: z.number().optional().default(100) }))
      .query(async ({ input }) => {
        const violations = await railwayDb.getSecurityViolations(input.limit);
        return violations;
      }),
  }),

  // ============= ACTIVE SESSIONS =============
  sessions: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().optional().default(100) }))
      .query(async ({ input }) => {
        const sessions = await railwayDb.getActiveSessions(input.limit);
        return sessions;
      }),

    terminate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await railwayDb.terminateSession(input.id);
        await railwayDb.createAdminLog('TERMINATE_SESSION', `Sessão ${input.id} encerrada`);
        return { success: true };
      }),
  }),

  // ============= MONETAG =============
  monetag: router({
    events: adminProcedure
      .input(z.object({ limit: z.number().optional().default(100) }))
      .query(async ({ input }) => {
        const events = await railwayDb.getMonetag_Events(input.limit);
        return events;
      }),

    postbacks: adminProcedure
      .input(z.object({ limit: z.number().optional().default(100) }))
      .query(async ({ input }) => {
        const postbacks = await railwayDb.getMonetag_Postbacks(input.limit);
        return postbacks;
      }),
  }),

  // ============= PIX PAYMENTS =============
  pixPayments: router({
    balance: adminProcedure.query(async () => {
      return pixApi.getBalance();
    }),

    list: adminProcedure
      .input(z.object({ limit: z.number().optional().default(100) }))
      .query(async ({ input }) => {
        const payments = await railwayDb.getPixPayments(input.limit);
        return payments;
      }),
  }),

  // ============= TRACKING EVENTS =============
  tracking: router({
    events: adminProcedure
      .input(z.object({ limit: z.number().optional().default(100) }))
      .query(async ({ input }) => {
        const events = await railwayDb.getTrackingEvents(input.limit);
        return events;
      }),
  }),

  // ============= ADMIN LOGS =============
  adminLogs: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().optional().default(100) }))
      .query(async ({ input }) => {
        const logs = await railwayDb.getAdminLogs(input.limit);
        return logs;
      }),
  }),

  // ============= DATABASE EXPLORER =============
  database: router({
    tables: adminProcedure.query(async () => {
      const tables = await railwayDb.listRailwayTables();
      return tables;
    }),

    describe: adminProcedure
      .input(z.object({ table: z.string() }))
      .query(async ({ input }) => {
        const structure = await railwayDb.describeRailwayTable(input.table);
        return structure;
      }),

    query: taskAdminProcedure
      .input(z.object({ 
        sql: z.string(),
        params: z.array(z.any()).optional().default([]),
      }))
      .mutation(async ({ input }) => {
        // Apenas SELECT queries são permitidas por segurança
        const sqlLower = input.sql.toLowerCase().trim();
        if (!sqlLower.startsWith('select')) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Apenas queries SELECT são permitidas' 
          });
        }
        const result = await railwayDb.executeRawQuery(input.sql, input.params);
        return result;
      }),

    execute: taskAdminProcedure
      .input(z.object({ 
        sql: z.string(),
        params: z.array(z.any()).optional().default([]),
      }))
      .mutation(async ({ input }) => {
        // Permite INSERT, UPDATE, DELETE para admins
        const result = await railwayDb.executeRawQuery(input.sql, input.params);
        await railwayDb.createAdminLog('EXECUTE_SQL', `SQL executado: ${input.sql.substring(0, 100)}`);
        return result;
      }),
  }),

  // ============= DISPOSITIVOS VINCULADOS =============
  devices: router({
    list: adminProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
        search: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return youngMoneyApi.listDeviceBindings(input.limit, input.offset, input.search);
      }),

    byUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return youngMoneyApi.listUserDeviceBindings(input.userId);
      }),

    stats: adminProcedure.query(async () => {
      return youngMoneyApi.getDeviceBindingStats();
    }),

    unlink: adminProcedure
      .input(z.object({ bindingId: z.number() }))
      .mutation(async ({ input }) => {
        const result = await youngMoneyApi.removeDeviceBinding(input.bindingId);
        if (result.success) {
          await railwayDb.createAdminLog(
            'UNLINK_DEVICE',
            `Identidade do dispositivo liberada: binding_id=${input.bindingId}, affected=${result.affected}`
          );
        }
        return result;
      }),

    unlinkAll: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const result = await youngMoneyApi.resetUserDeviceBindings(input.userId);
        if (result.success) {
          await railwayDb.createAdminLog(
            'RESET_USER_DEVICE_BINDINGS',
            `Conta resetada e vínculos removidos: user_id=${input.userId}, deleted=${result.affected}`
          );
        }
        return result;
      }),

    // RESET GLOBAL - desvincula TODOS os dispositivos de TODOS os usuários
    // Requer confirmação explícita digitando 'RESET' como palavra de confirmação
    unlinkAllGlobal: adminProcedure
      .input(z.object({ confirm: z.literal('RESET') }))
      .mutation(async () => {
        const result = await youngMoneyApi.resetAllDeviceBindings();
        if (result.success) {
          await railwayDb.createAdminLog(
            'GLOBAL_DEVICE_RESET',
            `RESET GLOBAL executado: ${result.affected} vínculos ativos e inativos excluídos`,
          );
        }
        return result;
      }),
  }),

  // ============= LUCKY POPUP =============
  luckyPopup: router({
    stats: adminProcedure
      .input(z.object({ date: z.string().optional() }))
      .query(async ({ input }) => {
        const date = input.date || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
        return await railwayDb.getLuckyPopupStats(date);
      }),

    userList: adminProcedure
      .input(z.object({ date: z.string().optional() }))
      .query(async ({ input }) => {
        const date = input.date || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
        const rows = await railwayDb.getLuckyPopupUserList(date);
        return rows.map((r: any) => ({
          user_id:     Number(r.user_id),
          user_name:   r.user_name ?? '',
          user_email:  r.user_email ?? '',
          total_slots: Number(r.total_slots),
          claimed:     Number(r.claimed),
          pending:     Number(r.pending),
          doubled:     Number(r.doubled),
          pts_base:    Number(r.pts_base),
          pts_doubled: Number(r.pts_doubled),
          first_slot:  String(r.first_slot ?? '').substring(0, 5),
          last_slot:   String(r.last_slot ?? '').substring(0, 5),
          doubles_used:Number(r.doubles_used),
        }));
      }),

    userSlots: adminProcedure
      .input(z.object({ userId: z.number(), date: z.string().optional() }))
      .query(async ({ input }) => {
        const date = input.date || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
        const rows = await railwayDb.getLuckyPopupUserSlots(input.userId, date);
        return rows.map((r: any) => ({
          id:           Number(r.id),
          user_id:      Number(r.user_id),
          user_name:    r.user_name ?? '',
          slot_time:    String(r.slot_time ?? '').substring(0, 5),
          base_points:  Number(r.base_points),
          claimed:      Boolean(r.claimed),
          doubled:      Boolean(r.doubled),
          claimed_at:   r.claimed_at ?? null,
          doubles_used: Number(r.doubles_used),
        }));
      }),

    cleanExcess: adminProcedure
      .input(z.object({ date: z.string().optional() }))
      .mutation(async ({ input }) => {
        const date = input.date || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
        const deleted = await railwayDb.cleanExcessLuckyPopupSlots(date);
        return { success: true, deleted };
      }),

    testUser: adminProcedure
      .input(z.object({
        email: z.string().email(),
        date: z.string().optional(),
        resetUser: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const date = input.date || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
        return await railwayDb.testUserLuckyPopup(input.email, date, input.resetUser ?? false);
      }),

    forcePopup: adminProcedure
      .input(z.object({
        email: z.string().email(),
        date: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const date = input.date || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
        return await railwayDb.forcePopupNow(input.email, date);
      }),
  }),
});

export type AppRouter = typeof appRouter;
