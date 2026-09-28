import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Gift,
  Search,
  Clock,
  CheckCircle2,
  Circle,
  Zap,
  Users,
  TrendingUp,
  ChevronRight,
  Loader2,
  RefreshCw,
  BarChart3,
  X,
} from "lucide-react";

const ptsFmt = new Intl.NumberFormat("pt-BR");
const dtFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function todayBR() {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

type UserRow = {
  user_id: number;
  user_name: string;
  user_email: string;
  total_slots: number;
  claimed: number;
  pending: number;
  doubled: number;
  pts_base: number;
  pts_doubled: number;
  first_slot: string;
  last_slot: string;
  doubles_used: number;
};

type SlotRow = {
  id: number;
  user_id: number;
  user_name: string;
  slot_time: string;
  base_points: number;
  claimed: boolean;
  doubled: boolean;
  claimed_at: string | null;
  doubles_used: number;
};

const avatarColors = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-orange-500",
  "bg-pink-600",
  "bg-teal-600",
  "bg-indigo-600",
  "bg-rose-500",
  "bg-cyan-600",
  "bg-amber-600",
];

function getAvatarColor(id: number) {
  return avatarColors[id % avatarColors.length];
}

function getInitials(name: string) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export default function LuckyPopup() {
  const [date, setDate] = useState(todayBR());
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [cleanMsg, setCleanMsg] = useState<string | null>(null);

  // ── Painel de teste ──────────────────────────────────────────────────
  const [testEmail, setTestEmail] = useState("");
  const [testReset, setTestReset] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const testEmailRef = useRef<HTMLInputElement>(null);

  const {
    data: stats,
    isLoading: loadingStats,
    refetch: refetchStats,
  } = trpc.luckyPopup.stats.useQuery({ date });

  const {
    data: users,
    isLoading: loadingUsers,
    refetch: refetchUsers,
  } = trpc.luckyPopup.userList.useQuery({ date });

  const { data: slots, isLoading: loadingSlots } =
    trpc.luckyPopup.userSlots.useQuery(
      { userId: selectedUser?.user_id ?? 0, date },
      { enabled: !!selectedUser }
    );

  const filteredUsers = useMemo(() => {
    if (!users) return [] as UserRow[];
    const q = search.trim().toLowerCase();
    if (!q) return users as UserRow[];
    return (users as UserRow[]).filter(
      (u) =>
        u.user_email.toLowerCase().includes(q) ||
        u.user_name.toLowerCase().includes(q) ||
        String(u.user_id).includes(q)
    );
  }, [users, search]);

  const claimRate =
    stats && stats.total_slots > 0
      ? Math.round((stats.total_claimed / stats.total_slots) * 100)
      : 0;

  const totalPts = (stats?.pts_base ?? 0) + (stats?.pts_doubled ?? 0);

  const cleanMutation = trpc.luckyPopup.cleanExcess.useMutation({
    onSuccess: (data) => {
      setCleanMsg(`${data.deleted} slot(s) excedente(s) removido(s).`);
      refetchStats();
      refetchUsers();
      setTimeout(() => setCleanMsg(null), 5000);
    },
  });

  function handleRefresh() {
    refetchStats();
    refetchUsers();
  }

  function handleClean() {
    setCleanMsg(null);
    cleanMutation.mutate({ date });
  }

  const testMutation = trpc.luckyPopup.testUser.useMutation({
    onSuccess: (data) => setTestResult(data),
  });

  const [forceMsg, setForceMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const forceMutation = trpc.luckyPopup.forcePopup.useMutation({
    onSuccess: (data) => {
      setForceMsg({ ok: data.success, text: data.message });
      setTimeout(() => setForceMsg(null), 8000);
    },
    onError: (e) => setForceMsg({ ok: false, text: e.message }),
  });

  function handleTest() {
    const email = testEmail.trim();
    if (!email) { testEmailRef.current?.focus(); return; }
    setTestResult(null);
    testMutation.mutate({ email, date, resetUser: testReset });
  }

  function handleForce() {
    const email = testEmail.trim();
    if (!email) { testEmailRef.current?.focus(); return; }
    setForceMsg(null);
    forceMutation.mutate({ email, date });
  }

  return (
    <div className="space-y-0">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-normal text-[#f3f6fb]">Lucky Popup</h1>
          <p className="text-sm text-[#99a5b8] mt-1">
            Horários sorteados, resgates e dobramentos por usuário
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 px-3 rounded-xl border border-white/10 bg-[#11161f] text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#1f6feb]/40"
          />
          <button
            onClick={handleClean}
            disabled={cleanMutation.isPending}
            className="flex items-center gap-2 text-[#f87171] hover:text-[#fca5a5] text-sm font-medium transition-colors disabled:opacity-50"
            title="Remove slots excedentes (mantém apenas 20 por usuário)"
          >
            {cleanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Limpar excedentes
          </button>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 text-[#8ab4ff] hover:text-[#8ab4ff] text-sm font-medium transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </div>

      {cleanMsg && (
        <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-400">
          {cleanMsg}
        </div>
      )}

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Usuários com slots"
          value={loadingStats ? null : stats?.unique_users ?? 0}
          sub="neste dia"
          icon={<Users className="h-5 w-5" />}
          glow="bg-blue-500/16"
          frame="border-blue-400/15 bg-blue-500/8"
          valueColor="text-[#f4f7fb]"
          hoverBorder="hover:border-blue-400/25"
        />
        <StatCard
          label="Slots resgatados"
          value={
            loadingStats
              ? null
              : `${stats?.total_claimed ?? 0} / ${stats?.total_slots ?? 0}`
          }
          sub={`${claimRate}% de aproveitamento`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          glow="bg-emerald-500/14"
          frame="border-emerald-400/15 bg-emerald-500/8"
          valueColor="text-emerald-300"
          hoverBorder="hover:border-emerald-400/25"
        />
        <StatCard
          label="Dobramentos"
          value={loadingStats ? null : stats?.total_doubled ?? 0}
          sub={`${stats?.total_doubles_used ?? 0} usos do botão dobrar`}
          icon={<Zap className="h-5 w-5" />}
          glow="bg-amber-500/14"
          frame="border-amber-400/15 bg-amber-500/8"
          valueColor="text-amber-300"
          hoverBorder="hover:border-amber-400/25"
        />
        <StatCard
          label="Pontos distribuídos"
          value={loadingStats ? null : ptsFmt.format(totalPts)}
          sub={`base ${ptsFmt.format(stats?.pts_base ?? 0)} + dobro ${ptsFmt.format(stats?.pts_doubled ?? 0)}`}
          icon={<TrendingUp className="h-5 w-5" />}
          glow="bg-cyan-500/14"
          frame="border-cyan-400/15 bg-cyan-500/8"
          valueColor="text-cyan-300"
          hoverBorder="hover:border-cyan-400/25"
        />
      </section>

      {/* ── Painel de Teste de API ─────────────────────────────────────────── */}
      <div className="mb-6 rounded-[20px] border border-[#1f6feb]/20 bg-[#0d1117] shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-white/6">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#1f6feb]/25 bg-[#1f6feb]/12">
            <Zap className="h-3.5 w-3.5 text-[#6ea8ff]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Testar API para usuário</p>
            <p className="text-xs text-[#7f8a9d]">Simula exatamente o GET que o app faz</p>
          </div>
        </div>
        <div className="px-5 py-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs text-[#7f8a9d] mb-1.5">E-mail do usuário</label>
            <input
              ref={testEmailRef}
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTest()}
              placeholder="usuario@email.com"
              className="w-full h-9 px-3 rounded-xl border border-white/10 bg-[#11161f] text-sm text-white placeholder-[#4a5568] focus:outline-none focus:ring-2 focus:ring-[#1f6feb]/40"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none pb-0.5">
            <div onClick={() => setTestReset(v => !v)} className={`relative h-5 w-9 rounded-full transition-colors cursor-pointer ${testReset ? "bg-[#ef4444]" : "bg-white/10"}`}>
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${testReset ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-xs text-[#99a5b8]">Resetar slots antes</span>
          </label>
          <button onClick={handleTest} disabled={testMutation.isPending} className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[#1f6feb] hover:bg-[#388bfd] disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {testMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Testando...</> : <><Zap className="h-4 w-4" /> Testar agora</>}
          </button>

          <button
            onClick={handleForce}
            disabled={forceMutation.isPending}
            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            title="Injeta um slot agora mesmo — popup aparecerá no app em até 1 min"
          >
            {forceMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Forçando...</>
              : <><Gift className="h-4 w-4" /> Forçar Popup Agora</>
            }
          </button>

          {testResult && (<button onClick={() => setTestResult(null)} className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-white/10 text-[#7f8a9d] hover:text-white text-sm transition-colors"><X className="h-3.5 w-3.5" /> Limpar</button>)}
        </div>

        {forceMsg && (
          <div className={`mx-5 mb-3 rounded-xl border px-4 py-2.5 text-sm flex items-center gap-2 ${
            forceMsg.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500/30 bg-red-500/8 text-red-400'
          }`}>
            <span className="text-base">{forceMsg.ok ? '✅' : '❌'}</span>
            {forceMsg.text}
          </div>
        )}

        {testMutation.isError && (<div className="mx-5 mb-4 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3 text-sm text-red-400">Erro: {testMutation.error?.message ?? "Falha na requisição"}</div>)}
        {testResult && (
          <div className="px-5 pb-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${testResult.status === "POPUP_DISPONIVEL_AGORA" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" : testResult.user === null ? "bg-red-500/15 text-red-400 border border-red-500/25" : "bg-amber-500/15 text-amber-400 border border-amber-500/25"}`}>
                {testResult.status === "POPUP_DISPONIVEL_AGORA" ? "✔ POPUP DISPONÍVEL AGORA" : testResult.user === null ? "✘ USUÁRIO NÃO ENCONTRADO" : "○ SEM POPUP AGORA"}
              </span>
              {testResult.user && (<span className="text-xs text-[#7f8a9d]">{testResult.user.name} · hora: {testResult.nowTime}{testResult.slotsGenerated > 0 && ` · ${testResult.slotsGenerated} slots gerados`}{testResult.resetDone > 0 && ` · ${testResult.resetDone} slots resetados`}</span>)}
            </div>
            {testResult.user && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-[#7f8a9d] uppercase tracking-wider mb-2">Resposta que o app recebe</p>
                  <pre className="rounded-xl border border-white/8 bg-[#11161f] p-3 text-xs text-[#a8c4ff] overflow-x-auto leading-relaxed">{JSON.stringify(testResult.appResponse, null, 2)}</pre>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#7f8a9d] uppercase tracking-wider mb-2">Slots hoje ({testResult.allSlots?.length ?? 0})</p>
                  <div className="rounded-xl border border-white/8 bg-[#11161f] overflow-hidden">
                    <div className="max-h-48 overflow-y-auto">
                      {(testResult.allSlots ?? []).map((s: any, i: number) => {
                        const claimed = Number(s.claimed) === 1;
                        return (<div key={i} className={`flex items-center justify-between px-3 py-1.5 border-b border-white/4 last:border-0 ${claimed ? "opacity-40" : ""}`}><span className="text-xs font-mono text-white">{String(s.slot_time).substring(0,5)}</span><span className="text-xs text-[#6ea8ff]">{ptsFmt.format(Number(s.base_points))} pts</span><span className={`text-xs ${claimed ? "text-[#4a5568]" : "text-emerald-400"}`}>{claimed ? "resgatado" : "pendente"}</span></div>);
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Main table card ─────────────────────────────────────────────── */}
      <div className="bg-[#11161f] rounded-[24px] border border-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
        {/* Card header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between gap-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1f6feb]/20 bg-[#1f6feb]/10">
              <Gift className="h-4 w-4 text-[#6ea8ff]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Slots por usuário</p>
              <p className="text-xs text-[#7f8a9d]">
                Clique em um usuário para ver os horários individuais
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7f8a9d] pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por e-mail ou nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-white/10 bg-[#0c1017] text-sm text-white placeholder:text-[#4a5568] focus:outline-none focus:ring-2 focus:ring-[#1f6feb]/40 focus:border-[#1f6feb]/40 transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4a5568] hover:text-[#7f8a9d] transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Table header */}
        {!loadingUsers && filteredUsers.length > 0 && (
          <div className="grid grid-cols-[2.5fr_2fr_60px_70px_70px_90px_110px_24px] px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#7f8a9d] border-b border-white/6">
            <span>Usuário</span>
            <span>E-mail</span>
            <span className="text-center">Slots</span>
            <span className="text-center">Resgatados</span>
            <span className="text-center">Pendentes</span>
            <span className="text-right">Pts ganhos</span>
            <span className="text-center">Janela</span>
            <span />
          </div>
        )}

        {/* Table body */}
        {loadingUsers ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#7f8a9d]" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <BarChart3 className="h-10 w-10 text-[#2a3345]" />
            <p className="text-sm font-medium text-[#7f8a9d]">
              {search
                ? `Nenhum resultado para "${search}"`
                : "Nenhum slot gerado para esta data."}
            </p>
            {!search && (
              <p className="text-xs text-[#3a4455]">
                Os slots são criados quando os usuários abrem o app.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filteredUsers.map((u) => (
              <div
                key={u.user_id}
                onClick={() => setSelectedUser(u)}
                className="grid grid-cols-[2.5fr_2fr_60px_70px_70px_90px_110px_24px] px-6 py-3.5 items-center cursor-pointer hover:bg-white/[0.025] transition-colors group"
              >
                {/* Avatar + nome */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full ${getAvatarColor(u.user_id)} flex items-center justify-center text-white text-xs font-semibold shrink-0`}
                  >
                    {getInitials(u.user_name)}
                  </div>
                  <span className="text-sm font-medium text-[#f3f6fb] truncate">
                    {u.user_name || "—"}
                  </span>
                </div>

                {/* E-mail */}
                <span className="text-sm text-[#7f8a9d] truncate pr-4">
                  {u.user_email}
                </span>

                {/* Total slots */}
                <span className="text-sm font-semibold text-white text-center">
                  {u.total_slots}
                </span>

                {/* Resgatados */}
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                    {u.claimed}
                  </span>
                </div>

                {/* Pendentes */}
                <div className="flex justify-center">
                  {u.pending > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                      {u.pending}
                    </span>
                  ) : (
                    <span className="text-xs text-[#2a3345]">—</span>
                  )}
                </div>

                {/* Pts */}
                <span className="text-sm font-semibold text-emerald-400 text-right">
                  {ptsFmt.format(u.pts_base + u.pts_doubled)}
                </span>

                {/* Janela */}
                <span className="text-xs text-[#7f8a9d] text-center font-mono">
                  {u.first_slot} – {u.last_slot}
                </span>

                {/* Chevron */}
                <ChevronRight className="h-4 w-4 text-[#2a3345] group-hover:text-[#7f8a9d] transition-colors" />
              </div>
            ))}
          </div>
        )}

        {/* Footer count */}
        {!loadingUsers && filteredUsers.length > 0 && (
          <div className="px-6 py-3 border-t border-white/6 text-xs text-[#4a5568]">
            {filteredUsers.length} usuário{filteredUsers.length !== 1 ? "s" : ""}
            {search && ` encontrado${filteredUsers.length !== 1 ? "s" : ""} para "${search}"`}
          </div>
        )}
      </div>

      {/* ── Slots dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={!!selectedUser}
        onOpenChange={(open) => {
          if (!open) setSelectedUser(null);
        }}
      >
        <DialogContent className="max-w-2xl border-white/8 bg-[#0d1117] text-white p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-white/8">
            <DialogTitle className="flex items-center gap-2.5 text-white text-base font-semibold">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#1f6feb]/20 bg-[#1f6feb]/10">
                <Clock className="h-3.5 w-3.5 text-[#6ea8ff]" />
              </div>
              <div>
                <span>{selectedUser?.user_name || selectedUser?.user_email}</span>
                <span className="ml-2 text-xs font-normal text-[#7f8a9d]">
                  {date}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {loadingSlots ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#7f8a9d]" />
            </div>
          ) : !slots || slots.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#7f8a9d]">
              Nenhum slot encontrado.
            </p>
          ) : (
            <>
              {/* Slot table header */}
              <div className="grid grid-cols-[80px_1fr_120px_1fr] px-6 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#7f8a9d] border-b border-white/6">
                <span>Horário</span>
                <span className="text-right">Pts base</span>
                <span className="text-center">Status</span>
                <span>Resgatado em</span>
              </div>

              <div className="max-h-[52vh] overflow-y-auto divide-y divide-white/[0.04]">
                {(slots as SlotRow[]).map((s) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-[80px_1fr_120px_1fr] px-6 py-3 items-center hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Time */}
                    <span className="font-mono text-sm font-bold text-white">
                      {s.slot_time}
                    </span>

                    {/* Points */}
                    <span className="text-sm font-semibold text-right">
                      {s.doubled ? (
                        <span className="text-violet-400">
                          {ptsFmt.format(s.base_points * 2)}{" "}
                          <span className="text-xs font-normal text-violet-500">
                            2×
                          </span>
                        </span>
                      ) : (
                        <span className="text-emerald-400">
                          {ptsFmt.format(s.base_points)}
                        </span>
                      )}
                    </span>

                    {/* Status badge */}
                    <div className="flex justify-center">
                      {s.claimed ? (
                        s.doubled ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-400">
                            <Zap className="h-3 w-3" />
                            Dobrado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Resgatado
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-[#7f8a9d]">
                          <Circle className="h-3 w-3" />
                          Pendente
                        </span>
                      )}
                    </div>

                    {/* Claimed at */}
                    <span className="text-xs text-[#7f8a9d]">
                      {s.claimed_at
                        ? dtFmt.format(new Date(s.claimed_at))
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Dialog footer */}
              <div className="px-6 py-3 border-t border-white/6 flex items-center justify-between text-xs text-[#4a5568]">
                <span>
                  {slots.length} slots no total
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-emerald-500">
                    {(slots as SlotRow[]).filter((s) => s.claimed).length} resgatados
                  </span>
                  <span className="text-violet-500">
                    {(slots as SlotRow[]).filter((s) => s.doubled).length} dobrados
                  </span>
                  <span className="text-[#4a5568]">
                    {(slots as SlotRow[]).filter((s) => !s.claimed).length} pendentes
                  </span>
                </span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon,
  glow,
  frame,
  valueColor,
  hoverBorder,
}: {
  label: string;
  value: string | number | null;
  sub: string;
  icon: React.ReactNode;
  glow: string;
  frame: string;
  valueColor: string;
  hoverBorder: string;
}) {
  return (
    <article
      className={`group relative isolate overflow-hidden rounded-[22px] border border-white/8 bg-[#101722] p-5 shadow-[0_16px_36px_rgba(0,0,0,0.28)] transition duration-300 ${hoverBorder} hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(0,0,0,0.34)]`}
    >
      <div
        className={`pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-3xl transition-opacity duration-300 ${glow} opacity-60 group-hover:opacity-100`}
      />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f9db1]">
            {label}
          </p>
          <div
            className={`mt-2 text-[28px] font-semibold leading-none tracking-tight ${valueColor}`}
          >
            {value === null ? (
              <span className="inline-block h-7 w-20 animate-pulse rounded-lg bg-white/[0.06]" />
            ) : (
              value
            )}
          </div>
          <p className="mt-2 truncate text-xs text-[#7f8da2]">{sub}</p>
        </div>
        <div
          className={`flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[18px] border ${frame} shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}
        >
          <div className="opacity-80 group-hover:opacity-100 transition-opacity">
            {icon}
          </div>
        </div>
      </div>
    </article>
  );
}
