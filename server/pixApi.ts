import axios, { AxiosInstance } from "axios";

export type PixKeyType = "CPF" | "CNPJ" | "PHONE" | "EMAIL" | "EVP";

export type PixBalanceResponse = {
  success?: boolean;
  message?: string;
  wallet_available?: boolean;
  balance?: {
    available?: number;
    blocked?: number;
    available_for_discounts?: number;
    currency?: string;
    formatted_available?: string;
    formatted_blocked?: string;
  };
};

export type PixPaymentResponse = {
  success?: boolean;
  message?: string;
  transaction?: {
    status?: string;
    amount?: { value?: string; formatted?: string };
    receipt_url?: string | null;
    created_at?: string;
    references?: {
      pix_id?: string;
      cart_id?: string;
      run_id?: string;
      order_id?: number | string | null;
    };
  };
  receiver?: {
    name?: string | null;
    document?: string | null;
    institution?: { name?: string | null } | null;
  };
};

const DEFAULT_PIX_API_URL =
  "https://api-pix-production-3fda.up.railway.app";

function getPixApiUrl() {
  return (
    process.env.PIX_API_URL?.trim().replace(/\/+$/, "") ||
    DEFAULT_PIX_API_URL
  );
}

class PixApiClient {
  private createClient(): AxiosInstance {
    return axios.create({
      baseURL: getPixApiUrl(),
      timeout: 120000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async getBalance(): Promise<PixBalanceResponse> {
    try {
      const response = await this.createClient().get("/pix/balance");
      return response.data as PixBalanceResponse;
    } catch (error: any) {
      const status = error?.response?.status;
      const providerMessage = error?.response?.data?.detail?.message
        || error?.response?.data?.message;
      const suffix = providerMessage ? `: ${providerMessage}` : "";
      throw new Error(
        `Não foi possível consultar o saldo PIX${status ? ` (HTTP ${status})` : ""}${suffix}`
      );
    }
  }

  async payByKey(input: {
    keyType: PixKeyType;
    keyValue: string;
    amount: string;
    description: string;
  }): Promise<PixPaymentResponse> {
    try {
      const response = await this.createClient().post("/pix/key", {
        key_type: input.keyType,
        key_value: input.keyValue,
        amount: input.amount,
        payment_method: "WALLET",
        description: input.description,
      });
      return response.data as PixPaymentResponse;
    } catch (error: any) {
      const status = error?.response?.status;
      const providerMessage = error?.response?.data?.detail?.message
        || error?.response?.data?.message;
      const suffix = providerMessage ? `: ${providerMessage}` : "";
      throw new Error(
        `A API PIX não concluiu o pagamento${status ? ` (HTTP ${status})` : ""}${suffix}`
      );
    }
  }
}

export const pixApi = new PixApiClient();

export function normalizePixKeyType(value: unknown): PixKeyType | null {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  const aliases: Record<string, PixKeyType> = {
    CPF: "CPF",
    CNPJ: "CNPJ",
    PHONE: "PHONE",
    TELEFONE: "PHONE",
    EMAIL: "EMAIL",
    EVP: "EVP",
    RANDOM: "EVP",
    ALEATORIA: "EVP",
  };

  return aliases[normalized] || null;
}
