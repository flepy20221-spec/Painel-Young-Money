import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  Bitcoin,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  LayoutDashboard,
  Loader2,
  MapPin,
  Pencil,
  QrCode,
  ReceiptText,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type TabFilter = "pending" | "approved" | "rejected";
type PaymentMethod = "pix" | "faucetpay";

type FaucetPayResult = {
  success: boolean;
  message: string;
  status: string;
  tx_hash?: string | null;
  payout_id?: string | null;
  balance_remaining?: number | null;
  raw?: unknown;
} | null;

type PixPaymentResult = {
  success: boolean;
  message: string;
  status: string;
  tx_hash?: string | null;
  receipt_url?: string | null;
  raw?: unknown;
} | null;

type WithdrawalConfigForm = {
  min_withdrawal_brl: string;
  max_withdrawal_brl: string;
  min_withdrawal_points: string;
  points_per_real: string;
  withdrawal_methods: string;
  quick_values: string;
};

const PAGE_SIZE = 15;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

const COUNTRY_NAMES: Record<string, string> = {
  AE: "Emirados Árabes",
  AR: "Argentina",
  AU: "Austrália",
  BD: "Bangladesh",
  BE: "Bélgica",
  BR: "Brasil",
  CA: "Canadá",
  CH: "Suíça",
  CL: "Chile",
  CN: "China",
  CO: "Colômbia",
  DE: "Alemanha",
  EG: "Egito",
  ES: "Espanha",
  FR: "França",
  GB: "Reino Unido",
  HK: "Hong Kong",
  ID: "Indonésia",
  IN: "Índia",
  IT: "Itália",
  JP: "Japão",
  KR: "Coreia do Sul",
  MX: "México",
  MY: "Malásia",
  NG: "Nigéria",
  NL: "Holanda",
  NZ: "Nova Zelândia",
  PE: "Peru",
  PH: "Filipinas",
  PK: "Paquistão",
  PL: "Polônia",
  PT: "Portugal",
  RO: "Romênia",
  RU: "Rússia",
  SA: "Arábia Saudita",
  SE: "Suécia",
  SG: "Singapura",
  TH: "Tailândia",
  TR: "Turquia",
  TW: "Taiwan",
  UA: "Ucrânia",
  US: "EUA",
  VN: "Vietnã",
  XX: "Não identificado",
  ZA: "África do Sul",
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: unknown) {
  return currencyFormatter.format(toNumber(value));
}

function formatDate(value: unknown) {
  if (!value) return "Sem registro";

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Sem registro";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getPaymentMethod(withdrawal: any): PaymentMethod {
  return String(withdrawal.payment_method || "").toLowerCase() === "faucetpay"
    ? "faucetpay"
    : "pix";
}

function canRetryPix(withdrawal: any) {
  return (
    getPaymentMethod(withdrawal) === "pix" &&
    !withdrawal.tx_hash &&
    !withdrawal.receipt_url &&
    !withdrawal.gateway_response
  );
}

function getDestinationAddress(withdrawal: any, method: PaymentMethod) {
  if (method === "faucetpay") {
    return withdrawal.crypto_address || withdrawal.pix_key || "Não informado";
  }

  return withdrawal.pix_key || "Não informado";
}

function getCryptoInfo(withdrawal: any, method: PaymentMethod) {
  if (method !== "faucetpay") return null;

  const currency = String(withdrawal.crypto_currency || "USDT").toUpperCase();
  const amount = toNumber(withdrawal.crypto_amount);
  return amount ? amount + " " + currency : currency;
}

function countryName(code: unknown) {
  const normalizedCode = String(code || "XX").toUpperCase();
  return COUNTRY_NAMES[normalizedCode] || normalizedCode;
}

function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  if (method === "faucetpay") {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-300"
      >
        <Bitcoin className="h-3.5 w-3.5" />
        FaucetPay
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="rounded-full border-[#663038] bg-[#281419] px-2.5 py-1 text-[#ff777e]"
    >
      <QrCode className="h-3.5 w-3.5" />
      PIX
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved" || status === "completed") {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {status === "completed" ? "Concluído" : "Aprovado"}
      </Badge>
    );
  }

  if (status === "rejected") {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-[#713139] bg-[#2a1519] px-2.5 py-1 text-[#ff777e]"
      >
        <XCircle className="h-3.5 w-3.5" />
        Rejeitado
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="rounded-full border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-300"
    >
      <Clock className="h-3.5 w-3.5" />
      Pendente
    </Badge>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#272a31] py-3 last:border-b-0">
      <span className="text-sm text-[#7f8691]">{label}</span>
      <div className="min-w-0 text-right text-sm font-medium text-[#e3e5e9]">
        {children}
      </div>
    </div>
  );
}

