import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  ArrowRight,
  ArrowUpRight,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coins,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  Wifi,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: unknown) {
  if (!value) return "Sem registro";

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Sem registro";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function isUserBanned(user: any) {
  return (
    user.is_banned === 1 || user.is_banned === true || user.is_banned === "1"
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = trpc.dashboard.stats.useQuery();
  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = trpc.appUsers.list.useQuery({ limit: 8, offset: 0 });
  const {
    data: onlineData,
    isLoading: onlineLoading,
    refetch: refetchOnline,
  } = trpc.appUsers.onlineCount.useQuery({ minutesThreshold: 5 });
  const {
    data: withdrawalStats,
    isLoading: withdrawalStatsLoading,
    refetch: refetchWithdrawalStats,
  } = trpc.withdrawals.stats.useQuery();

  const users = usersData?.users || [];
  const totalUsers = toNumber(stats?.totalUsers);
  const activeUsersToday = Math.min(
    toNumber(stats?.activeUsersToday),
    totalUsers
  );
  const onlineUsers = Math.min(toNumber(onlineData?.count), totalUsers);
  const pendingWithdrawals = toNumber(stats?.pendingWithdrawals);
  const pendingWithdrawalsAmount = toNumber(stats?.pendingWithdrawalsAmount);
  const totalWithdrawn = toNumber(stats?.totalWithdrawn);
  const totalBalance = toNumber(stats?.totalBalance);
  const totalPoints = toNumber(stats?.totalPoints);
  const approvedWithdrawals = toNumber(withdrawalStats?.approved?.count);
  const rejectedWithdrawals = toNumber(withdrawalStats?.rejected?.count);
  const decisionCount = approvedWithdrawals + rejectedWithdrawals;
  const activePercentage =
    totalUsers > 0 ? (activeUsersToday / totalUsers) * 100 : 0;
  const onlinePercentage =
    totalUsers > 0 ? (onlineUsers / totalUsers) * 100 : 0;
  const otherUsers = Math.max(totalUsers - activeUsersToday, 0);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchStats(),
        refetchUsers(),
        refetchOnline(),
        refetchWithdrawalStats(),
      ]);
      setLastUpdatedAt(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const avatarColors = [
    "bg-[#c72c35]",
    "bg-[#48556a]",
    "bg-[#6d3bb2]",
    "bg-[#d28b24]",
    "bg-[#277a67]",
    "bg-[#8f354e]",
  ];

  const getAvatarColor = (id: unknown) =>
    avatarColors[Math.floor(Math.abs(toNumber(id))) % avatarColors.length];

  const statCards = [
    {
      title: "Base de usuários",
      value: numberFormatter.format(totalUsers),
      helper: activePercentage.toFixed(1) + "% ativos hoje",
      icon: Users,
      loading: statsLoading,
      tone: "red",
    },
    {
      title: "Online agora",
      value: numberFormatter.format(onlineUsers),
      helper: "Janela dos últimos 5 minutos",
      icon: Wifi,
      loading: onlineLoading,
      tone: "green",
    },
    {
      title: "Fila de saques",
      value: numberFormatter.format(pendingWithdrawals),
      helper: currencyFormatter.format(pendingWithdrawalsAmount),
      icon: Clock3,
      loading: statsLoading || withdrawalStatsLoading,
      tone: "amber",
    },
    {
      title: "Total processado",
      value: currencyFormatter.format(totalWithdrawn),
      helper: numberFormatter.format(approvedWithdrawals) + " aprovações",
      icon: CircleDollarSign,
      loading: statsLoading || withdrawalStatsLoading,
      tone: "red",
    },
  ];

  const financialRows = [
    {
      label: "Saldo disponível dos usuários",
      value: totalBalance,
      color: "bg-[#ef3943]",
    },
    {
      label: "Pagamentos aprovados",
      value: totalWithdrawn,
      color: "bg-[#a82a32]",
    },
    {
      label: "Aguardando pagamento",
      value: pendingWithdrawalsAmount,
      color: "bg-amber-400",
    },
  ];
  const largestFinancialValue = Math.max(
    ...financialRows.map(item => item.value),
    1
  );

  const queueState =
    pendingWithdrawals === 0
      ? {
          label: "Fila em dia",
          description: "Nenhuma solicitação aguardando análise.",
          icon: CheckCircle2,
          className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
        }
      : pendingWithdrawals <= 10
        ? {
            label: "Fila sob controle",
            description:
              numberFormatter.format(pendingWithdrawals) +
              " solicitações aguardando análise.",
            icon: Clock3,
            className: "border-amber-500/20 bg-amber-500/10 text-amber-300",
          }
        : {
            label: "Fila exige atenção",
            description:
              numberFormatter.format(pendingWithdrawals) +
              " solicitações aguardando análise.",
            icon: AlertTriangle,
            className: "border-[#713139] bg-[#2a1519] text-[#ff777e]",
          };
  const QueueIcon = queueState.icon;

  const dashboardLoading =
    statsLoading ||
    usersLoading ||
    onlineLoading ||
    withdrawalStatsLoading ||
    isRefreshing;

  const renderUserStatus = (user: any) =>
    isUserBanned(user) ? (
      <Badge
        variant="outline"
        className="rounded-full border-[#713139] bg-[#2a1519] px-2.5 py-1 text-[#ff777e]"
      >
        <Ban className="h-3.5 w-3.5" />
        Banido
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="rounded-full border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Ativo
      </Badge>
    );

  return (
    <div className="space-y-4 text-[#f4f5f7] sm:space-y-5">
      <section className="relative overflow-hidden rounded-xl border border-[#2b2e35] bg-[#0d1015] shadow-[0_20px_50px_rgba(0,0,0,0.34)]">
        <div className="absolute inset-y-0 left-0 w-1 bg-[#ef3943]" />
        <div className="flex flex-col gap-5 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#8e949f]">
              <LayoutDashboard className="h-3.5 w-3.5 text-[#ef3943]" />
              <span>Painel executivo</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-[#ef555d]">Visão geral</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
              Visão executiva
            </h1>
            <p className="mt-1.5 text-sm text-[#9197a3]">
              Indicadores consolidados de usuários, saldos e pagamentos.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center justify-center gap-2 rounded-lg border border-[#2d3037] bg-[#101319] px-3.5 py-2.5 text-xs text-[#858b96]">
              <span
                className={`h-2 w-2 rounded-full ${
                  dashboardLoading
                    ? "animate-pulse bg-amber-400"
                    : "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]"
                }`}
              />
              {dashboardLoading
                ? "Sincronizando dados"
                : `Atualizado às ${formatTime(lastUpdatedAt)}`}
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={dashboardLoading}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#552b32] bg-[#211317] px-4 text-sm font-medium text-[#ff747b] transition hover:border-[#813842] hover:bg-[#2b171b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={
                  "h-4 w-4 " + (dashboardLoading ? "animate-spin" : "")
                }
              />
              Atualizar dados
            </button>
          </div>
        </div>
      </section>

      <section
        aria-label="Indicadores principais"
        className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4"
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
              key={card.title}
              className="group relative gap-0 overflow-hidden rounded-xl border-[#2a2d34] bg-[#0e1116] py-0 shadow-[0_16px_38px_rgba(0,0,0,0.28)] transition hover:-translate-y-0.5 hover:border-[#503036]"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#a7acb6]">
                      {card.title}
                    </p>
                    <div className="mt-4 min-h-9">
                      {card.loading ? (
                        <Skeleton className="h-8 w-28 rounded-md bg-white/[0.06]" />
                      ) : (
                        <p className="truncate text-[1.7rem] font-semibold leading-9 tracking-tight text-white">
                          {card.value}
                        </p>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-[#777e8a]">{card.helper}</p>
                  </div>
                  <div
                    className={
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition group-hover:scale-105 " +
                      toneClasses
                    }
                  >
                    <card.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
              </CardContent>
              <div className="h-px bg-gradient-to-r from-transparent via-[#ef3943]/45 to-transparent" />
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="gap-0 overflow-hidden rounded-xl border-[#2a2d34] bg-[#0d1015] py-0 shadow-[0_18px_42px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between gap-4 border-b border-[#272a31] p-5">
            <div>
              <div className="flex items-center gap-2">
                <Wallet className="h-4.5 w-4.5 text-[#ef555d]" />
                <h2 className="text-base font-semibold text-white">
                  Posição financeira
                </h2>
              </div>
              <p className="mt-1 text-sm text-[#858b96]">
                Valores consolidados da operação
              </p>
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-[#3a3034] bg-[#171519] px-2.5 py-1 text-[#a7acb6]"
            >
              Consolidado
            </Badge>
          </div>

          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 border-b border-[#272a31] pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm text-[#858b96]">Saldo em circulação</p>
                {statsLoading ? (
                  <Skeleton className="mt-2 h-10 w-48 rounded-md bg-white/[0.06]" />
                ) : (
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
                    {currencyFormatter.format(totalBalance)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-[#777e8a]">
                <ShieldCheck className="h-4 w-4 text-[#ef555d]" />
                Dados da base principal
              </div>
            </div>

            <div className="space-y-5 py-6">
              {financialRows.map(item => {
                const width =
                  item.value > 0
                    ? Math.max((item.value / largestFinancialValue) * 100, 3)
                    : 0;

                return (
                  <div key={item.label}>
                    <div className="mb-2.5 flex items-center justify-between gap-4 text-sm">
                      <span className="text-[#a7acb6]">{item.label}</span>
                      <span className="font-medium tabular-nums text-white">
                        {currencyFormatter.format(item.value)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#1b1f27]">
                      <div
                        className={
                          "h-full rounded-full transition-[width] duration-500 " +
                          item.color
                        }
                        style={{ width: width + "%" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 border-t border-[#272a31] pt-5 sm:grid-cols-2">
              <div className="rounded-lg border border-[#292c33] bg-[#101319] p-4">
                <div className="flex items-center gap-2 text-sm text-[#8f959f]">
                  <Coins className="h-4 w-4 text-[#ef555d]" />
                  Pontos em circulação
                </div>
                <p className="mt-2 text-xl font-semibold tabular-nums text-white">
                  {numberFormatter.format(totalPoints)}
                </p>
              </div>
              <div className="rounded-lg border border-[#292c33] bg-[#101319] p-4">
                <div className="flex items-center gap-2 text-sm text-[#8f959f]">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Decisões registradas
                </div>
                <p className="mt-2 text-xl font-semibold tabular-nums text-white">
                  {numberFormatter.format(decisionCount)}
                </p>
                <p className="mt-1 text-xs text-[#6f7580]">
                  {numberFormatter.format(rejectedWithdrawals)} rejeições
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="gap-0 overflow-hidden rounded-xl border-[#2a2d34] bg-[#0d1015] py-0 shadow-[0_18px_42px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between gap-4 border-b border-[#272a31] p-5">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4.5 w-4.5 text-[#ef555d]" />
                  <h2 className="text-base font-semibold text-white">
                    Atividade da base
                  </h2>
                </div>
                <p className="mt-1 text-sm text-[#858b96]">
                  Participação registrada hoje
                </p>
              </div>
              <Badge
                variant="outline"
                className="rounded-full border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300"
              >
                <Wifi className="h-3.5 w-3.5" />
                {numberFormatter.format(onlineUsers)} online
              </Badge>
            </div>

            <CardContent className="p-5">
              <div className="flex flex-col items-center gap-6 sm:flex-row xl:flex-col 2xl:flex-row">
                <div
                  className="flex h-40 w-40 shrink-0 items-center justify-center rounded-full p-[14px] shadow-[0_0_34px_rgba(239,57,67,0.1)]"
                  style={{
                    background:
                      totalUsers > 0
                        ? "conic-gradient(#ef3943 0 " +
                          activePercentage +
                          "%, #2c313b " +
                          activePercentage +
                          "% 100%)"
                        : "#2c313b",
                  }}
                  role="img"
                  aria-label={
                    activePercentage.toFixed(1) +
                    "% dos usuários acessaram hoje"
                  }
                >
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-[#272a31] bg-[#0d1015] text-center">
                    <strong className="text-2xl font-semibold tabular-nums text-white">
                      {activePercentage.toFixed(1)}%
                    </strong>
                    <span className="mt-1 text-xs text-[#858b96]">
                      ativos hoje
                    </span>
                  </div>
                </div>

                <div className="w-full space-y-3">
                  <div className="flex items-center justify-between gap-4 border-b border-[#272a31] pb-3">
                    <div>
                      <p className="text-sm text-[#a7acb6]">Acessaram hoje</p>
                      <p className="mt-0.5 text-xs text-[#6f7580]">
                        Participação diária
                      </p>
                    </div>
                    <strong className="tabular-nums text-white">
                      {numberFormatter.format(activeUsersToday)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-[#272a31] pb-3">
                    <div>
                      <p className="text-sm text-[#a7acb6]">Online agora</p>
                      <p className="mt-0.5 text-xs text-[#6f7580]">
                        {onlinePercentage.toFixed(1)}% da base
                      </p>
                    </div>
                    <strong className="tabular-nums text-emerald-300">
                      {numberFormatter.format(onlineUsers)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-[#858b96]">
                      Sem acesso hoje
                    </span>
                    <strong className="tabular-nums text-white">
                      {numberFormatter.format(otherUsers)}
                    </strong>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden rounded-xl border-[#2a2d34] bg-[#0d1015] py-0 shadow-[0_18px_42px_rgba(0,0,0,0.3)]">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border " +
                      queueState.className
                    }
                  >
                    <QueueIcon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {queueState.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#7f8691]">
                      {queueState.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLocation("/withdrawals")}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#343740] bg-[#11141a] text-[#9ca2ad] transition hover:border-[#663038] hover:bg-[#211317] hover:text-white"
                  aria-label="Abrir gestão de saques"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="gap-0 overflow-hidden rounded-xl border-[#2a2d34] bg-[#0d1015] py-0 shadow-[0_18px_42px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#272a31] p-5">
          <div>
            <div className="flex items-center gap-2">
              <UserRound className="h-4.5 w-4.5 text-[#ef555d]" />
              <h2 className="text-base font-semibold text-white">
                Usuários recentes
              </h2>
            </div>
            <p className="mt-1 text-sm text-[#858b96]">
              Últimas contas cadastradas na plataforma
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLocation("/users")}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[#343740] bg-[#11141a] px-3 text-sm font-medium text-[#b5bac3] transition hover:border-[#663038] hover:bg-[#211317] hover:text-white"
          >
            <span className="hidden sm:inline">Diretório completo</span>
            <ArrowRight className="h-4 w-4 text-[#ef555d]" />
          </button>
        </div>

        {usersLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-[#858b96]">
            <Loader2 className="h-6 w-6 animate-spin text-[#ef3943]" />
            Carregando usuários...
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#40262b] bg-[#211317] text-[#ef555d]">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-medium text-white">
              Nenhum usuário encontrado
            </h3>
            <p className="mt-1 text-sm text-[#858b96]">
              Os novos cadastros aparecerão aqui.
            </p>
          </div>
        ) : isMobile ? (
          <div className="divide-y divide-[#272a31]">
            {users.slice(0, 8).map((user: any) => {
              const displayName = user.name || user.username || "Sem nome";
              const date =
                user.created_at || user.updated_at || user.last_login_at;

              return (
                <button
                  type="button"
                  key={user.id}
                  onClick={() => setLocation("/users/" + user.id)}
                  className="block w-full space-y-4 p-4 text-left transition hover:bg-white/[0.025]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {user.photo_url || user.profile_picture ? (
                        <img
                          src={user.photo_url || user.profile_picture}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                        />
                      ) : (
                        <div
                          className={
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white " +
                            getAvatarColor(user.id)
                          }
                        >
                          {getInitials(displayName)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {displayName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[#777e8a]">
                          {user.email || "E-mail não informado"}
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[#ef555d]" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-[#292c33] bg-[#101319] p-3">
                      <p className="text-xs text-[#777e8a]">Saldo</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-white">
                        {currencyFormatter.format(toNumber(user.balance))}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#292c33] bg-[#101319] p-3">
                      <p className="text-xs text-[#777e8a]">Pontos</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-white">
                        {numberFormatter.format(toNumber(user.points))}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-xs text-[#777e8a]">
                      <CalendarDays className="h-3.5 w-3.5 text-[#ef555d]" />
                      {formatDate(date)}
                    </span>
                    {renderUserStatus(user)}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <Table className="min-w-[980px]">
            <TableHeader className="bg-[#0a0d12] [&_tr]:border-[#272a31]">
              <TableRow className="border-[#272a31] hover:bg-transparent">
                <TableHead className="h-11 px-5 text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                  Usuário
                </TableHead>
                <TableHead className="h-11 px-4 text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                  Contato
                </TableHead>
                <TableHead className="h-11 px-4 text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                  Financeiro
                </TableHead>
                <TableHead className="h-11 px-4 text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                  Cadastro
                </TableHead>
                <TableHead className="h-11 px-4 text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                  Status
                </TableHead>
                <TableHead className="h-11 px-5 text-right text-xs font-medium uppercase tracking-[0.12em] text-[#707680]">
                  Acesso
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.slice(0, 8).map((user: any) => {
                const displayName = user.name || user.username || "Sem nome";
                const date =
                  user.created_at || user.updated_at || user.last_login_at;

                return (
                  <TableRow
                    key={user.id}
                    className="border-[#272a31] hover:bg-white/[0.025]"
                  >
                    <TableCell className="px-5 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        {user.photo_url || user.profile_picture ? (
                          <img
                            src={user.photo_url || user.profile_picture}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                          />
                        ) : (
                          <div
                            className={
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white " +
                              getAvatarColor(user.id)
                            }
                          >
                            {getInitials(displayName)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="max-w-[220px] truncate text-sm font-medium text-white">
                            {displayName}
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-[#777e8a]">
                            ID #{user.id}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[260px] px-4 py-3.5 text-sm text-[#9ba1ac]">
                      <span className="block truncate">
                        {user.email || "E-mail não informado"}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3.5">
                      <p className="text-sm font-medium tabular-nums text-[#d9dce2]">
                        {currencyFormatter.format(toNumber(user.balance))}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-[#777e8a]">
                        {numberFormatter.format(toNumber(user.points))} pontos
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-3.5 text-sm text-[#8f959f]">
                      {formatDate(date)}
                    </TableCell>
                    <TableCell className="px-4 py-3.5">
                      {renderUserStatus(user)}
                    </TableCell>
                    <TableCell className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setLocation("/users/" + user.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#30333b] bg-[#11141a] text-[#9ca2ad] transition hover:border-[#663038] hover:bg-[#211317] hover:text-white"
                        aria-label={"Abrir usuário " + displayName}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <p className="flex items-center justify-center gap-2 pb-1 text-xs text-[#686e79]">
        <ShieldCheck className="h-3.5 w-3.5 text-[#ef555d]" />
        Dados sincronizados com a operação YoungMoney
      </p>
    </div>
  );
}
