import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Smartphone,
  Unlink,
  Search,
  RefreshCw,
  Loader2,
  Monitor,
  Wifi,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  Copy,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 30;

export default function Devices() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);

  // Diálogos
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
  const [showUnlinkAllDialog, setShowUnlinkAllDialog] = useState(false);
  const [showGlobalResetDialog, setShowGlobalResetDialog] = useState(false);
  const [globalResetConfirm, setGlobalResetConfirm] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserName, setSelectedUserName] = useState("");

  // Queries
  const { data, isLoading, refetch } = trpc.devices.list.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: search || undefined,
  });
  const { data: stats } = trpc.devices.stats.useQuery();

  // Mutations
  const unlinkMutation = trpc.devices.unlink.useMutation({
    onSuccess: (result) => {
      if (!result.success) {
        toast.error("Não foi possível localizar o vínculo selecionado");
        return;
      }
      toast.success(
        result.affected > 0
          ? "Vínculo selecionado removido"
          : "Nenhum registro desse aparelho foi encontrado",
        { duration: 6000 }
      );
      setShowUnlinkDialog(false);
      setSelectedDevice(null);
      refetch();
    },
    onError: (error: any) => toast.error(`Erro: ${error.message}`),
  });

  const unlinkAllMutation = trpc.devices.unlinkAll.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.affected > 0
          ? `Conta resetada: ${result.affected} vínculo(s) de aparelho removido(s)`
          : "A conta já estava sem vínculos de aparelhos",
        { duration: 6000 }
      );
      setShowUnlinkAllDialog(false);
      setSelectedUserId(null);
      setSelectedUserName("");
      refetch();
    },
    onError: (error: any) => toast.error(`Erro: ${error.message}`),
  });

  const globalResetMutation = trpc.devices.unlinkAllGlobal.useMutation({
    onSuccess: (result: any) => {
      toast.success(
        `Reset global concluído: ${result.affected} vínculo(s) ativo(s) e inativo(s) excluído(s)`,
        { duration: 6000 }
      );
      setShowGlobalResetDialog(false);
      setGlobalResetConfirm("");
      refetch();
    },
    onError: (error: any) => toast.error(`Erro: ${error.message}`),
  });

  const devices = data?.devices || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatDate = (date: string | Date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copiado!")).catch(() => toast.error("Erro ao copiar"));
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-normal text-[#f3f6fb]">Dispositivos Vinculados</h1>
          <p className="text-sm text-[#99a5b8] mt-1">Gerencie os aparelhos vinculados às contas dos usuários</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGlobalResetDialog(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors border border-red-500/20"
            title="Exclui TODOS os vínculos ativos e inativos de TODOS os usuários"
          >
            <ShieldAlert className="h-4 w-4" />
            Reset Global
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 text-[#8ab4ff] hover:text-[#8ab4ff] text-sm font-medium transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#11161f] rounded-[24px] border border-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.32)] p-6 hover:shadow-[0_22px_48px_rgba(0,0,0,0.36)] transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#99a5b8] uppercase tracking-wider">Ativos</p>
              <p className="text-3xl font-light text-emerald-400 mt-2">{stats?.active || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Smartphone className="h-6 w-6 text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="bg-[#11161f] rounded-[24px] border border-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.32)] p-6 hover:shadow-[0_22px_48px_rgba(0,0,0,0.36)] transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#99a5b8] uppercase tracking-wider">Inativos</p>
              <p className="text-3xl font-light text-[#99a5b8] mt-2">{stats?.inactive || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-[#0f141c] flex items-center justify-center">
              <Unlink className="h-6 w-6 text-[#99a5b8]" />
            </div>
          </div>
        </div>

        <div className="bg-[#11161f] rounded-[24px] border border-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.32)] p-6 hover:shadow-[0_22px_48px_rgba(0,0,0,0.36)] transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#99a5b8] uppercase tracking-wider">Usuários Únicos</p>
              <p className="text-3xl font-light text-[#8ab4ff] mt-2">{stats?.uniqueUsers || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-[#8ab4ff]" />
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-[#11161f] rounded-[24px] border border-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.32)] p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7f8a9d]" />
            <Input
              placeholder="Buscar por nome, email, device ID ou modelo..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10 bg-[#0f141c] border-white/8 text-[#f3f6fb] placeholder:text-[#7f8a9d]"
            />
          </div>
          <Button onClick={handleSearch} className="bg-[#1a73e8] hover:bg-[#174ea6]">
            Buscar
          </Button>
          {search && (
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setPage(0);
              }}
              className="border-white/8 text-[#99a5b8]"
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#11161f] rounded-[24px] border border-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#7f8a9d]" />
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-16 text-[#99a5b8] text-sm">
            {search ? "Nenhum dispositivo encontrado para esta busca" : "Nenhum dispositivo vinculado"}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="grid grid-cols-[60px_1.2fr_1fr_0.75fr_0.55fr_0.65fr_0.75fr_90px_90px] px-6 py-3 text-xs font-medium text-[#99a5b8] uppercase tracking-wider border-b border-white/8">
              <span>ID</span>
              <span>Usuário</span>
              <span>Device ID</span>
              <span>Modelo</span>
              <span>Android</span>
              <span>IP</span>
              <span>Último Acesso</span>
              <span>Status</span>
              <span>Ações</span>
            </div>

            <div className="divide-y divide-[#ffffff0a]">
              {devices.map((d: any) => (
                <div
                  key={d.binding_id}
                  className="grid grid-cols-[60px_1.2fr_1fr_0.75fr_0.55fr_0.65fr_0.75fr_90px_90px] px-6 py-3 items-center hover:bg-[#0f141c] transition-colors text-sm"
                >
                  {/* Binding ID */}
                  <span className="text-[#7f8a9d] font-mono text-xs">#{d.binding_id}</span>

                  {/* Usuário */}
                  <div className="min-w-0">
                    <div className="text-[#f3f6fb] truncate font-medium">{d.user_name || "N/A"}</div>
                    <div className="text-xs text-[#7f8a9d] truncate">{d.email || ""}</div>
                  </div>

                  {/* Device ID */}
                  <div className="min-w-0 flex items-center gap-1">
                    <span className="text-[#99a5b8] font-mono text-xs truncate" title={d.device_id}>
                      {d.device_id ? `${d.device_id.substring(0, 16)}...` : "N/A"}
                    </span>
                    {d.device_id && (
                      <button
                        onClick={() => copyToClipboard(d.device_id)}
                        className="flex-shrink-0 p-0.5 rounded hover:bg-[#132033] text-[#7f8a9d] hover:text-[#99a5b8]"
                        title="Copiar"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Modelo */}
                  <div className="min-w-0 flex items-center gap-1.5">
                    <Monitor className="h-3.5 w-3.5 text-[#7f8a9d] flex-shrink-0" />
                    <span className="text-[#99a5b8] text-xs truncate">{d.model || "N/A"}</span>
                  </div>

                  {/* Android Version */}
                  <span className="text-[#99a5b8] text-xs">{d.android_version || "-"}</span>

                  {/* IP */}
                  <div className="min-w-0 flex items-center gap-1">
                    <Wifi className="h-3 w-3 text-[#7f8a9d] flex-shrink-0" />
                    <span className="text-[#99a5b8] font-mono text-xs truncate">{d.ip_address || "-"}</span>
                  </div>

                  {/* Último Acesso */}
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-[#7f8a9d] flex-shrink-0" />
                    <span className="text-[#99a5b8] text-xs">{formatDate(d.last_seen)}</span>
                  </div>

                  {/* Status */}
                  <span
                    className={`w-fit rounded-full px-2 py-1 text-[11px] font-medium ${
                      d.is_active
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-white/5 text-[#7f8a9d]"
                    }`}
                  >
                    {d.is_active ? "Ativo" : "Inativo"}
                  </span>

                  {/* Ações */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedDevice(d);
                        setShowUnlinkDialog(true);
                      }}
                      className="p-1.5 rounded-full hover:bg-red-500/10 text-red-400 transition-colors"
                      title="Excluir somente este vínculo"
                    >
                      <Unlink className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUserId(d.user_id);
                        setSelectedUserName(d.user_name || d.email || `User #${d.user_id}`);
                        setShowUnlinkAllDialog(true);
                      }}
                      className="p-1.5 rounded-full hover:bg-orange-500/10 text-orange-400 transition-colors"
                      title="Resetar a conta e remover TODOS os aparelhos ativos e inativos"
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="px-6 py-3 border-t border-white/8 flex items-center justify-between text-xs text-[#99a5b8]">
              <span>
                Mostrando {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} de {total} dispositivos
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="p-1 rounded hover:bg-[#132033] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span>
                  Página {page + 1} de {totalPages || 1}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1 rounded hover:bg-[#132033] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ========================================
          UNLINK SINGLE DEVICE DIALOG
          ======================================== */}
      <Dialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Unlink className="h-5 w-5" />
              Liberar Aparelho
            </DialogTitle>
            <DialogDescription>
              Esta ação exclui apenas o vínculo selecionado. Depois disso, a conta poderá vincular este aparelho novamente.
            </DialogDescription>
          </DialogHeader>

          {selectedDevice && (
            <div className="py-2">
              <div className="rounded-lg bg-[#0f141c] border border-white/8 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#99a5b8]">Usuário</span>
                  <span className="text-[#f3f6fb] font-medium">{selectedDevice.user_name || "N/A"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#99a5b8]">Email</span>
                  <span className="text-[#f3f6fb]">{selectedDevice.email || "N/A"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#99a5b8]">Modelo</span>
                  <span className="text-[#f3f6fb]">{selectedDevice.model || "N/A"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#99a5b8]">Device ID</span>
                  <span className="text-[#f3f6fb] font-mono text-xs truncate max-w-[200px]" title={selectedDevice.device_id}>
                    {selectedDevice.device_id || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#99a5b8]">Último Acesso</span>
                  <span className="text-[#f3f6fb]">{formatDate(selectedDevice.last_seen)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnlinkDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!selectedDevice) return;
                unlinkMutation.mutate({ bindingId: selectedDevice.binding_id });
              }}
              disabled={unlinkMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {unlinkMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlink className="w-4 h-4 mr-2" />}
              Remover aparelho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================
          GLOBAL RESET DIALOG
          ======================================== */}
      <Dialog
        open={showGlobalResetDialog}
        onOpenChange={(open) => {
          setShowGlobalResetDialog(open);
          if (!open) setGlobalResetConfirm("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <ShieldAlert className="h-5 w-5" />
              Reset Global Completo
            </DialogTitle>
            <DialogDescription>
              Esta ação irá excluir <strong>TODOS</strong> os vínculos de dispositivos ativos e inativos de <strong>TODOS</strong> os usuários.
              Todas as contas ficarão livres para vincular novamente no próximo login.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <div className="rounded-lg bg-red-500/5 border border-red-500/30 p-3">
              <p className="text-xs text-red-400 leading-relaxed">
                Ação irreversível. Atualmente existem <strong>{(stats?.active || 0) + (stats?.inactive || 0)}</strong> vínculo(s)
                que serão excluídos. Contas, saldos e pontos não serão alterados; a operação será registrada nos logs de auditoria.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#99a5b8] mb-1.5">
                Para confirmar, digite <span className="text-red-400 font-mono">RESET</span> abaixo:
              </label>
              <Input
                value={globalResetConfirm}
                onChange={(e) => setGlobalResetConfirm(e.target.value)}
                placeholder="Digite RESET"
                className="bg-[#0f141c] border-white/8 text-[#f3f6fb] placeholder:text-[#7f8a9d] font-mono"
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGlobalResetDialog(false);
                setGlobalResetConfirm("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => globalResetMutation.mutate({ confirm: "RESET" })}
              disabled={globalResetConfirm !== "RESET" || globalResetMutation.isPending}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {globalResetMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShieldAlert className="w-4 h-4 mr-2" />
              )}
              Executar Reset Global
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================
          RESET USER DEVICE BINDINGS DIALOG
          ======================================== */}
      <Dialog open={showUnlinkAllDialog} onOpenChange={setShowUnlinkAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              Resetar Conta e Aparelhos
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja resetar os aparelhos da conta <strong>{selectedUserName}</strong>?
              Todos os vínculos ativos e inativos serão excluídos, deixando a conta livre para vincular novamente no próximo login.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-3">
              <p className="text-xs text-orange-400">
                Esta ação remove definitivamente todo o histórico de aparelhos desta conta em device_bindings. Os dados da conta, saldo e pontos não serão alterados.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnlinkAllDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!selectedUserId) return;
                unlinkAllMutation.mutate({ userId: selectedUserId });
              }}
              disabled={unlinkAllMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {unlinkAllMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
              Resetar Conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
