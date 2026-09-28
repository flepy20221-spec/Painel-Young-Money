import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  AlertTriangle,
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coins,
  Eye,
  LayoutDashboard,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users as UsersIcon,
  UserX,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type TabFilter = "all" | "active" | "banned";

const PAGE_SIZE = 20;

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

function isUserBanned(user: any) {
  return (
    user.permanent_email_banned === 1 ||
    user.permanent_email_banned === true ||
    user.permanent_email_banned === "1" ||
    user.is_banned === 1 ||
    user.is_banned === true ||
    user.is_banned === "1"
  );
}

function formatDate(dateValue: unknown) {
  if (!dateValue) return "Sem registro";

  const date = new Date(String(dateValue));
  if (Number.isNaN(date.getTime())) return "Sem registro";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function Users() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userToBan, setUserToBan] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [newPoints, setNewPoints] = useState("");
  const [newBalance, setNewBalance] = useState("");

  const { data, isLoading, isFetching, refetch } = trpc.appUsers.list.useQuery({
    limit: 10000,
    offset: 0,
  });

  const updatePointsMutation = trpc.appUsers.updatePoints.useMutation({
    onSuccess: () => {
      toast.success("Pontos atualizados com sucesso");
      setShowEditDialog(false);
      refetch();
    },
    onError: (error: any) => toast.error(`Erro: ${error.message}`),
  });

  const updateBalanceMutation = trpc.appUsers.updateBalance.useMutation({
    onSuccess: () => {
      toast.success("Saldo atualizado com sucesso");
      setShowEditDialog(false);
      refetch();
    },
    onError: (error: any) => toast.error(`Erro: ${error.message}`),
  });

  const deleteAllMutation = trpc.appUsers.deleteAll.useMutation({
    onSuccess: result => {
      toast.success(`${result.count} usuários excluídos com sucesso`);
      setShowDeleteAllDialog(false);
      setDeleteConfirmText("");
      setPage(1);
      refetch();
    },
    onError: (error: any) => toast.error(`Erro: ${error.message}`),
  });

  const banMutation = trpc.appUsers.ban.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Banimento permanente concluído: ${result.matchedAccounts} conta(s), ${result.matchedDevices} dispositivo(s). Pontos preservados e removidos dos rankings.`
      );
      setUserToBan(null);
      refetch();
    },
    onError: (error: any) => toast.error(`Erro: ${error.message}`),
  });

  const allUsers = data?.users || [];
  const bannedUsers = allUsers.filter(isUserBanned);
  const activeUsers = allUsers.filter((user: any) => !isUserBanned(user));
  const currentMonth = new Date();
  const newUsersThisMonth = allUsers.filter((user: any) => {
    if (!user.created_at) return false;

    const createdAt = new Date(user.created_at);
    return (
      !Number.isNaN(createdAt.getTime()) &&
      createdAt.getFullYear() === currentMonth.getFullYear() &&
      createdAt.getMonth() === currentMonth.getMonth()
    );
  });

  const activeShare = allUsers.length
    ? Math.round((activeUsers.length / allUsers.length) * 100)
    : 0;
  const bannedShare = allUsers.length
    ? Math.round((bannedUsers.length / allUsers.length) * 100)
    : 0;

  const usersByTab =
    activeTab === "active"
      ? activeUsers
      : activeTab === "banned"
        ? bannedUsers
        : allUsers;

  const normalizedSearch = searchTerm.toLowerCase().trim();
  const filteredUsers = usersByTab.filter((user: any) => {
    if (!normalizedSearch) return true;

    return (
      (user.email || "").toLowerCase().includes(normalizedSearch) ||
      (user.username || "").toLowerCase().includes(normalizedSearch) ||
      (user.name || "").toLowerCase().includes(normalizedSearch) ||
      String(user.id).includes(normalizedSearch)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const firstResultIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleUsers = filteredUsers.slice(
    firstResultIndex,
    firstResultIndex + PAGE_SIZE
  );
  const firstVisibleResult =
    filteredUsers.length > 0 ? firstResultIndex + 1 : 0;
  const lastVisibleResult = Math.min(
    firstResultIndex + PAGE_SIZE,
    filteredUsers.length
  );

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

  const handleTabChange = (tab: TabFilter) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const openEditDialog = (user: any) => {
    setSelectedUser(user);
    setNewPoints(String(user.points || 0));
    setNewBalance(String(user.balance || 0));
    setShowEditDialog(true);
  };

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: allUsers.length },
    { key: "active", label: "Ativos", count: activeUsers.length },
    { key: "banned", label: "Banidos", count: bannedUsers.length },
  ];

  const statCards = [
    {
      label: "Usuários totais",
      value: allUsers.length,
      description: "Base completa cadastrada",
      icon: UsersIcon,
    },
    {
      label: "Usuários ativos",
      value: activeUsers.length,
      description: `${activeShare}% da base liberada`,
      icon: UserCheck,
    },
    {
      label: "Novos este mês",
      value: newUsersThisMonth.length,
      description: `Cadastros em ${currentMonth.toLocaleDateString("pt-BR", {
        month: "long",
      })}`,
      icon: UserPlus,
    },
    {
      label: "Usuários banidos",
      value: bannedUsers.length,
      description: `${bannedShare}% da base bloqueada`,
      icon: UserX,
    },
  ];

  const renderStatus = (user: any) =>
    isUserBanned(user) ? (
      <Badge
        variant="outline"
        className="rounded-full border-[#713139] bg-[#2a1519] px-2.5 py-1 text-[#ff777e]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#ef3943]" />
        Banido
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="rounded-full border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Ativo
      </Badge>
    );

  const renderActions = (user: any) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#2f323a] bg-[#11141a] text-[#9ca2ad] transition hover:border-[#5d2e35] hover:bg-[#1d1215] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef3943]/35"
          aria-label={`Abrir ações de ${user.name || user.username || "usuário"}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 rounded-lg border-[#2f323a] bg-[#101319] p-1.5 text-[#d9dce2] shadow-[0_18px_45px_rgba(0,0,0,0.45)]"
      >
        <DropdownMenuItem
          onSelect={() => setLocation(`/users/${user.id}`)}
          className="rounded-md px-3 py-2.5 focus:bg-[#1b1f27] focus:text-white"
        >
          <Eye className="text-[#ef555d]" />
          Ver detalhes
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => openEditDialog(user)}
          className="rounded-md px-3 py-2.5 focus:bg-[#1b1f27] focus:text-white"
        >
          <Pencil className="text-[#ef555d]" />
          Editar pontos e saldo
        </DropdownMenuItem>
        {!isUserBanned(user) && (
          <>
            <DropdownMenuSeparator className="bg-[#292c33]" />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setUserToBan(user)}
              className="rounded-md px-3 py-2.5 text-[#ff6b73] focus:bg-[#2a1519] focus:text-[#ff7d84]"
            >
              <Ban />
              Banir usuário
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4 text-[#f4f5f7] sm:space-y-5">
      <section className="flex flex-col gap-4 rounded-xl border border-[#282b32] bg-[#0d1015]/95 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.3)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#8e949f]">
            <LayoutDashboard className="h-3.5 w-3.5 text-[#ef3943]" />
            <span>Painel</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-[#ef555d]">Usuários</span>
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Gestão de usuários
          </h1>
          <p className="mt-1 text-sm text-[#9197a3]">
            Consulte contas, saldos, pontos e permissões da plataforma.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#3a2529] bg-[#1a1114] px-4 text-sm font-medium text-[#ff747b] transition hover:border-[#713139] hover:bg-[#271519] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
          Atualizar usuários
        </button>
      </section>

      <section
        aria-label="Resumo dos usuários"
        className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4"
      >
        {statCards.map(card => (
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
                    {isLoading ? (
                      <span className="inline-block h-8 w-20 animate-pulse rounded-md bg-white/[0.06]" />
                    ) : (
                      <p className="text-[1.7rem] font-semibold leading-9 tracking-tight text-white">
                        {numberFormatter.format(card.value)}
                      </p>
                    )}
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-xs text-[#777e8a]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ef3943] shadow-[0_0_10px_rgba(239,57,67,0.75)]" />
                    {card.description}
                  </p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#46242a] bg-[#241216] text-[#f0444e] transition group-hover:border-[#713139] group-hover:bg-[#2c151a]">
                  <card.icon className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
            </CardContent>
            <div className="h-px bg-gradient-to-r from-transparent via-[#ef3943]/45 to-transparent" />
          </Card>
        ))}
      </section>

      <Card className="gap-0 overflow-hidden rounded-xl border-[#282b32] bg-[#0d1015] py-0 shadow-[0_18px_42px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col gap-4 border-b border-[#252830] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Diretório de usuários
            </h2>
            <p className="mt-1 text-sm text-[#858b96]">
              {numberFormatter.format(filteredUsers.length)} registros
              encontrados
            </p>
          </div>

          {bannedUsers.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleteAllDialog(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#5f2d34] bg-[#241317] px-4 text-sm font-medium text-[#ff7279] transition hover:border-[#8b3741] hover:bg-[#30171c]"
            >
              <Trash2 className="h-4 w-4" />
              Excluir todos
            </button>
          )}
        </div>

        <div className="flex flex-col gap-4 border-b border-[#252830] p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-xl">
            <Label htmlFor="user-search" className="sr-only">
              Buscar usuários
            </Label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#707680]" />
            <Input
              id="user-search"
              type="search"
              placeholder="Buscar por nome, e-mail ou ID"
              value={searchTerm}
              onChange={event => handleSearchChange(event.target.value)}
              className="h-11 rounded-lg border-[#30333b] bg-[#090c11] pl-10 pr-10 text-[#f4f5f7] placeholder:text-[#656b76] focus-visible:border-[#ef3943] focus-visible:ring-[#ef3943]/15"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#777e8a] transition hover:bg-[#1b1f27] hover:text-white"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Filtrar usuários por status"
            className="flex w-full gap-1 overflow-x-auto rounded-lg border border-[#2c2f37] bg-[#090c11] p-1 xl:w-auto"
          >
            {tabs.map(tab => (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`inline-flex min-w-fit flex-1 items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition xl:flex-none ${
                  activeTab === tab.key
                    ? "bg-[#2a1519] text-[#ff747b] shadow-[inset_0_0_0_1px_rgba(239,57,67,0.35)]"
                    : "text-[#858b96] hover:bg-[#15181e] hover:text-white"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs ${
                    activeTab === tab.key
                      ? "bg-[#ef3943]/15 text-[#ff8c92]"
                      : "bg-[#20242c] text-[#7d838e]"
                  }`}
                >
                  {numberFormatter.format(tab.count)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-[#858b96]">
            <Loader2 className="h-6 w-6 animate-spin text-[#ef3943]" />
            Carregando usuários...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#40262b] bg-[#211317] text-[#ef555d]">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-medium text-white">
              Nenhum usuário encontrado
            </h3>
            <p className="mt-1 max-w-sm text-sm text-[#858b96]">
              {searchTerm
                ? `Não encontramos resultados para “${searchTerm}”.`
                : "Não há registros disponíveis para este filtro."}
            </p>
          </div>
        ) : isMobile ? (
          <div className="divide-y divide-[#252830]">
            {visibleUsers.map((user: any) => {
              const displayName = user.name || user.username || "Sem nome";

              return (
                <article key={user.id} className="space-y-4 p-4">
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
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${getAvatarColor(user.id)} text-sm font-semibold text-white`}
                        >
                          {getInitials(displayName)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-medium text-white">
                          {displayName}
                        </h3>
                        <p className="mt-0.5 text-xs text-[#777e8a]">
                          ID #{user.id}
                        </p>
                      </div>
                    </div>
                    {renderActions(user)}
                  </div>

                  <div className="space-y-2.5 rounded-lg border border-[#272a31] bg-[#101319] p-3">
                    <div className="flex min-w-0 items-center gap-2 text-sm text-[#9ba1ac]">
                      <Mail className="h-4 w-4 shrink-0 text-[#ef555d]" />
                      <span className="truncate">
                        {user.email || "E-mail não informado"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#9ba1ac]">
                      <CalendarDays className="h-4 w-4 shrink-0 text-[#ef555d]" />
                      <span>{formatDate(user.created_at)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-[#272a31] bg-[#101319] p-3">
                      <p className="text-xs text-[#777e8a]">Pontos</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-white">
                        {numberFormatter.format(toNumber(user.points))}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#272a31] bg-[#101319] p-3">
                      <p className="text-xs text-[#777e8a]">Saldo</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-white">
                        {currencyFormatter.format(toNumber(user.balance))}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#252830] pt-3">
                    <span className="text-xs text-[#777e8a]">
                      Status da conta
                    </span>
                    {renderStatus(user)}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Table className="min-w-[980px]">
            <TableHeader className="bg-[#0a0d12] [&_tr]:border-[#252830]">
              <TableRow className="border-[#252830] hover:bg-transparent">
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
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleUsers.map((user: any) => {
                const displayName = user.name || user.username || "Sem nome";

                return (
                  <TableRow
                    key={user.id}
                    className="border-[#252830] hover:bg-white/[0.025]"
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
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getAvatarColor(user.id)} text-xs font-semibold text-white`}
                          >
                            {getInitials(displayName)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="max-w-[220px] truncate text-sm font-medium text-white">
                            {displayName}
                          </p>
                          <p className="mt-0.5 text-xs text-[#777e8a]">
                            {user.username && user.name
                              ? `@${user.username} · `
                              : ""}
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
                      <div>
                        <p className="text-sm font-medium tabular-nums text-[#d9dce2]">
                          {numberFormatter.format(toNumber(user.points))} pontos
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-[#777e8a]">
                          {currencyFormatter.format(toNumber(user.balance))}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3.5 text-sm text-[#8f959f]">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3.5">
                      {renderStatus(user)}
                    </TableCell>
                    <TableCell className="px-5 py-3.5 text-right">
                      {renderActions(user)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {!isLoading && filteredUsers.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-[#252830] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs text-[#7d838e]" aria-live="polite">
              Mostrando {numberFormatter.format(firstVisibleResult)}–
              {numberFormatter.format(lastVisibleResult)} de{" "}
              {numberFormatter.format(filteredUsers.length)}
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
                  <span className="inline-flex h-9 min-w-24 items-center justify-center px-2 text-xs font-medium text-[#8f959f]">
                    Página {numberFormatter.format(currentPage)} de{" "}
                    {numberFormatter.format(totalPages)}
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

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md rounded-xl border-[#2d3038] bg-[#0d1015] text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg border border-[#5b2b32] bg-[#251317] text-[#ef555d]">
              <Pencil className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl text-white">
              Editar usuário
            </DialogTitle>
            <DialogDescription className="leading-6 text-[#8f959f]">
              {selectedUser?.name || selectedUser?.username || "Usuário"} · ID #
              {selectedUser?.id}
              {selectedUser?.email && (
                <span className="block text-xs text-[#777e8a]">
                  {selectedUser.email}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label
                htmlFor="user-points"
                className="flex items-center gap-2 text-[#d9dce2]"
              >
                <Coins className="h-4 w-4 text-[#ef555d]" />
                Pontos
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="user-points"
                  type="number"
                  value={newPoints}
                  onChange={event => setNewPoints(event.target.value)}
                  placeholder="Quantidade de pontos"
                  className="rounded-lg border-[#30333b] bg-[#090c11] focus-visible:border-[#ef3943] focus-visible:ring-[#ef3943]/15"
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (!selectedUser || newPoints.trim() === "") return;
                    updatePointsMutation.mutate({
                      id: selectedUser.id,
                      points: Number.parseInt(newPoints, 10),
                    });
                  }}
                  disabled={updatePointsMutation.isPending}
                  className="rounded-lg border-[#d9323c] bg-[#d9323c] hover:border-[#ec414b] hover:bg-[#ec414b]"
                >
                  {updatePointsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="user-balance"
                className="flex items-center gap-2 text-[#d9dce2]"
              >
                <Wallet className="h-4 w-4 text-[#ef555d]" />
                Saldo (R$)
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="user-balance"
                  type="number"
                  step="0.01"
                  value={newBalance}
                  onChange={event => setNewBalance(event.target.value)}
                  placeholder="Valor do saldo"
                  className="rounded-lg border-[#30333b] bg-[#090c11] focus-visible:border-[#ef3943] focus-visible:ring-[#ef3943]/15"
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (!selectedUser || newBalance.trim() === "") return;
                    updateBalanceMutation.mutate({
                      id: selectedUser.id,
                      balance: Number.parseFloat(newBalance),
                    });
                  }}
                  disabled={updateBalanceMutation.isPending}
                  className="rounded-lg border-[#d9323c] bg-[#d9323c] hover:border-[#ec414b] hover:bg-[#ec414b]"
                >
                  {updateBalanceMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-[#292c33] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              className="rounded-lg border-[#343740] bg-[#11141a] text-[#d9dce2] hover:bg-[#191d24]"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(userToBan)}
        onOpenChange={open => {
          if (!open && !banMutation.isPending) setUserToBan(null);
        }}
      >
        <AlertDialogContent className="rounded-xl border-[#48282e] bg-[#0d1015] text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-[#713139] bg-[#2a1519] text-[#ff6870] sm:mx-0">
              <Ban className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-xl text-white">
              Banir conta(s)?
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-[#9197a3]">
              A ação localizará todas as contas vinculadas a esse e-mail e bloqueará os dispositivos associados.
              <span className="mt-2 block text-sm text-white">
                {userToBan?.email
                  ? `E-mail usado para localizar as contas: ${userToBan.email}`
                  : "Esta conta não tem e-mail e não pode ser banida por este método."}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg border-[#343740] bg-[#11141a] text-[#d9dce2] hover:bg-[#191d24] hover:text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const email = String(userToBan?.email || "").trim();
                if (!email) {
                  toast.error("Esta conta não tem e-mail cadastrado.");
                  return;
                }
                banMutation.mutate({
                  email,
                  reason: "Banido pelo admin",
                });
              }}
              disabled={banMutation.isPending || !String(userToBan?.email || "").trim()}
              className="rounded-lg border-[#d9323c] bg-[#d9323c] text-white hover:border-[#ec414b] hover:bg-[#ec414b]"
            >
              {banMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban />
              )}
              Confirmar banimento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <DialogContent className="max-w-md rounded-xl border-[#48282e] bg-[#0d1015] text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-[#713139] bg-[#2a1519] text-[#ff6870]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl text-white">
              Excluir todos os usuários
            </DialogTitle>
            <DialogDescription className="leading-6 text-[#9197a3]">
              Esta ação remove permanentemente todas as contas e os dados
              relacionados. Ela não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-[#633039] bg-[#251317] p-4">
              <p className="text-sm leading-6 text-[#ff9ba0]">
                <strong className="font-semibold text-[#ff777e]">
                  Atenção:
                </strong>{" "}
                serão excluídos {numberFormatter.format(toNumber(data?.total))}{" "}
                usuários.
              </p>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="delete-users-confirmation"
                className="text-[#d9dce2]"
              >
                Digite <strong className="text-white">EXCLUIR TODOS</strong>{" "}
                para confirmar
              </Label>
              <Input
                id="delete-users-confirmation"
                value={deleteConfirmText}
                onChange={event => setDeleteConfirmText(event.target.value)}
                placeholder="EXCLUIR TODOS"
                className="rounded-lg border-[#3d2a2e] bg-[#090c11] font-mono focus-visible:border-[#ef3943] focus-visible:ring-[#ef3943]/15"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-[#292c33] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDeleteAllDialog(false);
                setDeleteConfirmText("");
              }}
              className="rounded-lg border-[#343740] bg-[#11141a] text-[#d9dce2] hover:bg-[#191d24]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (deleteConfirmText !== "EXCLUIR TODOS") {
                  toast.error("Digite 'EXCLUIR TODOS' para confirmar");
                  return;
                }
                deleteAllMutation.mutate({ confirmText: deleteConfirmText });
              }}
              disabled={
                deleteAllMutation.isPending ||
                deleteConfirmText !== "EXCLUIR TODOS"
              }
              className="rounded-lg border-[#d9323c] bg-[#d9323c] hover:border-[#ec414b] hover:bg-[#ec414b]"
            >
              {deleteAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Excluir todos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