export default function Withdrawals() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabFilter>("pending");
  const [page, setPage] = useState(1);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showEditReceiptDialog, setShowEditReceiptDialog] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [faucetPayProcessing, setFaucetPayProcessing] = useState(false);
  const [faucetPayResult, setFaucetPayResult] = useState<FaucetPayResult>(null);
  const [pixProcessing, setPixProcessing] = useState(false);
  const [pixResult, setPixResult] = useState<PixPaymentResult>(null);
  const [configForm, setConfigForm] = useState<WithdrawalConfigForm>({
    min_withdrawal_brl: "1.00",
    max_withdrawal_brl: "1000.00",
    min_withdrawal_points: "2000",
    points_per_real: "2000",
    withdrawal_methods: "pix,binance,faucetpay",
    quick_values: "1, 2, 5, 10, 20, 50",
  });

  const {
    data: pendingWithdrawals,
    refetch: refetchPending,
    isLoading: loadingPending,
    isFetching: fetchingPending,
  } = trpc.withdrawals.list.useQuery({ status: "pending" });
  const {
    data: approvedWithdrawals,
    refetch: refetchApproved,
    isLoading: loadingApproved,
    isFetching: fetchingApproved,
  } = trpc.withdrawals.list.useQuery({ status: "approved" });
  const {
    data: rejectedWithdrawals,
    refetch: refetchRejected,
    isLoading: loadingRejected,
    isFetching: fetchingRejected,
  } = trpc.withdrawals.list.useQuery({ status: "rejected" });
  const { data: stats, refetch: refetchStats } =
    trpc.withdrawals.stats.useQuery();
  const {
    data: pixBalance,
    refetch: refetchPixBalance,
    isFetching: fetchingPixBalance,
  } = trpc.pixPayments.balance.useQuery(undefined, { enabled: false });
  const {
    data: withdrawalConfig,
    refetch: refetchWithdrawalConfig,
    isLoading: loadingWithdrawalConfig,
  } = trpc.settings.withdrawalConfig.useQuery();

  useEffect(() => {
    if (!withdrawalConfig) return;

    setConfigForm({
      min_withdrawal_brl: withdrawalConfig.min_withdrawal_brl ?? "1.00",
      max_withdrawal_brl: withdrawalConfig.max_withdrawal_brl ?? "1000.00",
      min_withdrawal_points: withdrawalConfig.min_withdrawal_points ?? "2000",
      points_per_real: withdrawalConfig.points_per_real ?? "2000",
      withdrawal_methods:
        withdrawalConfig.withdrawal_methods ?? "pix,binance,faucetpay",
      quick_values: (withdrawalConfig.quick_values?.length
        ? withdrawalConfig.quick_values
        : [1, 2, 5, 10, 20, 50]
      ).join(", "),
    });
  }, [withdrawalConfig]);

  const refetchAll = () => {
    void refetchPending();
    void refetchApproved();
    void refetchRejected();
    void refetchStats();
    void refetchPixBalance();
    void refetchWithdrawalConfig();
  };

  const saveWithdrawalConfigMutation =
    trpc.settings.saveWithdrawalConfig.useMutation({
      onSuccess: () => {
        toast.success("Configuração de saques atualizada");
        void refetchWithdrawalConfig();
      },
      onError: (error: any) => {
        toast.error("Erro ao salvar configuração: " + error.message);
      },
    });

  const updateStatusMutation = trpc.withdrawals.updateStatus.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(
        variables.status === "rejected"
          ? "Pontos devolvidos. Histórico: Chave PIX incorreta."
          : "Saque atualizado com sucesso"
      );
      setShowApproveDialog(false);
      setShowRejectDialog(false);
      setShowEditReceiptDialog(false);
      setSelectedWithdrawal(null);
      setReceiptUrl("");
      refetchAll();
    },
    onError: (error: any) => toast.error("Erro: " + error.message),
  });

  const processFaucetPayMutation =
    trpc.withdrawals.processFaucetPay.useMutation({
      onSuccess: data => {
        setFaucetPayProcessing(false);
        setFaucetPayResult(data as FaucetPayResult);
        if (data.success) {
          toast.success("Pagamento FaucetPay enviado com sucesso");
        } else {
          toast.error("Falha: " + data.message);
        }
        refetchAll();
      },
      onError: (error: any) => {
        setFaucetPayProcessing(false);
        setFaucetPayResult({
          success: false,
          message: error.message || "Erro de conexão",
          status: "error",
        });
        toast.error("Erro: " + error.message);
        refetchAll();
      },
    });

  const processPixMutation = trpc.withdrawals.processPix.useMutation({
    onSuccess: data => {
      setPixProcessing(false);
      setPixResult(data as PixPaymentResult);
      if (data.success) {
        toast.success("Pagamento PIX enviado com sucesso");
      } else {
        toast.error("Falha: " + data.message);
      }
      refetchAll();
    },
    onError: (error: any) => {
      setPixProcessing(false);
      setPixResult({
        success: false,
        message: error.message || "Erro de conexão",
        status: "error",
      });
      toast.error("Erro: " + error.message);
      refetchAll();
    },
  });

  const handleRefreshPixBalance = async () => {
    const result = await refetchPixBalance();
    if (result.error) {
      toast.error("Não foi possível consultar o saldo PIX");
      return;
    }
    toast.success("Saldo PIX atualizado");
  };

  const parseQuickValues = (input: string) =>
    Array.from(
      new Set(
        input
          .split(",")
          .map(value => Number(value.trim()))
          .filter(value => Number.isFinite(value) && value > 0)
      )
    ).sort((a, b) => a - b);

  const handleConfigFieldChange = (
    field: keyof WithdrawalConfigForm,
    value: string
  ) => {
    setConfigForm(current => ({ ...current, [field]: value }));
  };

  const handleSaveWithdrawalConfig = async () => {
    const quickValues = parseQuickValues(configForm.quick_values);

    if (!quickValues.length) {
      toast.error("Informe ao menos um valor rápido válido");
      return;
    }

    await saveWithdrawalConfigMutation.mutateAsync({
      min_withdrawal_brl: configForm.min_withdrawal_brl,
      max_withdrawal_brl: configForm.max_withdrawal_brl,
      min_withdrawal_points: configForm.min_withdrawal_points,
      points_per_real: configForm.points_per_real,
      withdrawal_methods: configForm.withdrawal_methods,
      quick_values: quickValues,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copiado para a área de transferência"))
      .catch(() => toast.error("Não foi possível copiar"));
  };

  const openApproveDialog = (withdrawal: any) => {
    setSelectedWithdrawal(withdrawal);
    setReceiptUrl("");
    setFaucetPayResult(null);
    setFaucetPayProcessing(false);
    setPixResult(null);
    setPixProcessing(false);
    setShowApproveDialog(true);
  };

  const openRejectDialog = (withdrawal: any) => {
    setSelectedWithdrawal(withdrawal);
    setShowRejectDialog(true);
  };

  const openEditReceiptDialog = (withdrawal: any) => {
    setSelectedWithdrawal(withdrawal);
    setReceiptUrl(withdrawal.receipt_url || "");
    setShowEditReceiptDialog(true);
  };

  const handleCloseApproveDialog = () => {
    if (faucetPayProcessing || pixProcessing) return;
    setShowApproveDialog(false);
    setSelectedWithdrawal(null);
    setReceiptUrl("");
    setFaucetPayProcessing(false);
    setFaucetPayResult(null);
    setPixProcessing(false);
    setPixResult(null);
  };

  const handleCloseRejectDialog = () => {
    setShowRejectDialog(false);
    setSelectedWithdrawal(null);
  };

  const handleCloseEditReceiptDialog = () => {
    setShowEditReceiptDialog(false);
    setSelectedWithdrawal(null);
    setReceiptUrl("");
  };

  const handleApproveFaucetPay = () => {
    if (!selectedWithdrawal) return;
    setFaucetPayProcessing(true);
    setFaucetPayResult(null);
    processFaucetPayMutation.mutate({ id: selectedWithdrawal.id });
  };

  const handlePayPix = () => {
    if (!selectedWithdrawal) return;
    setPixProcessing(true);
    setPixResult(null);
    processPixMutation.mutate({ id: selectedWithdrawal.id });
  };

  const handleTabChange = (tab: TabFilter) => {
    setActiveTab(tab);
    setPage(1);
  };

  const activeState =
    activeTab === "approved"
      ? { data: approvedWithdrawals, loading: loadingApproved }
      : activeTab === "rejected"
        ? { data: rejectedWithdrawals, loading: loadingRejected }
        : { data: pendingWithdrawals, loading: loadingPending };

  const activeWithdrawals = (activeState.data || []) as any[];
  const totalPages = Math.max(
    1,
    Math.ceil(activeWithdrawals.length / PAGE_SIZE)
  );
  const currentPage = Math.min(page, totalPages);
  const firstResultIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleWithdrawals = activeWithdrawals.slice(
    firstResultIndex,
    firstResultIndex + PAGE_SIZE
  );
  const firstVisibleResult = activeWithdrawals.length
    ? firstResultIndex + 1
    : 0;
  const lastVisibleResult = Math.min(
    firstResultIndex + PAGE_SIZE,
    activeWithdrawals.length
  );
  const isRefreshing = fetchingPending || fetchingApproved || fetchingRejected;

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    {
      key: "pending",
      label: "Pendentes",
      count: pendingWithdrawals?.length || 0,
    },
    {
      key: "approved",
      label: "Aprovados",
      count: approvedWithdrawals?.length || 0,
    },
    {
      key: "rejected",
      label: "Rejeitados",
      count: rejectedWithdrawals?.length || 0,
    },
  ];

  const statCards = [
    {
      label: "Aguardando análise",
      value: stats?.pending?.count || 0,
      total: stats?.pending?.total || 0,
      description: "Solicitações que exigem ação",
      icon: Clock,
      tone: "amber",
    },
    {
      label: "Pagamentos aprovados",
      value: stats?.approved?.count || 0,
      total: stats?.approved?.total || 0,
      description: "Saques validados pela operação",
      icon: CheckCircle2,
      tone: "green",
    },
    {
      label: "Solicitações rejeitadas",
      value: stats?.rejected?.count || 0,
      total: stats?.rejected?.total || 0,
      description: "Pedidos recusados na análise",
      icon: XCircle,
      tone: "red",
    },
  ];

  const selectedMethod: PaymentMethod = selectedWithdrawal
    ? getPaymentMethod(selectedWithdrawal)
    : "pix";
  const selectedIsFaucetPay = selectedMethod === "faucetpay";

  const renderProof = (withdrawal: any) => {
    if (withdrawal.tx_hash) {
      return (
        <button
          type="button"
          onClick={() => copyToClipboard(String(withdrawal.tx_hash))}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#f15a63] transition hover:text-[#ff858b]"
          title={String(withdrawal.tx_hash)}
        >
          <ReceiptText className="h-3.5 w-3.5" />
          Copiar transação
        </button>
      );
    }

    if (withdrawal.receipt_url) {
      return (
        <a
          href={withdrawal.receipt_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#f15a63] transition hover:text-[#ff858b]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ver comprovante
        </a>
      );
    }

    return <span className="text-xs text-[#676d77]">Sem comprovante</span>;
  };

  const renderActions = (withdrawal: any, mobile = false) => {
    if (activeTab === "pending") {
      return (
        <div
          className={
            "flex items-center " + (mobile ? "gap-2" : "justify-end gap-2")
          }
        >
          <button
            type="button"
            onClick={() => openApproveDialog(withdrawal)}
            className={
              (mobile ? "h-10 flex-1 px-3" : "h-9 px-3") +
              " inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-sm font-medium text-emerald-300 transition hover:border-emerald-500/40 hover:bg-emerald-500/15"
            }
          >
            <ShieldCheck className="h-4 w-4" />
            Revisar
          </button>
          <button
            type="button"
            onClick={() => openRejectDialog(withdrawal)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#563038] bg-[#211317] text-[#ff6971] transition hover:border-[#823943] hover:bg-[#2d171c]"
            aria-label={"Rejeitar saque " + withdrawal.id}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      );
    }

    if (activeTab === "approved") {
      return (
        <div className={"flex items-center " + (mobile ? "w-full gap-2" : "justify-end gap-2")}>
          {canRetryPix(withdrawal) && (
            <button
              type="button"
              onClick={() => openApproveDialog(withdrawal)}
              className={
                (mobile ? "h-10 flex-1 px-3" : "h-9 px-3") +
                " inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 text-sm font-medium text-amber-300 transition hover:border-amber-500/40 hover:bg-amber-500/15"
              }
            >
              <RefreshCw className="h-4 w-4" />
              Reenviar PIX
            </button>
          )}
          <button
            type="button"
            onClick={() => openEditReceiptDialog(withdrawal)}
            className={
              (mobile ? "h-10 flex-1 px-3" : "h-9 px-3") +
              " inline-flex items-center justify-center gap-2 rounded-lg border border-[#3b3034] bg-[#171216] text-sm font-medium text-[#e3b5b8] transition hover:border-[#69323a] hover:bg-[#251519] hover:text-white"
            }
          >
            <Pencil className="h-4 w-4" />
            Comprovante
          </button>
        </div>
      );
    }

    return <span className="text-xs text-[#626873]">Sem ações</span>;
  };

  const renderWithdrawalDetails = (withdrawal: any) => {
    const method = getPaymentMethod(withdrawal);
    const destination = getDestinationAddress(withdrawal, method);
    const cryptoInfo = getCryptoInfo(withdrawal, method);

    return (
      <div className="rounded-lg border border-[#2b2e35] bg-[#101319] px-4">
        <DetailRow label="Usuário">
          <span className="block">
            {withdrawal.user_name || "Não informado"}
          </span>
          <span className="mt-0.5 block text-xs font-normal text-[#777e89]">
            {withdrawal.user_email || "E-mail não informado"}
          </span>
        </DetailRow>
        <DetailRow label="País">
          {countryName(withdrawal.country_code)}
        </DetailRow>
        <DetailRow label="Valor">
          <span className="text-white">
            {formatCurrency(withdrawal.amount)}
          </span>
          {cryptoInfo && (
            <span className="mt-0.5 block font-mono text-xs text-amber-300">
              {cryptoInfo}
            </span>
          )}
        </DetailRow>
        <DetailRow label="Método">
          <PaymentMethodBadge method={method} />
        </DetailRow>
        <DetailRow
          label={method === "faucetpay" ? "Conta de destino" : "Chave PIX"}
        >
          <span className="flex max-w-[280px] items-center justify-end gap-2">
            <span className="truncate font-mono text-xs" title={destination}>
              {destination}
            </span>
            {destination !== "Não informado" && (
              <button
                type="button"
                onClick={() => copyToClipboard(destination)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#30333b] bg-[#15181e] text-[#9ca2ad] transition hover:border-[#5f3037] hover:text-white"
                aria-label="Copiar destino"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        </DetailRow>
        <DetailRow label="Monetag do usuário">
          {formatCurrency(withdrawal.monetag_user_day || 0)}
        </DetailRow>
        <DetailRow label="Monetag total do dia">
          {formatCurrency(withdrawal.monetag_all_day || 0)}
        </DetailRow>
      </div>
    );
  };

  return (
    <div className="space-y-4 text-[#f4f5f7] sm:space-y-5">
      <section className="flex flex-col gap-4 rounded-xl border border-[#282b32] bg-[#0d1015]/95 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.3)] sm:p-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#8e949f]">
            <LayoutDashboard className="h-3.5 w-3.5 text-[#ef3943]" />
            <span>Painel</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-[#ef555d]">Saques</span>
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Operação de saques
          </h1>
          <p className="mt-1 text-sm text-[#9197a3]">
            Analise solicitações, confirme pagamentos e mantenha os limites sob
            controle.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setShowConfig(current => !current)}
            aria-expanded={showConfig}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#343740] bg-[#11141a] px-4 text-sm font-medium text-[#b7bbc3] transition hover:border-[#5d3138] hover:bg-[#1c1316] hover:text-white"
          >
            <Settings2 className="h-4 w-4 text-[#ef555d]" />
            Configurações
            <ChevronDown
              className={
                "h-4 w-4 transition-transform " +
                (showConfig ? "rotate-180" : "")
              }
            />
          </button>
          <button
            type="button"
            onClick={handleRefreshPixBalance}
            disabled={fetchingPixBalance}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-300 transition hover:border-emerald-500/40 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Wallet
              className={
                "h-4 w-4 " + (fetchingPixBalance ? "animate-pulse" : "")
              }
            />
            {pixBalance?.balance?.formatted_available || "Ver saldo PIX"}
          </button>
          <button
            type="button"
            onClick={refetchAll}
            disabled={isRefreshing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#3a2529] bg-[#1a1114] px-4 text-sm font-medium text-[#ff747b] transition hover:border-[#713139] hover:bg-[#271519] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={"h-4 w-4 " + (isRefreshing ? "animate-spin" : "")}
            />
            Atualizar dados
          </button>
        </div>
      </section>

      {pixBalance?.balance && (
        <section className="grid gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 sm:grid-cols-3 sm:p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-emerald-300/70">
              Saldo disponível na conta PIX
            </p>
            <p className="mt-1 text-2xl font-semibold text-emerald-200">
              {pixBalance.balance.formatted_available || "R$ 0,00"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#8e949f]">
              Saldo bloqueado
            </p>
            <p className="mt-1 text-lg font-medium text-white">
              {pixBalance.balance.formatted_blocked || "R$ 0,00"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#b9c0cb] sm:justify-end">
            <Wallet className="h-4 w-4 text-emerald-300" />
            {pixBalance.wallet_available ? "Carteira disponível" : "Carteira indisponível"}
          </div>
        </section>
      )}

      {showConfig && (
        <Card className="gap-0 overflow-hidden rounded-xl border-[#34292c] bg-[#0d1015] py-0 shadow-[0_18px_42px_rgba(0,0,0,0.3)]">
          <div className="flex flex-col gap-3 border-b border-[#292c33] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#542a31] bg-[#251418] text-[#ef555d]">
                <Settings2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">
                  Regras de saque
                </h2>
                <p className="mt-1 text-sm text-[#858b96]">
                  Limites, conversão e métodos disponíveis para os usuários.
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="w-fit rounded-full border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300"
            >
              <Activity className="h-3.5 w-3.5" />
              Configuração ativa
            </Badge>
          </div>

          <CardContent className="space-y-5 p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="min-withdrawal" className="text-[#c7cbd2]">
                  Saque mínimo (R$)
                </Label>
                <Input
                  id="min-withdrawal"
                  inputMode="decimal"
                  value={configForm.min_withdrawal_brl}
                  onChange={event =>
                    handleConfigFieldChange(
                      "min_withdrawal_brl",
                      event.target.value
                    )
                  }
                  className="h-10 rounded-lg border-[#30333b] bg-[#090c11] text-white focus-visible:border-[#ef3943] focus-visible:ring-[#ef3943]/15"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-withdrawal" className="text-[#c7cbd2]">
                  Saque máximo (R$)
                </Label>
                <Input
                  id="max-withdrawal"
                  inputMode="decimal"
                  value={configForm.max_withdrawal_brl}
                  onChange={event =>
                    handleConfigFieldChange(
                      "max_withdrawal_brl",
                      event.target.value
                    )
                  }
                  className="h-10 rounded-lg border-[#30333b] bg-[#090c11] text-white focus-visible:border-[#ef3943] focus-visible:ring-[#ef3943]/15"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min-points" className="text-[#c7cbd2]">
                  Pontos mínimos
                </Label>
                <Input
                  id="min-points"
                  inputMode="numeric"
                  value={configForm.min_withdrawal_points}
                  onChange={event =>
                    handleConfigFieldChange(
                      "min_withdrawal_points",
                      event.target.value
                    )
                  }
                  className="h-10 rounded-lg border-[#30333b] bg-[#090c11] text-white focus-visible:border-[#ef3943] focus-visible:ring-[#ef3943]/15"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="points-rate" className="text-[#c7cbd2]">
                  Pontos por real
                </Label>
                <Input
                  id="points-rate"
                  inputMode="numeric"
                  value={configForm.points_per_real}
                  onChange={event =>
                    handleConfigFieldChange(
                      "points_per_real",
                      event.target.value
                    )
                  }
                  className="h-10 rounded-lg border-[#30333b] bg-[#090c11] text-white focus-visible:border-[#ef3943] focus-visible:ring-[#ef3943]/15"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="withdrawal-methods" className="text-[#c7cbd2]">
                  Métodos habilitados
                </Label>
                <Input
                  id="withdrawal-methods"
                  value={configForm.withdrawal_methods}
                  onChange={event =>
                    handleConfigFieldChange(
                      "withdrawal_methods",
                      event.target.value
                    )
                  }
                  className="h-10 rounded-lg border-[#30333b] bg-[#090c11] text-white focus-visible:border-[#ef3943] focus-visible:ring-[#ef3943]/15"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-values" className="text-[#c7cbd2]">
                  Valores rápidos (R$)
                </Label>
                <Input
                  id="quick-values"
                  value={configForm.quick_values}
                  onChange={event =>
                    handleConfigFieldChange("quick_values", event.target.value)
                  }
                  className="h-10 rounded-lg border-[#30333b] bg-[#090c11] text-white focus-visible:border-[#ef3943] focus-visible:ring-[#ef3943]/15"
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 border-t border-[#292c33] pt-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm text-[#9a9faa]">
                  Faixa atual: {formatCurrency(configForm.min_withdrawal_brl)} a{" "}
                  {formatCurrency(configForm.max_withdrawal_brl)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {parseQuickValues(configForm.quick_values).map(value => (
                    <span
                      key={value}
                      className="rounded-md border border-[#332e32] bg-[#151418] px-2 py-1 text-xs text-[#9da2ac]"
                    >
                      {formatCurrency(value)}
                    </span>
                  ))}
                </div>
              </div>
              <Button
                type="button"
                onClick={handleSaveWithdrawalConfig}
                disabled={
                  loadingWithdrawalConfig ||
                  saveWithdrawalConfigMutation.isPending
                }
                className="h-10 rounded-lg bg-[#d9323c] px-4 text-white hover:bg-[#ee3d47]"
              >
                {saveWithdrawalConfigMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar regras
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section
        aria-label="Resumo dos saques"
        className="grid gap-3 md:grid-cols-3"
      >
        {statCards.map(card => {
          const toneClasses =
            card.tone === "green"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              : card.tone === "amber"
                ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                : "border-[#672e36] bg-[#281519] text-[#ff6d75]";

          return (
            <Card
              key={card.label}
              className="group gap-0 overflow-hidden rounded-xl border-[#282b32] bg-[linear-gradient(145deg,#11141a_0%,#0c0f14_100%)] py-0 shadow-[0_16px_38px_rgba(0,0,0,0.28)] transition hover:border-[#503036]"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#a7acb6]">
                      {card.label}
                    </p>
                    <p className="mt-3 text-[1.7rem] font-semibold leading-9 tracking-tight text-white">
                      {numberFormatter.format(card.value)}
                    </p>
                    <p className="mt-0.5 text-sm font-medium tabular-nums text-[#d1d4da]">
                      {formatCurrency(card.total)}
                    </p>
                    <p className="mt-2 text-xs text-[#777e8a]">
                      {card.description}
                    </p>
                  </div>
                  <div
                    className={
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border " +
                      toneClasses
                    }
                  >
                    <card.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
              </CardContent>
              <div className="h-px bg-gradient-to-r from-transparent via-[#ef3943]/40 to-transparent" />
            </Card>
          );
        })}
      </section>

      <Card className="gap-0 overflow-hidden rounded-xl border-[#282b32] bg-[#0d1015] py-0 shadow-[0_18px_42px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col gap-4 border-b border-[#252830] p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="h-4.5 w-4.5 text-[#ef555d]" />
              <h2 className="text-lg font-semibold text-white">
                Solicitações de saque
              </h2>
            </div>
            <p className="mt-1 text-sm text-[#858b96]">
              {numberFormatter.format(activeWithdrawals.length)} registros neste
              status
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Filtrar saques por status"
            className="flex w-full gap-1 overflow-x-auto rounded-lg border border-[#2c2f37] bg-[#090c11] p-1 xl:w-auto"
          >
            {tabs.map(tab => (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={
                  "inline-flex min-w-fit flex-1 items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition xl:flex-none " +
                  (activeTab === tab.key
                    ? "bg-[#2a1519] text-[#ff747b] shadow-[inset_0_0_0_1px_rgba(239,57,67,0.35)]"
                    : "text-[#858b96] hover:bg-[#15181e] hover:text-white")
                }
              >
                {tab.label}
                <span
                  className={
                    "rounded-full px-1.5 py-0.5 text-xs " +
                    (activeTab === tab.key
                      ? "bg-[#ef3943]/15 text-[#ff8c92]"
                      : "bg-[#20242c] text-[#7d838e]")
                  }
                >
                  {numberFormatter.format(tab.count)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {activeState.loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-[#858b96]">
            <Loader2 className="h-6 w-6 animate-spin text-[#ef3943]" />
            Carregando solicitações...
          </div>
        ) : activeWithdrawals.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#40262b] bg-[#211317] text-[#ef555d]">
              <Wallet className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-medium text-white">
              Nenhum saque encontrado
            </h3>
            <p className="mt-1 max-w-sm text-sm text-[#858b96]">
              Não há solicitações disponíveis para o status selecionado.
            </p>
          </div>
        ) : isMobile ? (
          <div className="divide-y divide-[#252830]">
            {visibleWithdrawals.map(withdrawal => {
              const method = getPaymentMethod(withdrawal);
              const destination = getDestinationAddress(withdrawal, method);
              const cryptoInfo = getCryptoInfo(withdrawal, method);

              return (
                <article key={withdrawal.id} className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-[#777e8a]">
                        Solicitação #{withdrawal.id}
                      </p>
                      <p className="mt-1 text-xl font-semibold tabular-nums text-white">
                        {formatCurrency(withdrawal.amount)}
                      </p>
                      {cryptoInfo && (
                        <p className="mt-0.5 font-mono text-xs text-amber-300">
                          {cryptoInfo}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={withdrawal.status} />
                  </div>

                  <div className="rounded-lg border border-[#272a31] bg-[#101319] p-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#49262c] bg-[#241418] text-[#ef555d]">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {withdrawal.user_name || "Usuário não informado"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[#7d838e]">
                          {withdrawal.user_email || "E-mail não informado"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 border-t border-[#272a31] pt-3 text-xs text-[#8f959f]">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-[#ef555d]" />
                        {countryName(withdrawal.country_code)}
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5 text-[#ef555d]" />
                        {formatDate(withdrawal.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-[#272a31] bg-[#101319] p-3">
                      <p className="text-xs text-[#777e8a]">Método</p>
                      <div className="mt-2">
                        <PaymentMethodBadge method={method} />
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#272a31] bg-[#101319] p-3">
                      <p className="text-xs text-[#777e8a]">
                        Monetag / usuário
                      </p>
                      <p className="mt-2 text-sm font-semibold tabular-nums text-[#d9dce2]">
                        {formatCurrency(withdrawal.monetag_user_day || 0)}
                      </p>
                      <p className="mt-0.5 text-xs text-[#707680]">
                        Dia: {formatCurrency(withdrawal.monetag_all_day || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#272a31] bg-[#101319] p-3">
                    <p className="text-xs text-[#777e8a]">Destino</p>
                    <div className="mt-2 flex min-w-0 items-center gap-2">
                      <span
                        className="min-w-0 flex-1 truncate font-mono text-xs text-[#b7bbc3]"
                        title={destination}
                      >
                        {destination}
                      </span>
                      {destination !== "Não informado" && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(destination)}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#30333b] text-[#9ca2ad] transition hover:border-[#5f3037] hover:text-white"
                          aria-label="Copiar destino"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-[#252830] pt-3">
                    {renderProof(withdrawal)}
                  </div>
                  {renderActions(withdrawal, true)}
                </article>
              );
            })}
          </div>
        ) : (
          <Table className="min-w-[1240px]">
            <TableHeader className="bg-[#0a0d12] [&_tr]:border-[#252830]">
              <TableRow className="border-[#252830] hover:bg-transparent">
                <TableHead className="h-11 px-5 text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                  Solicitação
                </TableHead>
                <TableHead className="h-11 px-4 text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                  Usuário
                </TableHead>
                <TableHead className="h-11 px-4 text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                  Valor
                </TableHead>
                <TableHead className="h-11 px-4 text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                  Método
                </TableHead>
                <TableHead className="h-11 px-4 text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                  Destino
                </TableHead>
                <TableHead className="h-11 px-4 text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                  Monetag
                </TableHead>
                <TableHead className="h-11 px-4 text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                  Status
                </TableHead>
                <TableHead className="h-11 px-5 text-right text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleWithdrawals.map(withdrawal => {
                const method = getPaymentMethod(withdrawal);
                const destination = getDestinationAddress(withdrawal, method);
                const cryptoInfo = getCryptoInfo(withdrawal, method);

                return (
                  <TableRow
                    key={withdrawal.id}
                    className="border-[#252830] hover:bg-white/[0.025]"
                  >
                    <TableCell className="px-5 py-4">
                      <p className="font-mono text-xs font-medium text-[#d0d3d9]">
                        #{withdrawal.id}
                      </p>
                      <p className="mt-1 text-xs text-[#707680]">
                        {formatDate(withdrawal.created_at)}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[230px] px-4 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#49262c] bg-[#241418] text-[#ef555d]">
                          <UserRound className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">
                            {withdrawal.user_name || "Usuário não informado"}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[#777e8a]">
                            {withdrawal.user_email || "E-mail não informado"}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-[#676d77]">
                            <MapPin className="h-3 w-3" />
                            {countryName(withdrawal.country_code)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <p className="text-sm font-semibold tabular-nums text-white">
                        {formatCurrency(withdrawal.amount)}
                      </p>
                      {cryptoInfo && (
                        <p className="mt-1 font-mono text-xs text-amber-300">
                          {cryptoInfo}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <PaymentMethodBadge method={method} />
                    </TableCell>
                    <TableCell className="max-w-[210px] px-4 py-4">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="min-w-0 flex-1 truncate font-mono text-xs text-[#9ba1ac]"
                          title={destination}
                        >
                          {destination}
                        </span>
                        {destination !== "Não informado" && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(destination)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#30333b] bg-[#11141a] text-[#8e949f] transition hover:border-[#5f3037] hover:bg-[#1d1215] hover:text-white"
                            aria-label={
                              "Copiar destino do saque " + withdrawal.id
                            }
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <p className="text-xs text-[#777e8a]">Usuário / dia</p>
                      <p className="mt-0.5 text-sm font-medium tabular-nums text-[#d7dae0]">
                        {formatCurrency(withdrawal.monetag_user_day || 0)}
                      </p>
                      <p className="mt-1 text-xs tabular-nums text-[#707680]">
                        Total: {formatCurrency(withdrawal.monetag_all_day || 0)}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <StatusBadge status={withdrawal.status} />
                      <div className="mt-2">{renderProof(withdrawal)}</div>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-right">
                      {renderActions(withdrawal)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {!activeState.loading && activeWithdrawals.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-[#252830] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs text-[#7d838e]" aria-live="polite">
              Mostrando {numberFormatter.format(firstVisibleResult)}–
              {numberFormatter.format(lastVisibleResult)} de{" "}
              {numberFormatter.format(activeWithdrawals.length)}
            </p>

            <Pagination className="mx-0 w-auto justify-start sm:justify-end">
              <PaginationContent>
                <PaginationItem>
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(currentPage - 1, 1))}
                    disabled={currentPage === 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#30333b] bg-[#11141a] text-[#a4aab5] transition hover:border-[#5f2d34] hover:bg-[#1d1215] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </PaginationItem>
                <PaginationItem>
                  <span className="inline-flex h-9 min-w-24 items-center justify-center rounded-lg border border-[#30333b] bg-[#090c11] px-3 text-xs text-[#8f959f]">
                    {currentPage} de {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <button
                    type="button"
                    onClick={() =>
                      setPage(Math.min(currentPage + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#30333b] bg-[#11141a] text-[#a4aab5] transition hover:border-[#5f2d34] hover:bg-[#1d1215] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>

      <Dialog
        open={showApproveDialog}
        onOpenChange={open => {
          if (!open) handleCloseApproveDialog();
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto border-[#30333b] bg-[#0d1015] text-[#f4f5f7] shadow-[0_28px_80px_rgba(0,0,0,0.58)] sm:max-w-xl">
          <DialogHeader>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#553038] bg-[#251519] text-[#f05a63]">
              {selectedIsFaucetPay ? (
                <Bitcoin className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <DialogTitle className="pt-1 text-xl text-white">
              Revisar saque #{selectedWithdrawal?.id}
            </DialogTitle>
            <DialogDescription className="text-[#858b96]">
              {selectedIsFaucetPay
                ? "Confirme os dados antes de enviar o pagamento em tempo real."
                : "Confirme os dados antes de enviar o pagamento via PIX em tempo real."}
            </DialogDescription>
          </DialogHeader>

          {selectedWithdrawal && (
            <div className="space-y-4">
              {renderWithdrawalDetails(selectedWithdrawal)}


              {selectedIsFaucetPay &&
                !faucetPayResult &&
                !faucetPayProcessing && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.07] p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-300" />
                      <div>
                        <p className="text-sm font-medium text-amber-200">
                          Pagamento irreversível
                        </p>
                        <p className="mt-1 text-xs leading-5 text-amber-200/65">
                          O valor será enviado imediatamente para a conta
                          FaucetPay informada. Confira destino, moeda e saldo
                          antes de continuar.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {!selectedIsFaucetPay &&
                !pixResult &&
                !pixProcessing && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.07] p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-300" />
                      <div>
                        <p className="text-sm font-medium text-amber-200">
                          Pagamento irreversível
                        </p>
                        <p className="mt-1 text-xs leading-5 text-amber-200/65">
                          O valor será enviado imediatamente para a chave PIX
                          informada. Confira o destinatário e o valor antes de continuar.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {faucetPayProcessing && (
                <div className="rounded-lg border border-[#673039] bg-[#28151a] p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#ff747b]" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        Processando pagamento
                      </p>
                      <p className="mt-1 text-xs text-[#aa8588]">
                        Aguarde a confirmação da FaucetPay.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {pixProcessing && (
                <div className="rounded-lg border border-[#673039] bg-[#28151a] p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#ff747b]" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        Processando pagamento PIX
                      </p>
                      <p className="mt-1 text-xs text-[#aa8588]">
                        Aguarde a confirmação da instituição financeira.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {pixResult?.success && (
                <div className="space-y-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] p-4">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="text-sm font-semibold">Pagamento PIX confirmado</p>
                  </div>
                  <div className="space-y-2 border-t border-emerald-500/15 pt-3 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-[#858b96]">Status</span>
                      <span className="font-medium text-emerald-300">{pixResult.status}</span>
                    </div>
                    {pixResult.tx_hash && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[#858b96]">Transação</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(String(pixResult.tx_hash))}
                          className="flex min-w-0 items-center gap-1.5 font-mono text-emerald-300 hover:text-emerald-200"
                        >
                          <span className="max-w-[180px] truncate">{String(pixResult.tx_hash)}</span>
                          <Copy className="h-3.5 w-3.5 shrink-0" />
                        </button>
                      </div>
                    )}
                    {pixResult.receipt_url && (
                      <a
                        href={pixResult.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir comprovante
                      </a>
                    )}
                    <p className="leading-5 text-[#9ca2ad]">{pixResult.message}</p>
                  </div>
                </div>
              )}

              {pixResult && !pixResult.success && (
                <div className="space-y-2 rounded-lg border border-[#6d3039] bg-[#28151a] p-4">
                  <div className="flex items-center gap-2 text-[#ff747b]">
                    <XCircle className="h-5 w-5" />
                    <p className="text-sm font-semibold">Pagamento PIX não concluído</p>
                  </div>
                  <p className="text-xs leading-5 text-[#ba8b8f]">
                    {pixResult.message}. A solicitação pode ser reenviada depois de conferir os dados.
                  </p>
                  <Button
                    type="button"
                    onClick={handlePayPix}
                    disabled={pixProcessing}
                    className="h-9 rounded-lg bg-amber-600 px-3 text-xs text-white hover:bg-amber-500"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Enviar novamente
                  </Button>
                </div>
              )}

              {faucetPayResult?.success && (
                <div className="space-y-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] p-4">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="text-sm font-semibold">
                      Pagamento confirmado
                    </p>
                  </div>
                  <div className="space-y-2 border-t border-emerald-500/15 pt-3 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-[#858b96]">Status</span>
                      <span className="font-medium text-emerald-300">
                        {faucetPayResult.status}
                      </span>
                    </div>
                    {faucetPayResult.tx_hash && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[#858b96]">Transação</span>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(String(faucetPayResult.tx_hash))
                          }
                          className="flex min-w-0 items-center gap-1.5 font-mono text-emerald-300 hover:text-emerald-200"
                        >
                          <span className="max-w-[180px] truncate">
                            {String(faucetPayResult.tx_hash)}
                          </span>
                          <Copy className="h-3.5 w-3.5 shrink-0" />
                        </button>
                      </div>
                    )}
                    {faucetPayResult.balance_remaining !== null &&
                      faucetPayResult.balance_remaining !== undefined && (
                        <div className="flex justify-between gap-3">
                          <span className="text-[#858b96]">Saldo restante</span>
                          <span className="font-mono text-[#d9dce2]">
                            {(
                              Number(faucetPayResult.balance_remaining) /
                              100000000
                            ).toFixed(8)}{" "}
                            USDT
                          </span>
                        </div>
                      )}
                    <p className="leading-5 text-[#9ca2ad]">
                      {faucetPayResult.message}
                    </p>
                  </div>
                </div>
              )}

              {faucetPayResult && !faucetPayResult.success && (
                <div className="space-y-2 rounded-lg border border-[#6d3039] bg-[#28151a] p-4">
                  <div className="flex items-center gap-2 text-[#ff747b]">
                    <XCircle className="h-5 w-5" />
                    <p className="text-sm font-semibold">
                      Pagamento não concluído
                    </p>
                  </div>
                  <p className="text-xs leading-5 text-[#ba8b8f]">
                    {faucetPayResult.message}. A solicitação voltou para
                    pendente e pode ser revisada novamente.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="border-t border-[#292c33] pt-4">
            {faucetPayResult || pixResult ? (
              <Button
                type="button"
                onClick={handleCloseApproveDialog}
                className="h-10 rounded-lg bg-[#d9323c] px-4 text-white hover:bg-[#ee3d47]"
              >
                Fechar
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseApproveDialog}
                  disabled={faucetPayProcessing || pixProcessing}
                  className="h-10 rounded-lg border-[#343740] bg-[#11141a] text-[#b7bbc3] hover:bg-[#1a1d24] hover:text-white"
                >
                  Cancelar
                </Button>
                {selectedIsFaucetPay ? (
                  <Button
                    type="button"
                    onClick={handleApproveFaucetPay}
                    disabled={faucetPayProcessing}
                    className="h-10 rounded-lg bg-[#d9323c] px-4 text-white hover:bg-[#ee3d47]"
                  >
                    {faucetPayProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {faucetPayProcessing
                      ? "Processando..."
                      : "Pagar via FaucetPay"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handlePayPix}
                    disabled={pixProcessing}
                    className="h-10 rounded-lg bg-emerald-600 px-4 text-white hover:bg-emerald-500"
                  >
                    {pixProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="h-4 w-4" />
                    )}
                    {pixProcessing ? "Processando..." : "Pagar via PIX"}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditReceiptDialog}
        onOpenChange={open => {
          if (!open) handleCloseEditReceiptDialog();
        }}
      >
        <DialogContent className="border-[#30333b] bg-[#0d1015] text-[#f4f5f7] shadow-[0_28px_80px_rgba(0,0,0,0.58)]">
          <DialogHeader>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#553038] bg-[#251519] text-[#f05a63]">
              <ReceiptText className="h-5 w-5" />
            </div>
            <DialogTitle className="pt-1 text-xl text-white">
              Comprovante do saque #{selectedWithdrawal?.id}
            </DialogTitle>
            <DialogDescription className="text-[#858b96]">
              Adicione ou atualize o link usado para consultar o comprovante.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="edit-receipt-url" className="text-[#c7cbd2]">
              URL do comprovante
            </Label>
            <div className="relative">
              <ReceiptText className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#707680]" />
              <Input
                id="edit-receipt-url"
                type="url"
                placeholder="https://exemplo.com/comprovante.png"
                value={receiptUrl}
                onChange={event => setReceiptUrl(event.target.value)}
                className="h-11 rounded-lg border-[#30333b] bg-[#090c11] pl-10 text-white placeholder:text-[#5f6570] focus-visible:border-[#ef3943] focus-visible:ring-[#ef3943]/15"
              />
            </div>
          </div>
          <DialogFooter className="border-t border-[#292c33] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseEditReceiptDialog}
              className="h-10 rounded-lg border-[#343740] bg-[#11141a] text-[#b7bbc3] hover:bg-[#1a1d24] hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!selectedWithdrawal) return;
                updateStatusMutation.mutate({
                  id: selectedWithdrawal.id,
                  status: "approved",
                  receiptUrl,
                });
              }}
              disabled={updateStatusMutation.isPending}
              className="h-10 rounded-lg bg-[#d9323c] px-4 text-white hover:bg-[#ee3d47]"
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar comprovante
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showRejectDialog}
        onOpenChange={open => {
          if (!open) handleCloseRejectDialog();
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto border-[#30333b] bg-[#0d1015] text-[#f4f5f7] shadow-[0_28px_80px_rgba(0,0,0,0.58)] sm:max-w-xl">
          <DialogHeader>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#6d3039] bg-[#2a1519] text-[#ff6971]">
              <XCircle className="h-5 w-5" />
            </div>
            <DialogTitle className="pt-1 text-xl text-white">
              Cancelar saque #{selectedWithdrawal?.id}
            </DialogTitle>
            <DialogDescription className="text-[#858b96]">
              Ao confirmar, os pontos debitados serão devolvidos à conta do
              usuário e o histórico receberá o registro “Chave PIX incorreta”.
            </DialogDescription>
          </DialogHeader>

          {selectedWithdrawal && renderWithdrawalDetails(selectedWithdrawal)}

          <div className="rounded-lg border border-[#653039] bg-[#271519] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#ff747b]" />
              <p className="text-xs leading-5 text-[#bd8d91]">
                O saque será cancelado, os pontos devolvidos e o histórico
                atualizado com “Chave PIX incorreta”.
              </p>
            </div>
          </div>

          <DialogFooter className="border-t border-[#292c33] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseRejectDialog}
              className="h-10 rounded-lg border-[#343740] bg-[#11141a] text-[#b7bbc3] hover:bg-[#1a1d24] hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!selectedWithdrawal) return;
                updateStatusMutation.mutate({
                  id: selectedWithdrawal.id,
                  status: "rejected",
                });
              }}
              disabled={updateStatusMutation.isPending}
              className="h-10 rounded-lg bg-[#c72c35] px-4 text-white hover:bg-[#dc3540]"
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Confirmar cancelamento e devolver pontos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
