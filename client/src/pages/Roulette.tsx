import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dices,
  History,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Save,
  Settings2,
  SlidersHorizontal,
  Trophy,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type RouletteSetting = {
  id: number;
  setting_key: string;
  setting_value: string;
  description?: string;
};

type SpinHistoryItem = {
  id: number;
  user_id: number;
  user_name?: string;
  prize_type: string;
  prize_value: string | number;
  created_at: string;
};

const HISTORY_PAGE_SIZE = 12;
const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatSettingTitle(key: string) {
  if (key === "max_daily_spins") return "Limite diário de giros";
  if (key === "monetag_required_impressions") {
    return "Impressões para desbloqueio";
  }

  if (key.startsWith("prize_")) {
    const prizeIndex = key.split("_")[1];
    return prizeIndex + "º prêmio";
  }

  return key.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function formatSettingDescription(setting: RouletteSetting) {
  if (setting.description?.trim()) return setting.description;

  if (setting.setting_key === "max_daily_spins") {
    return "Número máximo de tentativas liberadas para cada usuário por dia.";
  }

  if (setting.setting_key === "monetag_required_impressions") {
    return "Quantidade mínima de impressões antes de liberar uma nova tentativa.";
  }

  return "Parâmetro operacional utilizado pela roleta.";
}

function formatSettingCategory(key: string) {
  if (key.startsWith("prize_")) return "Premiação";
  if (key === "max_daily_spins") return "Controle";
  if (key === "monetag_required_impressions") return "Monetag";
  return "Sistema";
}

function getDisplayValue(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? numberFormatter.format(numericValue)
    : String(value || "0");
}

function formatPrizeType(value: string) {
  if (!value) return "Prêmio";

  return value.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem registro";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function Roulette() {
  const isMobile = useIsMobile();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  const {
    data: settings,
    isLoading: loadingSettings,
    isFetching: fetchingSettings,
    refetch: refetchSettings,
  } = trpc.roulette.settings.useQuery();
  const {
    data: spinHistory,
    isLoading: loadingHistory,
    isFetching: fetchingHistory,
    refetch: refetchHistory,
  } = trpc.roulette.spinHistory.useQuery({ limit: 50 });

  const updateSetting = trpc.roulette.updateSetting.useMutation({
    onSuccess: (_, variables) => {
      toast.success("Configuração atualizada com sucesso");
      setEditValues(current => {
        const nextValues = { ...current };
        delete nextValues[variables.key];
        return nextValues;
      });
      void refetchSettings();
    },
    onError: error => {
      toast.error(error.message || "Não foi possível salvar a configuração");
    },
    onSettled: () => setSavingKey(null),
  });

  const orderedSettings = useMemo(() => {
    if (!settings) return [] as RouletteSetting[];

    return [...(settings as RouletteSetting[])].sort((a, b) => {
      const aIsPrize = a.setting_key.startsWith("prize_");
      const bIsPrize = b.setting_key.startsWith("prize_");

      if (aIsPrize && bIsPrize) {
        return (
          Number(a.setting_key.split("_")[1]) -
          Number(b.setting_key.split("_")[1])
        );
      }

      if (a.setting_key === "max_daily_spins") return -1;
      if (b.setting_key === "max_daily_spins") return 1;
      if (a.setting_key === "monetag_required_impressions") return -1;
      if (b.setting_key === "monetag_required_impressions") return 1;
      if (aIsPrize) return 1;
      if (bIsPrize) return -1;

      return a.setting_key.localeCompare(b.setting_key);
    });
  }, [settings]);

  const operationalSettings = orderedSettings.filter(
    setting => !setting.setting_key.startsWith("prize_")
  );
  const prizeSettings = orderedSettings.filter(setting =>
    setting.setting_key.startsWith("prize_")
  );

  const topPrizeValue = prizeSettings.reduce((highestValue, setting) => {
    const currentValue = Number(setting.setting_value) || 0;
    return Math.max(highestValue, currentValue);
  }, 0);
  const dailyLimitValue =
    orderedSettings.find(setting => setting.setting_key === "max_daily_spins")
      ?.setting_value ?? "0";
  const unlockValue =
    orderedSettings.find(
      setting => setting.setting_key === "monetag_required_impressions"
    )?.setting_value ?? "0";

  const historyItems = (spinHistory || []) as SpinHistoryItem[];
  const totalHistoryPages = Math.max(
    1,
    Math.ceil(historyItems.length / HISTORY_PAGE_SIZE)
  );
  const currentHistoryPage = Math.min(historyPage, totalHistoryPages);
  const firstHistoryIndex = (currentHistoryPage - 1) * HISTORY_PAGE_SIZE;
  const visibleHistory = historyItems.slice(
    firstHistoryIndex,
    firstHistoryIndex + HISTORY_PAGE_SIZE
  );
  const firstVisibleHistory = historyItems.length ? firstHistoryIndex + 1 : 0;
  const lastVisibleHistory = Math.min(
    firstHistoryIndex + HISTORY_PAGE_SIZE,
    historyItems.length
  );
  const isRefreshing = fetchingSettings || fetchingHistory;

  const handleSave = (setting: RouletteSetting) => {
    const value = String(
      editValues[setting.setting_key] ?? setting.setting_value
    ).trim();
    const numericValue = Number(value);

    if (!value || !Number.isFinite(numericValue) || numericValue < 0) {
      toast.error("Informe um valor numérico válido");
      return;
    }

    setSavingKey(setting.setting_key);
    updateSetting.mutate({ key: setting.setting_key, value });
  };

  const refreshAll = () => {
    void refetchSettings();
    void refetchHistory();
  };

  const renderSettingControl = (setting: RouletteSetting, compact = false) => {
    const currentValue = String(
      editValues[setting.setting_key] ?? setting.setting_value
    );
    const hasChanged = currentValue !== String(setting.setting_value);
    const isSaving =
      updateSetting.isPending && savingKey === setting.setting_key;
    const Icon = setting.setting_key.startsWith("prize_") ? Trophy : Settings2;

    return (
      <article
        key={setting.id}
        className={
          "rounded-lg border border-[#292c33] bg-[#101319] transition hover:border-[#493036] " +
          (compact ? "p-4" : "p-4 sm:p-5")
        }
      >
        <div
          className={
            compact
              ? "space-y-4"
              : "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
          }
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#4e2930] bg-[#251418] text-[#ef555d]">
              <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-white">
                  {formatSettingTitle(setting.setting_key)}
                </h3>
                <span className="rounded-full border border-[#30333b] bg-[#171a20] px-2 py-0.5 text-xs text-[#7f8691]">
                  {formatSettingCategory(setting.setting_key)}
                </span>
              </div>
              {!compact && (
                <p className="mt-1 max-w-2xl text-sm leading-5 text-[#858b96]">
                  {formatSettingDescription(setting)}
                </p>
              )}
            </div>
          </div>

          <div
            className={
              "flex shrink-0 gap-2 " + (compact ? "w-full" : "w-full sm:w-auto")
            }
          >
            <Label
              htmlFor={"setting-" + setting.setting_key}
              className="sr-only"
            >
              {formatSettingTitle(setting.setting_key)}
            </Label>
            <div className="relative min-w-0 flex-1 sm:w-40 sm:flex-none">
              <Input
                id={"setting-" + setting.setting_key}
                type="number"
                min="0"
                inputMode="numeric"
                value={currentValue}
                onChange={event =>
                  setEditValues(current => ({
                    ...current,
                    [setting.setting_key]: event.target.value,
                  }))
                }
                onKeyDown={event => {
                  if (event.key === "Enter" && hasChanged) {
                    handleSave(setting);
                  }
                }}
                className="h-10 rounded-lg border-[#30333b] bg-[#090c11] pr-11 text-white focus-visible:border-[#ef3943] focus-visible:ring-[#ef3943]/15"
              />
              {setting.setting_key.startsWith("prize_") && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#686e79]">
                  pts
                </span>
              )}
            </div>
            <Button
              type="button"
              onClick={() => handleSave(setting)}
              disabled={updateSetting.isPending || !hasChanged}
              className="h-10 shrink-0 rounded-lg bg-[#d9323c] px-3.5 text-white hover:bg-[#ee3d47] disabled:bg-[#252830] disabled:text-[#686e79]"
              aria-label={"Salvar " + formatSettingTitle(setting.setting_key)}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className={compact ? "sr-only" : "hidden sm:inline"}>
                Salvar
              </span>
            </Button>
          </div>
        </div>
      </article>
    );
  };

  const statCards = [
    {
      label: "Maior prêmio",
      value: getDisplayValue(topPrizeValue),
      suffix: "pontos",
      description: "Valor máximo configurado",
      icon: Trophy,
      tone: "red",
    },
    {
      label: "Limite diário",
      value: getDisplayValue(dailyLimitValue),
      suffix: "giros",
      description: "Por usuário a cada dia",
      icon: Dices,
      tone: "amber",
    },
    {
      label: "Desbloqueio",
      value: getDisplayValue(unlockValue),
      suffix: "impressões",
      description: "Exigência mínima da Monetag",
      icon: Activity,
      tone: "green",
    },
  ];

  return (
    <div className="space-y-4 text-[#f4f5f7] sm:space-y-5">
      <section className="flex flex-col gap-4 rounded-xl border border-[#282b32] bg-[#0d1015]/95 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.3)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#8e949f]">
            <LayoutDashboard className="h-3.5 w-3.5 text-[#ef3943]" />
            <span>Painel</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-[#ef555d]">Roleta</span>
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Gestão da roleta
          </h1>
          <p className="mt-1 text-sm text-[#9197a3]">
            Controle limites, premiações e acompanhe os giros recentes.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshAll}
          disabled={isRefreshing}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#3a2529] bg-[#1a1114] px-4 text-sm font-medium text-[#ff747b] transition hover:border-[#713139] hover:bg-[#271519] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={"h-4 w-4 " + (isRefreshing ? "animate-spin" : "")}
          />
          Atualizar roleta
        </button>
      </section>

      <section
        aria-label="Resumo da roleta"
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
                    <div className="mt-3 min-h-9">
                      {loadingSettings ? (
                        <Skeleton className="h-8 w-24 bg-white/[0.06]" />
                      ) : (
                        <p className="text-[1.7rem] font-semibold leading-9 tracking-tight text-white">
                          {card.value}
                        </p>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-[#c7cbd2]">
                      {card.suffix}
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

      <Tabs defaultValue="settings" className="gap-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border border-[#2c2f37] bg-[#090c11] p-1 sm:w-fit">
          <TabsTrigger
            value="settings"
            className="h-9 rounded-md px-3.5 text-[#858b96] data-[state=active]:border-[#663038] data-[state=active]:bg-[#2a1519] data-[state=active]:text-[#ff747b] data-[state=active]:shadow-none"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Configurações
            <span className="rounded-full bg-[#20242c] px-1.5 py-0.5 text-xs text-[#8c929d]">
              {orderedSettings.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="h-9 rounded-md px-3.5 text-[#858b96] data-[state=active]:border-[#663038] data-[state=active]:bg-[#2a1519] data-[state=active]:text-[#ff747b] data-[state=active]:shadow-none"
          >
            <History className="h-4 w-4" />
            Histórico
            <span className="rounded-full bg-[#20242c] px-1.5 py-0.5 text-xs text-[#8c929d]">
              {historyItems.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card className="gap-0 overflow-hidden rounded-xl border-[#282b32] bg-[#0d1015] py-0 shadow-[0_18px_42px_rgba(0,0,0,0.3)]">
            <div className="flex items-start gap-3 border-b border-[#292c33] p-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#542a31] bg-[#251418] text-[#ef555d]">
                <Settings2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">
                  Regras operacionais
                </h2>
                <p className="mt-1 text-sm text-[#858b96]">
                  Parâmetros que controlam o acesso e a frequência dos giros.
                </p>
              </div>
            </div>

            <CardContent className="p-4 sm:p-5">
              {loadingSettings ? (
                <div className="space-y-3">
                  {[1, 2].map(item => (
                    <Skeleton
                      key={item}
                      className="h-28 w-full rounded-lg bg-white/[0.06]"
                    />
                  ))}
                </div>
              ) : operationalSettings.length ? (
                <div className="space-y-3">
                  {operationalSettings.map(setting =>
                    renderSettingControl(setting)
                  )}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[#858b96]">
                  Nenhuma regra operacional disponível.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden rounded-xl border-[#282b32] bg-[#0d1015] py-0 shadow-[0_18px_42px_rgba(0,0,0,0.3)]">
            <div className="flex items-start gap-3 border-b border-[#292c33] p-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#5e4725] bg-amber-500/10 text-amber-300">
                <Trophy className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">
                  Faixas de premiação
                </h2>
                <p className="mt-1 text-sm text-[#858b96]">
                  Pontos entregues em cada resultado configurado na roleta.
                </p>
              </div>
            </div>

            <CardContent className="p-4 sm:p-5">
              {loadingSettings ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map(item => (
                    <Skeleton
                      key={item}
                      className="h-32 w-full rounded-lg bg-white/[0.06]"
                    />
                  ))}
                </div>
              ) : prizeSettings.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {prizeSettings.map(setting =>
                    renderSettingControl(setting, true)
                  )}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[#858b96]">
                  Nenhuma faixa de premiação disponível.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="gap-0 overflow-hidden rounded-xl border-[#282b32] bg-[#0d1015] py-0 shadow-[0_18px_42px_rgba(0,0,0,0.3)]">
            <div className="flex items-start gap-3 border-b border-[#292c33] p-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#542a31] bg-[#251418] text-[#ef555d]">
                <History className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">
                  Histórico de giros
                </h2>
                <p className="mt-1 text-sm text-[#858b96]">
                  Últimos resultados registrados para conferência operacional.
                </p>
              </div>
            </div>

            {loadingHistory ? (
              <div className="space-y-3 p-5">
                {[1, 2, 3, 4, 5].map(item => (
                  <Skeleton
                    key={item}
                    className="h-14 w-full rounded-lg bg-white/[0.06]"
                  />
                ))}
              </div>
            ) : historyItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-20 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#40262b] bg-[#211317] text-[#ef555d]">
                  <Dices className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-medium text-white">
                  Nenhum giro registrado
                </h3>
                <p className="mt-1 max-w-sm text-sm text-[#858b96]">
                  Os resultados recentes aparecerão aqui quando houver
                  atividade.
                </p>
              </div>
            ) : isMobile ? (
              <div className="divide-y divide-[#252830]">
                {visibleHistory.map(spin => (
                  <article key={spin.id} className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#49262c] bg-[#241418] text-[#ef555d]">
                          <UserRound className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-medium text-white">
                            {spin.user_name || "Usuário #" + spin.user_id}
                          </h3>
                          <p className="mt-0.5 font-mono text-xs text-[#777e8a]">
                            Giro #{spin.id}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-amber-300">
                          {numberFormatter.format(
                            Number(spin.prize_value) || 0
                          )}{" "}
                          pts
                        </p>
                        <p className="mt-0.5 text-xs text-[#777e8a]">
                          {formatPrizeType(spin.prize_type)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-[#272a31] bg-[#101319] p-3 text-xs text-[#8f959f]">
                      <CalendarDays className="h-3.5 w-3.5 text-[#ef555d]" />
                      {formatDateTime(spin.created_at)}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Table className="min-w-[760px]">
                <TableHeader className="bg-[#0a0d12] [&_tr]:border-[#252830]">
                  <TableRow className="border-[#252830] hover:bg-transparent">
                    <TableHead className="h-11 px-5 text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                      Giro
                    </TableHead>
                    <TableHead className="h-11 px-4 text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                      Usuário
                    </TableHead>
                    <TableHead className="h-11 px-4 text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                      Resultado
                    </TableHead>
                    <TableHead className="h-11 px-4 text-right text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                      Pontos
                    </TableHead>
                    <TableHead className="h-11 px-5 text-right text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                      Data
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleHistory.map(spin => (
                    <TableRow
                      key={spin.id}
                      className="border-[#252830] hover:bg-white/[0.025]"
                    >
                      <TableCell className="px-5 py-4 font-mono text-xs text-[#8f959f]">
                        #{spin.id}
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#49262c] bg-[#241418] text-[#ef555d]">
                            <UserRound className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {spin.user_name || "Usuário #" + spin.user_id}
                            </p>
                            <p className="mt-0.5 text-xs text-[#707680]">
                              ID {spin.user_id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-[#9ba1ac]">
                        {formatPrizeType(spin.prize_type)}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-amber-300">
                        {numberFormatter.format(Number(spin.prize_value) || 0)}{" "}
                        pts
                      </TableCell>
                      <TableCell className="px-5 py-4 text-right text-sm text-[#8f959f]">
                        {formatDateTime(spin.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {!loadingHistory && historyItems.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-[#252830] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-xs text-[#7d838e]" aria-live="polite">
                  Mostrando {numberFormatter.format(firstVisibleHistory)}–
                  {numberFormatter.format(lastVisibleHistory)} de{" "}
                  {numberFormatter.format(historyItems.length)}
                </p>

                <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <button
                        type="button"
                        onClick={() =>
                          setHistoryPage(Math.max(currentHistoryPage - 1, 1))
                        }
                        disabled={currentHistoryPage === 1}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#30333b] bg-[#11141a] text-[#a4aab5] transition hover:border-[#5f2d34] hover:bg-[#1d1215] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label="Página anterior"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    </PaginationItem>
                    <PaginationItem>
                      <span className="inline-flex h-9 min-w-24 items-center justify-center rounded-lg border border-[#30333b] bg-[#090c11] px-3 text-xs text-[#8f959f]">
                        {currentHistoryPage} de {totalHistoryPages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <button
                        type="button"
                        onClick={() =>
                          setHistoryPage(
                            Math.min(currentHistoryPage + 1, totalHistoryPages)
                          )
                        }
                        disabled={currentHistoryPage === totalHistoryPages}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
