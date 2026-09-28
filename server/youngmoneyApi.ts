import axios, { AxiosInstance } from 'axios';

/**
 * Cliente para integração com a API do Young Money no Railway
 * Base URL: https://youngmoney-api-railway-production-5bf3.up.railway.app/
 */

const YOUNGMONEY_API_BASE_URL = process.env.YOUNGMONEY_API_URL || 'https://youngmoney-api-railway-production-5bf3.up.railway.app';

class YoungMoneyApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: YOUNGMONEY_API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Device Login - Autenticação por dispositivo
   */
  async deviceLogin(deviceId: string) {
    try {
      const response = await this.client.post('/api/v1/auth/device-login.php', {
        device_id: deviceId,
      });
      return response.data;
    } catch (error: any) {
      console.error('[YoungMoney API] Device login error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get User Profile - Buscar perfil de usuário
   */
  async getUserProfile(userId: number) {
    try {
      const response = await this.client.get('/api/v1/users.php', {
        params: { user_id: userId },
      });
      return response.data;
    } catch (error: any) {
      console.error('[YoungMoney API] Get user error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Manage Points - Gerenciar pontos do usuário
   */
  async managePoints(userId: number, amount: number, action: 'add' | 'remove') {
    try {
      const response = await this.client.post('/api/v1/points.php', {
        user_id: userId,
        amount,
        action,
      });
      return response.data;
    } catch (error: any) {
      console.error('[YoungMoney API] Manage points error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Request Withdrawal - Solicitar saque
   */
  async requestWithdrawal(userId: number, amount: number, pixKey: string, pixKeyType: string) {
    try {
      const response = await this.client.post('/api/v1/withdrawals.php', {
        user_id: userId,
        amount,
        pix_key: pixKey,
        pix_key_type: pixKeyType,
      });
      return response.data;
    } catch (error: any) {
      console.error('[YoungMoney API] Request withdrawal error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get Withdrawals - Listar saques
   */
  async getWithdrawals(status?: string) {
    try {
      const response = await this.client.get('/api/v1/withdrawals.php', {
        params: status ? { status } : {},
      });
      return response.data;
    } catch (error: any) {
      console.error('[YoungMoney API] Get withdrawals error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Process Withdrawal - Processa pagamento crypto (FaucetPay/Binance) via backend
   * Chama /withdraw/process.php que envia o pagamento real
   */
  async processWithdrawal(withdrawalId: number) {
    try {
      const response = await this.client.post('/withdraw/process.php', {
        withdrawal_id: withdrawalId,
      });
      return response.data;
    } catch (error: any) {
      console.error('[YoungMoney API] Process withdrawal error:', error.response?.data || error.message);
      // Retornar o erro do backend se disponível
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  }

  /**
   * Sync App Update Settings - Sincroniza configurações de atualização com a API PHP
   * Chama /admin/app_update_settings.php que salva no mesmo banco MySQL
   */
  async syncAppUpdateSettings(settings: {
    app_update_enabled: string;
    app_update_min_version: string;
    app_update_download_url: string;
    app_update_secondary_url: string;
    app_update_force: string;
    app_update_release_notes: string;
  }) {
    try {
      const response = await this.client.post('/admin/app_update_settings.php', settings);
      return response.data;
    } catch (error: any) {
      console.error('[YoungMoney API] Sync app update settings error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * E-mails liberados durante manutenção - Lista e sincroniza a lista de e-mails
   * que podem acessar o servidor mesmo com o modo de manutenção ativo.
   * Chama /admin/maintenance_allowed_emails.php (salva em system_settings)
   */
  async listAllowedMaintenanceEmails() {
    try {
      const response = await this.client.get('/admin/maintenance_allowed_emails.php', {
        params: { action: 'list' },
      });
      return response.data?.data?.emails ?? [];
    } catch (error: any) {
      console.error('[YoungMoney API] List allowed maintenance emails error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * E-mails liberados durante manutenção - Substitui a lista completa
   */
  async syncAllowedMaintenanceEmails(emails: string[]) {
    try {
      const response = await this.client.post('/admin/maintenance_allowed_emails.php', {
        action: 'sync',
        emails,
      });
      return response.data?.data?.emails ?? [];
    } catch (error: any) {
      console.error('[YoungMoney API] Sync allowed maintenance emails error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Toggle Maintenance Mode - Ativa/desativa manutenção + dispara push FCM
   */
  async toggleMaintenance(enabled: boolean, message: string) {
    try {
      const response = await this.client.post('/admin/maintenance.php', {
        enabled,
        message,
      });
      return response.data;
    } catch (error: any) {
      console.error('[YoungMoney API] Toggle maintenance error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Listar vínculos de dispositivos no banco usado pela API de login
   */
  async listDeviceBindings(limit: number, offset: number, search?: string) {
    try {
      const page = Math.floor(offset / limit) + 1;
      const response = await this.client.get('/admin/devices.php', {
        params: { page, limit, search: search || undefined },
      });
      return response.data?.data || { devices: [], total: 0 };
    } catch (error: any) {
      console.error('[YoungMoney API] List devices error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Listar todos os vínculos de um usuário no banco da API de login
   */
  async listUserDeviceBindings(userId: number) {
    try {
      const response = await this.client.get('/admin/devices.php', {
        params: { user_id: userId },
      });
      return response.data?.data?.devices || [];
    } catch (error: any) {
      console.error('[YoungMoney API] List user devices error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Estatísticas dos vínculos no banco usado pela API de login
   */
  async getDeviceBindingStats() {
    try {
      const response = await this.client.get('/admin/devices.php', {
        params: { stats: 1 },
      });
      return response.data?.data || { active: 0, inactive: 0, uniqueUsers: 0 };
    } catch (error: any) {
      console.error('[YoungMoney API] Device stats error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Excluir todos os vínculos ativos e inativos de um aparelho
   */
  async removeDeviceBinding(bindingId: number) {
    try {
      const response = await this.client.post('/admin/devices.php', {
        binding_id: bindingId,
      });
      return response.data;
    } catch (error: any) {
      console.error('[YoungMoney API] Remove device error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Resetar a conta removendo todos os vínculos de aparelhos
   */
  async resetUserDeviceBindings(userId: number) {
    try {
      const response = await this.client.post('/admin/devices.php', {
        user_id: userId,
      });
      return response.data;
    } catch (error: any) {
      console.error('[YoungMoney API] Reset user devices error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Reset global completo no banco usado pela API de login
   */
  async resetAllDeviceBindings() {
    try {
      const response = await this.client.post('/admin/devices.php', {
        action: 'reset_global',
        confirm: 'RESET',
      });
      return response.data;
    } catch (error: any) {
      console.error('[YoungMoney API] Global device reset error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send Push Notification - Dispara push FCM via PHP
   */
  async sendPushNotification(payload: {
    title: string;
    body: string;
    target: string;
    topic?: string;
    user_id?: number;
    image_url?: string;
    data?: Record<string, any>;
  }) {
    try {
      const response = await this.client.post('/admin/notifications/push.php', payload);
      return response.data;
    } catch (error: any) {
      console.error('[YoungMoney API] Send push error:', error.response?.data || error.message);
      // Repassa o erro do backend se houver
      if (error.response?.data) {
        return error.response.data;
      }
      throw error;
    }
  }
}

export const youngMoneyApi = new YoungMoneyApiClient();
