import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Wrench, Power, PowerOff, RefreshCw, AlertTriangle, CheckCircle2, Bell, UserPlus, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Maintenance() {
  const { data: settings, isLoading, refetch } = trpc.settings.list.useQuery();
  const updateSetting = trpc.settings.update.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  // ================= E-MAILS LIBERADOS NA MANUTENÇÃO =================
  const allowedEmailsQuery = trpc.settings.allowedMaintenanceEmails.useQuery(undefined, {
    refetchInterval: 15000, // Atualizar a cada 15s
  });
  const saveAllowedEmails = trpc.settings.saveAllowedMaintenanceEmails.useMutation({
    onSuccess: () => {
      allowedEmailsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao salvar e-mails liberados: ${error.message}`);
    },
  });
  const [newEmail, setNewEmail] = useState("");
  const allowedEmails: string[] = allowedEmailsQuery.data ?? [];

  const handleAddEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Digite um e-mail válido");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("O formato do e-mail é inválido");
      return;
    }
    if (allowedEmails.includes(email)) {
      toast.warning("Este e-mail já está na lista de liberados");
      setNewEmail("");
      return;
    }
    const updated = [...allowedEmails, email];
    await saveAllowedEmails.mutateAsync({ emails: updated });
    setNewEmail("");
    toast.success(`E-mail ${email} liberado para acessar o servidor em manutenção`);
  };

  const handleRemoveEmail = async (email: string) => {
    const updated = allowedEmails.filter((e) => e !== email);
    await saveAllowedEmails.mutateAsync({ emails: updated });
    toast.success(`E-mail ${email} removido da lista de liberados`);
  };

  const toggleMaintenance = trpc.settings.toggleMaintenance.useMutation({
    onSuccess: (data) => {
      refetch();
      if (data.push_notification && data.push_notification.success !== false) {
        toast.success("Push notification FCM enviada com sucesso!");
      } else if (data.push_notification) {
        toast.warning("Manutenção atualizada, mas push FCM falhou: " + (data.push_notification.error || "erro desconhecido"));
      }
    },
    onError: (error) => {
      toast.error(`Erro ao alternar manutenção: ${error.message}`);
    },
  });

  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [isToggling, setIsToggling] = useState(false);

  const maintenanceMode = settings?.find(
    (s: any) => s.setting_key === "maintenance_mode"
  );
  const maintenanceMsg = settings?.find(
    (s: any) => s.setting_key === "maintenance_message"
  );

  const isMaintenanceActive = maintenanceMode?.setting_value === "1";

  useEffect(() => {
    if (maintenanceMsg) {
      setMaintenanceMessage(maintenanceMsg.setting_value || "");
    }
  }, [maintenanceMsg]);

  const handleToggleMaintenance = async () => {
    setIsToggling(true);
    const newEnabled = !isMaintenanceActive;

    try {
      // Chama o novo endpoint que atualiza settings + dispara push FCM via PHP
      await toggleMaintenance.mutateAsync({
        enabled: newEnabled,
        message: maintenanceMessage.trim() || "Servidor em manutenção. Tente novamente mais tarde.",
      });

      toast.success(
        newEnabled
          ? "Modo de manutenção ATIVADO - Push notification enviada aos usuários"
          : "Modo de manutenção DESATIVADO - Push notification enviada aos usuários"
      );
    } catch (err) {
      // error handled by mutation
    } finally {
      setIsToggling(false);
    }
  };

  const handleUpdateMessage = async () => {
    if (!maintenanceMessage.trim()) {
      toast.error("A mensagem não pode estar vazia");
      return;
    }
    try {
      await updateSetting.mutateAsync({
        key: "maintenance_message",
        value: maintenanceMessage,
      });
      toast.success("Mensagem de manutenção atualizada");
    } catch (err) {
      // error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-normal text-[#f3f6fb]">Manutenção</h1>
          <p className="text-sm text-[#99a5b8] mt-1">
            Controle o modo de manutenção do servidor
          </p>
        </div>
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#7f8a9d]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-normal text-[#f3f6fb]">Manutenção</h1>
          <p className="text-sm text-[#99a5b8] mt-1">
            Controle o modo de manutenção do servidor
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-[#8ab4ff] hover:text-[#8ab4ff] text-sm font-medium transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {/* Status Banner */}
      <div
        className={`rounded-xl border-2 p-6 ${
          isMaintenanceActive
            ? "bg-red-50 border-red-200"
            : "bg-green-50 border-green-200"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              isMaintenanceActive ? "bg-red-100" : "bg-green-100"
            }`}
          >
            {isMaintenanceActive ? (
              <Wrench className="h-7 w-7 text-red-600" />
            ) : (
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            )}
          </div>
          <div className="flex-1">
            <h2
              className={`text-xl font-medium ${
                isMaintenanceActive ? "text-red-800" : "text-green-800"
              }`}
            >
              {isMaintenanceActive
                ? "Servidor em Manutenção"
                : "Servidor Operacional"}
            </h2>
            <p
              className={`text-sm mt-1 ${
                isMaintenanceActive ? "text-red-600" : "text-green-600"
              }`}
            >
              {isMaintenanceActive
                ? "Todas as APIs POST e GET estão bloqueadas. Usuários verão a tela de manutenção."
                : "Todas as APIs estão funcionando normalmente. Usuários podem acessar o app."}
            </p>
          </div>
          <div
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              isMaintenanceActive
                ? "bg-red-200 text-red-800"
                : "bg-green-200 text-green-800"
            }`}
          >
            {isMaintenanceActive ? "ATIVO" : "INATIVO"}
          </div>
        </div>
      </div>

      {/* E-mails liberados na manutenção */}
      <div className="bg-[#11161f] rounded-[24px] border border-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.32)] p-6">
        <h3 className="text-lg font-medium text-[#f3f6fb] mb-1 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-[#99a5b8]" />
          E-mails liberados durante manutenção
        </h3>
        <p className="text-xs text-[#99a5b8] mb-4">
          E-mails desta lista podem acessar o servidor normalmente mesmo com o modo de
          manutenção ativo. Útil para manter o acesso de usuários específicos durante
          atualizações e correções.
        </p>

        {/* Adicionar e-mail */}
        <div className="flex gap-2">
          <Input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Digite o e-mail a liberar (ex: usuario@exemplo.com)"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddEmail();
              }
            }}
            className="h-10 bg-[#11161f] border-white/10 text-sm"
          />
          <Button
            onClick={handleAddEmail}
            disabled={saveAllowedEmails.isPending}
            className="h-10 px-4 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-sm"
          >
            {saveAllowedEmails.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Liberar
          </Button>
        </div>

        {/* Lista de e-mails */}
        <div className="mt-4 space-y-2">
          {allowedEmailsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-[#7f8a9d]" />
            </div>
          ) : allowedEmails.length === 0 ? (
            <div className="text-center py-6 text-sm text-[#99a5b8]">
              Nenhum e-mail liberado ainda. Adicione acima para permitir o acesso durante a manutenção.
            </div>
          ) : (
            allowedEmails.map((email) => (
              <div
                key={email}
                className="flex items-center justify-between bg-white/5 border border-white/8 rounded-xl px-4 py-2.5"
              >
                <span className="text-sm text-[#f3f6fb] truncate">{email}</span>
                <button
                  onClick={() => handleRemoveEmail(email)}
                  disabled={saveAllowedEmails.isPending}
                  className="text-[#99a5b8] hover:text-red-400 transition-colors p-1"
                  title="Remover da lista"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {saveAllowedEmails.error && (
          <p className="text-xs text-red-400 mt-2">
            Erro ao sincronizar com o servidor: {saveAllowedEmails.error.message}
          </p>
        )}
      </div>

      {/* Toggle Card */}
      <div className="bg-[#11161f] rounded-[24px] border border-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.32)] p-6">
        <h3 className="text-lg font-medium text-[#f3f6fb] mb-4 flex items-center gap-2">
          <Power className="h-5 w-5 text-[#99a5b8]" />
          Controle de Manutenção
        </h3>

        <div className="space-y-4">
          {/* Message input */}
          <div>
            <label className="block text-sm font-medium text-[#99a5b8] mb-2">
              Mensagem para os usuários
            </label>
            <textarea
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              placeholder="Estamos realizando melhorias no sistema. Voltaremos em breve!"
              className="w-full px-4 py-3 border border-white/10 rounded-2xl bg-[#11161f] text-sm shadow-[inset_0_1px_2px_rgba(60,64,67,0.04)] focus:outline-none focus:ring-4 focus:ring-[#d2e3fc] focus:border-[#1a73e8] resize-none"
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleUpdateMessage}
                disabled={updateSetting.isPending}
                className="text-sm text-[#8ab4ff] hover:text-[#8ab4ff] font-medium"
              >
                Salvar mensagem
              </button>
            </div>
          </div>

          {/* Toggle button */}
          <div className="pt-4 border-t border-white/8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#f3f6fb]">
                  {isMaintenanceActive
                    ? "Desativar modo de manutenção"
                    : "Ativar modo de manutenção"}
                </p>
                <p className="text-xs text-[#99a5b8] mt-1">
                  {isMaintenanceActive
                    ? "Isso irá restaurar o acesso normal ao app e notificar os usuários via push"
                    : "Isso irá bloquear todas as APIs, mostrar tela de manutenção e notificar os usuários via push"}
                </p>
              </div>
              <button
                onClick={handleToggleMaintenance}
                disabled={isToggling}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-colors ${
                  isMaintenanceActive
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {isToggling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isMaintenanceActive ? (
                  <Power className="h-4 w-4" />
                ) : (
                  <PowerOff className="h-4 w-4" />
                )}
                {isMaintenanceActive ? "Desativar" : "Ativar Manutenção"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FCM Push Info */}
      <div className="bg-[#11161f] rounded-[24px] border border-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.32)] p-4 flex items-start gap-3">
        <Bell className="h-5 w-5 text-[#8ab4ff] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[#f3f6fb]">Push Notification Firebase</p>
          <p className="text-xs text-[#99a5b8] mt-1">
            Ao ativar ou desativar a manutenção, uma push notification é enviada automaticamente
            para todos os usuários via Firebase Cloud Messaging (tópico "all"). Quando ativada,
            a mensagem de manutenção é enviada. Quando desativada, os usuários são notificados
            que o app está disponível novamente.
          </p>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Importante</p>
          <p className="text-xs text-amber-700 mt-1">
            Quando o modo de manutenção está ativo, o middleware de segurança
            bloqueia TODAS as requisições (exceto endpoints de admin). Os
            usuários que estiverem logados serão desconectados automaticamente e
            redirecionados para a tela de login com um aviso de manutenção.
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-[#11161f] rounded-[24px] border border-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.32)] p-6">
        <h3 className="text-lg font-medium text-[#f3f6fb] mb-3">
          Como funciona
        </h3>
        <div className="space-y-3 text-sm text-[#99a5b8]">
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#8ab4ff] flex items-center justify-center text-xs font-medium shrink-0">
              1
            </span>
            <p>
              Ao ativar, o <strong>security_middleware_v3.php</strong> intercepta
              todas as requisições e retorna HTTP 503 com a mensagem configurada.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#8ab4ff] flex items-center justify-center text-xs font-medium shrink-0">
              2
            </span>
            <p>
              Uma <strong>push notification FCM</strong> é disparada para o tópico "all",
              notificando todos os usuários sobre a manutenção.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#8ab4ff] flex items-center justify-center text-xs font-medium shrink-0">
              3
            </span>
            <p>
              O app Flutter detecta o código 503, faz logout silencioso e
              redireciona para a tela de login.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#8ab4ff] flex items-center justify-center text-xs font-medium shrink-0">
              4
            </span>
            <p>
              Na tela de login, um dialog premium exibe a mensagem de manutenção
              personalizada.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#8ab4ff] flex items-center justify-center text-xs font-medium shrink-0">
              5
            </span>
              <p>
              Ao desativar, tudo volta ao normal automaticamente. Os usuários
              recebem push informando que o app está disponível e podem fazer login novamente.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#8ab4ff] flex items-center justify-center text-xs font-medium shrink-0">
              6
            </span>
            <p>
              E-mails cadastrados em <strong>“E-mails liberados durante manutenção”</strong> não
              são bloqueados: eles continuam acessando o servidor normalmente, identificados por
              token, e-mail no body, Google ID ou dispositivo vinculado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
