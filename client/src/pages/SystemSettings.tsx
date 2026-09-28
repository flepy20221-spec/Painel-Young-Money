import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Clock, DollarSign, Gamepad2, Settings, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function SystemSettings() {
  const { data: settings, isLoading, refetch } = trpc.settings.list.useQuery();
  const updateSetting = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Configuração atualizada com sucesso!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const handleSave = (key: string, value: string) => {
    updateSetting.mutate({ key, value });
  };

  const getSettingIcon = (key: string) => {
    if (key.includes("time") || key.includes("reset")) return <Clock className="h-4 w-4 text-blue-500" />;
    if (key.includes("withdraw") || key.includes("min") || key.includes("max")) return <DollarSign className="h-4 w-4 text-green-500" />;
    if (key.includes("spin")) return <Gamepad2 className="h-4 w-4 text-purple-500" />;
    return <Settings className="h-4 w-4 text-[#99a5b8]" />;
  };

  const getSettingDescription = (key: string) => {
    const descriptions: Record<string, string> = {
      reset_time: "Horário de reset diário do sistema",
      quick_withdraw_values: "Valores rápidos para saque (JSON array)",
      max_daily_spins: "Número máximo de giros diários na roleta",
      min_withdrawal: "Valor mínimo para saque (R$)",
      max_withdrawal: "Valor máximo para saque (R$)",
      last_reset_datetime: "Data/hora do último reset do sistema",
      maintenance_mode: "Ativar/desativar modo de manutenção (0 ou 1)",
      maintenance_message: "Mensagem exibida durante a manutenção",
    };
    return descriptions[key] || "Configuração do sistema";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-normal text-[#f3f6fb]">Configurações do Sistema</h1>
          <p className="text-sm text-[#99a5b8] mt-1">Gerencie as configurações globais do aplicativo</p>
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
          <h1 className="text-2xl font-normal text-[#f3f6fb]">Configurações do Sistema</h1>
          <p className="text-sm text-[#99a5b8] mt-1">Gerencie as configurações globais do aplicativo</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-[#8ab4ff] hover:text-[#8ab4ff] text-sm font-medium transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {/* Settings List */}
      <div className="bg-[#11161f] rounded-[24px] border border-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.32)] divide-y divide-[#eef2f7]">
        {settings?.map((setting: any) => (
          <div key={setting.id} className="px-6 py-4">
            <div className="flex items-start gap-4">
              <div className="mt-1 shrink-0">{getSettingIcon(setting.setting_key)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-[#f3f6fb]">{setting.setting_key}</h3>
                </div>
                <p className="text-xs text-[#99a5b8] mt-0.5">{getSettingDescription(setting.setting_key)}</p>
                <div className="flex gap-2 mt-3">
                  <Input
                    value={editValues[setting.setting_key] ?? setting.setting_value}
                    onChange={(e) =>
                      setEditValues({ ...editValues, [setting.setting_key]: e.target.value })
                    }
                    className="flex-1 text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      handleSave(setting.setting_key, editValues[setting.setting_key] ?? setting.setting_value)
                    }
                    disabled={updateSetting.isPending}
                    className="bg-blue-600 hover:bg-blue-700 shrink-0"
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    Salvar
                  </Button>
                </div>
                <p className="text-xs text-[#7f8a9d] mt-2">
                  Atualizado: {new Date(setting.updated_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
