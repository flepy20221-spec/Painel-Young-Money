import { useIsMobile } from "@/hooks/useMobile";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Trophy,
  Dices,
  Bell,
  ShieldBan,
  Shield,
  Database,
  Coins,
  Cog,
  Smartphone,
  Download,
  FileArchive,
  ScrollText,
  Unlink,
  Wrench,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Gift,
  Activity,
  CircleCheck,
  ListChecks,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const directoryItems = [
  { icon: Users, label: "Usuários", path: "/users" },
  { icon: Gift, label: "Recompensas", path: "/rewards" },
  { icon: DollarSign, label: "Saques", path: "/withdrawals" },
  { icon: Trophy, label: "Ranking", path: "/ranking" },
  { icon: Dices, label: "Roleta", path: "/roulette" },
  { icon: Gift, label: "Lucky Popup", path: "/lucky-popup" },
  { icon: ListChecks, label: "Missões diárias", path: "/daily-missions" },
  { icon: Bell, label: "Notificações", path: "/notifications" },
  { icon: Coins, label: "Monetag", path: "/monetag" },
  { icon: Smartphone, label: "Instalação", path: "/installers" },
  { icon: Download, label: "Atualização App", path: "/app-update" },
  { icon: FileArchive, label: "APK Download", path: "/apk-manager" },
  { icon: ShieldBan, label: "Blacklist", path: "/blacklist" },
  { icon: Unlink, label: "Dispositivos", path: "/devices" },
  { icon: Shield, label: "Segurança", path: "/security" },
  { icon: Cog, label: "Config. Sistema", path: "/system-settings" },
  { icon: Wrench, label: "Manutenção", path: "/maintenance" },
  { icon: Database, label: "Banco de Dados", path: "/database" },
  { icon: ScrollText, label: "Logs de Auditoria", path: "/audit-logs" },
];

const homeItem = { icon: LayoutDashboard, label: "Dashboard", path: "/" };

function AdminLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          result.error || "Não foi possível entrar. Confira o e-mail e a senha."
        );
        setBusy(false);
        return;
      }
      setPassword("");
      window.location.reload();
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setBusy(false);
    }
  };

  return (
    <main className="admin-crimson-theme flex min-h-screen items-center justify-center bg-[#07090d] px-4 text-[#f5f7fb]">
      <section className="w-full max-w-md rounded-2xl border border-[#30272a] bg-[#0d1016] p-7 shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#713139] bg-[#251317] text-[#ef3943]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8d919b]">
              Young Money
            </p>
            <h1 className="text-lg font-semibold text-white">
              Painel administrativo
            </h1>
          </div>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Acesse sua conta
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#9ba0aa]">
          Entre com seu e-mail e senha de administrador para continuar.
        </p>
        <form className="mt-7 space-y-5" onSubmit={submit}>
          <div>
            <label
              htmlFor="admin-email"
              className="mb-2 block text-sm font-medium text-[#d8d9de]"
            >
              E-mail
            </label>
            <input
              id="admin-email"
              name="username"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="w-full rounded-xl border border-[#343740] bg-[#090c11] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#666b76] focus:border-[#b43c48] focus:ring-2 focus:ring-[#ef3943]/15"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label
              htmlFor="admin-password"
              className="mb-2 block text-sm font-medium text-[#d8d9de]"
            >
              Senha
            </label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="w-full rounded-xl border border-[#343740] bg-[#090c11] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#666b76] focus:border-[#b43c48] focus:ring-2 focus:ring-[#ef3943]/15"
              placeholder="Sua senha"
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2.5 text-sm text-red-300"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center rounded-xl bg-[#c83340] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#df3a48] disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "Entrando…" : "Entrar no painel"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-[#737984]">
          Sua sessão permanecerá ativa neste dispositivo.
        </p>
      </section>
    </main>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const [location, setLocation] = useLocation();
  const [directoryOpen, setDirectoryOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 768
  );
  const isMobile = useIsMobile();
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);
  const isDashboard = location === "/";
  const isRewards = location === "/rewards";
  const usesCrimsonTheme = !isRewards;

  const activeItem =
    directoryItems.find(item => item.path === location) ||
    (location === "/" ? homeItem : null);

  const handleNavigate = (path: string) => {
    setLocation(path);
    if (isMobile) setSidebarOpen(false);
  };

  if (auth.loading) {
    return (
      <main className="admin-crimson-theme flex min-h-screen items-center justify-center bg-[#07090d] text-sm text-[#aeb3bc]">
        Verificando acesso…
      </main>
    );
  }
  if (
    !auth.user ||
    (auth.user.role !== "admin" && auth.user.role !== "superadmin")
  ) {
    return <AdminLoginScreen />;
  }

  return (
    <div
      className={`admin-crimson-theme flex h-screen overflow-hidden text-[#f5f7fb] ${isRewards ? "rewards-shell" : ""} ${
        usesCrimsonTheme ? "bg-[#07090d]" : "bg-[#080b11]"
      }`}
    >
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`admin-sidebar
          ${isMobile ? "fixed z-50 h-full" : "relative"}
          ${sidebarOpen ? "w-[258px]" : "w-0"}
          shrink-0 overflow-hidden border-r transition-all duration-300
          ${usesCrimsonTheme ? "border-[#24272e] bg-[#090c11]" : "border-white/6 bg-[#0b0f15]"}
        `}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/6 px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => handleNavigate(homeItem.path)}
                className="flex min-w-0 items-center gap-3 text-left"
              >
                {!isRewards && (
                  <div
                    className={`flex h-10 w-10 items-center justify-center border ${
                      usesCrimsonTheme
                        ? "rounded-xl border-[#713139] bg-[#251317] text-[#ef3943] shadow-[0_14px_30px_rgba(239,57,67,0.14)]"
                        : "rounded-2xl border-[#1f6feb]/20 bg-[#1f6feb]/14 text-[#6ea8ff] shadow-[0_14px_30px_rgba(31,111,235,0.18)]"
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[11px] uppercase tracking-[0.24em] text-[#7f8a9d]">
                    Young Money
                  </p>
                  <p className="truncate text-sm font-semibold text-white">
                    {isRewards ? "Painel administrativo" : "Admin"}
                  </p>
                </div>
              </button>
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Fechar menu"
                  className="rounded-lg p-2 text-[#9fb3ce] hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <button
              onClick={() => setDirectoryOpen(!directoryOpen)}
              className="mb-3 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7f8a9d] transition hover:bg-white/[0.04] hover:text-[#dbe7ff]"
            >
              <span className="flex items-center gap-2">
                <Users
                  className={`h-4 w-4 ${usesCrimsonTheme ? "text-[#ef3943]" : "text-[#6ea8ff]"}`}
                />
                Navegação
              </span>
              {directoryOpen ? (
                <ChevronDown className="h-4 w-4 text-[#7f8a9d]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[#7f8a9d]" />
              )}
            </button>

            <div className="space-y-1">
              <button
                onClick={() => handleNavigate(homeItem.path)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  location === "/"
                    ? usesCrimsonTheme
                      ? "border border-[#713139] bg-[#211216] text-white shadow-[inset_3px_0_0_#ef3943,0_12px_24px_rgba(0,0,0,0.28)]"
                      : "border border-[#1f6feb]/30 bg-[#101722] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_12px_24px_rgba(15,23,42,0.28)]"
                    : "border border-transparent text-[#98a4b8] hover:border-white/6 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <homeItem.icon
                  className={`h-4 w-4 ${
                    location === "/"
                      ? usesCrimsonTheme
                        ? "text-[#ef3943]"
                        : "text-[#6ea8ff]"
                      : "text-[#7f8a9d]"
                  }`}
                />
                <span className="truncate">{homeItem.label}</span>
              </button>
            </div>

            {directoryOpen && (
              <div className="mt-3 space-y-1">
                {directoryItems.map(item => {
                  const isActive = location === item.path;

                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNavigate(item.path)}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                        isActive
                          ? usesCrimsonTheme
                            ? "border border-[#713139] bg-[#211216] text-white shadow-[inset_3px_0_0_#ef3943,0_12px_24px_rgba(0,0,0,0.28)]"
                            : "border border-[#1f6feb]/30 bg-[#101722] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_12px_24px_rgba(15,23,42,0.28)]"
                          : "border border-transparent text-[#98a4b8] hover:border-white/6 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${
                          isActive
                            ? usesCrimsonTheme
                              ? "text-[#ef3943]"
                              : "text-[#6ea8ff]"
                            : "text-[#7f8a9d]"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-t border-[#24272e] p-3">
            <div className="flex items-center gap-3 rounded-xl border border-[#30272a] bg-[#111317] px-3 py-3">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#713139] bg-[#251317] text-[#ef3943]">
                <Activity className="h-4 w-4" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-[#111317] bg-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">
                  Operação online
                </p>
                <p className="truncate text-[11px] text-[#777074]">
                  Monitoramento ativo
                </p>
              </div>
              <CircleCheck className="ml-auto h-4 w-4 shrink-0 text-emerald-400" />
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={`admin-topbar sticky top-0 z-30 border-b px-4 py-3 backdrop-blur-xl sm:px-6 ${
            usesCrimsonTheme
              ? "border-[#24272e] bg-[#090c11]/95"
              : "border-white/6 bg-[#0b0f15]/92"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? "Fechar menu" : "Abrir menu"}
                className={`border p-2.5 transition ${
                  usesCrimsonTheme
                    ? "rounded-lg border-[#343740] bg-[#101319] text-[#aeb3bc] hover:border-[#633039] hover:bg-[#1b1114] hover:text-white"
                    : "rounded-xl border-white/8 bg-white/[0.03] text-[#aab4c5] hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" />
                )}
              </button>

              <p className="truncate text-base font-semibold text-white">
                {isDashboard
                  ? "Visão geral"
                  : activeItem?.label || "Painel administrativo"}
              </p>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-[#30272a] bg-[#111317] px-3 py-1.5 text-xs text-[#aaa0a3] sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              Sistema operacional
            </div>
          </div>
        </header>

        <main
          className={`admin-main-content flex-1 overflow-y-auto ${
            usesCrimsonTheme
              ? "bg-[radial-gradient(circle_at_78%_-10%,rgba(239,57,67,0.11),transparent_30%),linear-gradient(180deg,#090c11_0%,#080b10_48%,#0b0e13_100%)]"
              : "bg-[radial-gradient(circle_at_top,_rgba(31,111,235,0.10),_transparent_22%),linear-gradient(180deg,_#090c12_0%,_#0b0f16_45%,_#0e131b_100%)]"
          }`}
        >
          <div
            className={`mx-auto p-4 sm:p-6 lg:p-8 ${usesCrimsonTheme ? "max-w-[1600px]" : "max-w-[1480px]"}`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
