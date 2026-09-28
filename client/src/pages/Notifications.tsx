import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Send, Megaphone, Smartphone, AlertCircle, Info, CheckCircle, Coins, CalendarClock, Trash2, Power, RefreshCw } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://youngmoney-api-railway-production-5bf3.up.railway.app";

type Schedule = {
  id: number;
  title: string;
  message: string;
  type: string;
  schedule_type: "fixed" | "random";
  delivery_type?: "notification" | "lucky_popup";
  popup_points?: number;
  fixed_time?: string | null;
  random_count?: number;
  random_start?: string;
  random_end?: string;
  timezone?: string;
  next_run_at?: string | null;
  is_active: boolean;
  last_run_at?: string | null;
  last_run_status?: "processing" | "success" | "failed" | null;
  last_run_push_warning?: boolean;
};

export default function Notifications() {
  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery({ limit: 100 });
  
  const createNotification = trpc.notifications.create.useMutation({
    onSuccess: () => {
      toast.success("Notificação enviada!");
      refetch();
      setOpen(false);
      setForm({ userId: "", title: "", message: "", type: "info", points: "" });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const broadcastNotification = trpc.notifications.broadcast.useMutation({
    onSuccess: () => {
      toast.success("Notificação broadcast enviada para todos os usuários!");
      refetch();
      setBroadcastOpen(false);
      setBroadcastForm({ title: "", message: "", type: "info", points: "" });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const sendPushMutation = trpc.notifications.sendPush.useMutation({
    onSuccess: (data: any) => {
      if (data?.status === "success") {
        toast.success("Push notification enviada com sucesso!");
        setPushOpen(false);
        setPushForm({ title: "", body: "", target: "all", topic: "all", userId: "", imageUrl: "" });
        refetch();
      } else {
        toast.error(`Erro: ${data?.error || "Falha ao enviar push"}`);
      }
    },
    onError: (error: any) => toast.error(`Erro: ${error.message}`),
  });

  const [open, setOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [form, setForm] = useState({ userId: "", title: "", message: "", type: "info", points: "" });
  const [broadcastForm, setBroadcastForm] = useState({ title: "", message: "", type: "info", points: "" });
  const [pushForm, setPushForm] = useState({ 
    title: "", 
    body: "", 
    target: "all", 
    topic: "all", 
    userId: "",
    imageUrl: "" 
  });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [scheduleForm, setScheduleForm] = useState({
    title: "",
    message: "",
    type: "info",
    delivery_type: "lucky_popup" as "notification" | "lucky_popup",
    popup_points: "1000",
    schedule_type: "fixed" as "fixed" | "random",
    fixed_time: "12:00",
    random_count: "4",
    random_start: "08:00",
    random_end: "22:00",
  });

  const loadSchedules = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/notifications/schedules.php`);
      const data = await response.json();
      if (data.success) setSchedules(data.data || []);
    } catch (error: any) {
      toast.error(`Não foi possível carregar as rotinas: ${error.message}`);
    }
  };

  useEffect(() => {
    loadSchedules();
    const refreshTimer = window.setInterval(loadSchedules, 60_000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  const handleCreateSchedule = async () => {
    if (!scheduleForm.title.trim() || !scheduleForm.message.trim()) {
      toast.error("Informe o título e a mensagem da rotina");
      return;
    }
    setScheduleSaving(true);
    try {
      const response = await fetch(`${API_BASE}/admin/notifications/schedules.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: scheduleForm.title,
          message: scheduleForm.message,
          type: scheduleForm.type,
          delivery_type: scheduleForm.delivery_type,
          popup_points: Number(scheduleForm.popup_points),
          schedule_type: scheduleForm.schedule_type,
          fixed_time: scheduleForm.fixed_time,
          random_count: Number(scheduleForm.random_count),
          random_start: scheduleForm.random_start,
          random_end: scheduleForm.random_end,
          timezone: "America/Sao_Paulo",
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Falha ao criar rotina");
      toast.success("Notificação recorrente agendada!");
      setScheduleOpen(false);
      setScheduleForm({ title: "", message: "", type: "info", delivery_type: "lucky_popup", popup_points: "1000", schedule_type: "fixed", fixed_time: "12:00", random_count: "4", random_start: "08:00", random_end: "22:00" });
      await loadSchedules();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setScheduleSaving(false);
    }
  };

  const updateSchedule = async (schedule: Schedule, patch: Record<string, unknown>) => {
    try {
      const response = await fetch(`${API_BASE}/admin/notifications/schedules.php?id=${schedule.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Falha ao atualizar rotina");
      await loadSchedules();
    } catch (error: any) { toast.error(error.message); }
  };

  const deleteSchedule = async (schedule: Schedule) => {
    if (!window.confirm(`Excluir a rotina “${schedule.title}”?`)) return;
    try {
      const response = await fetch(`${API_BASE}/admin/notifications/schedules.php?id=${schedule.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Falha ao excluir rotina");
      toast.success("Rotina excluída");
      await loadSchedules();
    } catch (error: any) { toast.error(error.message); }
  };

  const handleSend = () => {
    if (!form.userId || !form.title || !form.message) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    createNotification.mutate({
      userId: parseInt(form.userId),
      title: form.title,
      message: form.message,
      type: form.type,
      points: form.points ? parseInt(form.points) : 0,
    });
  };

  const handleBroadcast = () => {
    if (!broadcastForm.title || !broadcastForm.message) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    broadcastNotification.mutate({
      title: broadcastForm.title,
      message: broadcastForm.message,
      type: broadcastForm.type,
      points: broadcastForm.points ? parseInt(broadcastForm.points) : 0,
    });
  };

  const handlePushSend = () => {
    if (!pushForm.title || !pushForm.body) {
      toast.error("Preencha título e mensagem");
      return;
    }
    if (pushForm.target === "user" && !pushForm.userId) {
      toast.error("Informe o ID do usuário");
      return;
    }

    sendPushMutation.mutate({
      title: pushForm.title,
      body: pushForm.body,
      target: pushForm.target as "all" | "topic" | "user",
      topic: pushForm.topic || "all",
      userId: pushForm.userId ? parseInt(pushForm.userId) : undefined,
      imageUrl: pushForm.imageUrl || undefined,
    });
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'success': 'default',
      'warning': 'secondary',
      'error': 'destructive',
      'info': 'outline',
    };
    return <Badge variant={variants[type] || 'outline'}>{type}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Notificações</h1>
            <p className="text-muted-foreground">Envie notificações e push para usuários</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Programar rotina
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" />Notificação recorrente</DialogTitle>
                <DialogDescription>O servidor enviará a mensagem para todos diariamente, mesmo com o painel fechado.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div><Label>Título *</Label><Input value={scheduleForm.title} onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })} placeholder="Ex: Bônus disponível" /></div>
                <div><Label>Mensagem *</Label><Textarea value={scheduleForm.message} onChange={(e) => setScheduleForm({ ...scheduleForm, message: e.target.value })} placeholder="Texto que aparecerá no app" /></div>
                <div><Label>Tipo de entrega</Label><Select value={scheduleForm.delivery_type} onValueChange={(v) => setScheduleForm({ ...scheduleForm, delivery_type: v as "notification" | "lucky_popup" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lucky_popup">Lucky Popup — assistir vídeo e dobrar pontos</SelectItem><SelectItem value="notification">Notificação normal</SelectItem></SelectContent></Select></div>
                {scheduleForm.delivery_type === "lucky_popup" && <div><Label>Pontos da recompensa</Label><Input type="number" min="1" max="100000" value={scheduleForm.popup_points} onChange={(e) => setScheduleForm({ ...scheduleForm, popup_points: e.target.value })} /><p className="text-xs text-muted-foreground mt-1">O usuário poderá resgatar ou assistir um vídeo para dobrar a recompensa.</p></div>}
                <div><Label>Frequência</Label><Select value={scheduleForm.schedule_type} onValueChange={(v) => setScheduleForm({ ...scheduleForm, schedule_type: v as "fixed" | "random" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Todos os dias em um horário fixo</SelectItem><SelectItem value="random">4 horários aleatórios por dia</SelectItem></SelectContent></Select></div>
                {scheduleForm.schedule_type === "fixed" ? (
                  <div><Label>Horário (Brasília)</Label><Input type="time" value={scheduleForm.fixed_time} onChange={(e) => setScheduleForm({ ...scheduleForm, fixed_time: e.target.value })} /><p className="text-xs text-muted-foreground mt-1">Ex.: 00:00 para meia-noite ou 12:00 para meio-dia.</p></div>
                ) : (
                  <div className="grid grid-cols-3 gap-3"><div><Label>Quantidade</Label><Input type="number" min="1" max="12" value={scheduleForm.random_count} onChange={(e) => setScheduleForm({ ...scheduleForm, random_count: e.target.value })} /></div><div><Label>Início</Label><Input type="time" value={scheduleForm.random_start} onChange={(e) => setScheduleForm({ ...scheduleForm, random_start: e.target.value })} /></div><div><Label>Fim</Label><Input type="time" value={scheduleForm.random_end} onChange={(e) => setScheduleForm({ ...scheduleForm, random_end: e.target.value })} /></div></div>
                )}
                <div><Label>Tipo</Label><Select value={scheduleForm.type} onValueChange={(v) => setScheduleForm({ ...scheduleForm, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info">Info</SelectItem><SelectItem value="success">Sucesso</SelectItem><SelectItem value="warning">Aviso</SelectItem><SelectItem value="error">Erro</SelectItem></SelectContent></Select></div>
                <Button onClick={handleCreateSchedule} disabled={scheduleSaving} className="w-full">{scheduleSaving ? "Salvando..." : "Salvar rotina"}</Button>
              </div>
            </DialogContent>
          </Dialog>
          {/* Botão Push Notification */}
          <Dialog open={pushOpen} onOpenChange={setPushOpen}>
            <DialogTrigger asChild>
              <Button variant="default" className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                <Smartphone className="h-4 w-4" />
                Push Notification
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Enviar Push Notification
                </DialogTitle>
                <DialogDescription>
                  Envia notificação push para o celular do usuário (aparece mesmo com app fechado)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Destino</Label>
                  <Select value={pushForm.target} onValueChange={(v) => setPushForm({ ...pushForm, target: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Usuários</SelectItem>
                      <SelectItem value="topic">Tópico Específico</SelectItem>
                      <SelectItem value="user">Usuário Específico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {pushForm.target === "topic" && (
                  <div>
                    <Label>Tópico</Label>
                    <Select value={pushForm.topic} onValueChange={(v) => setPushForm({ ...pushForm, topic: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">all (Todos)</SelectItem>
                        <SelectItem value="maintenance">maintenance (Manutenção)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {pushForm.target === "user" && (
                  <div>
                    <Label>ID do Usuário *</Label>
                    <Input
                      type="number"
                      value={pushForm.userId}
                      onChange={(e) => setPushForm({ ...pushForm, userId: e.target.value })}
                      placeholder="Ex: 31"
                    />
                  </div>
                )}

                <div>
                  <Label>Título *</Label>
                  <Input
                    value={pushForm.title}
                    onChange={(e) => setPushForm({ ...pushForm, title: e.target.value })}
                    placeholder="Ex: Novidade no Young Money!"
                  />
                </div>
                <div>
                  <Label>Mensagem *</Label>
                  <Textarea
                    value={pushForm.body}
                    onChange={(e) => setPushForm({ ...pushForm, body: e.target.value })}
                    placeholder="Ex: Confira as novas funcionalidades do app!"
                  />
                </div>
                <div>
                  <Label>URL da Imagem (opcional)</Label>
                  <Input
                    value={pushForm.imageUrl}
                    onChange={(e) => setPushForm({ ...pushForm, imageUrl: e.target.value })}
                    placeholder="https://exemplo.com/imagem.png"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Imagem que aparece na notificação push
                  </p>
                </div>
                <Button 
                  onClick={handlePushSend} 
                  disabled={sendPushMutation.isPending} 
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {sendPushMutation.isPending ? "Enviando Push..." : "Enviar Push Notification"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Enviar para Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enviar Notificação</DialogTitle>
                <DialogDescription>Envie uma notificação para um usuário específico (com pontos opcionais)</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>ID do Usuário *</Label>
                  <Input
                    type="number"
                    value={form.userId}
                    onChange={(e) => setForm({ ...form, userId: e.target.value })}
                    placeholder="Ex: 31"
                  />
                </div>
                <div>
                  <Label>Título *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Título da notificação"
                  />
                </div>
                <div>
                  <Label>Mensagem *</Label>
                  <Textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Conteúdo da notificação"
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="success">Sucesso</SelectItem>
                      <SelectItem value="warning">Aviso</SelectItem>
                      <SelectItem value="error">Erro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-yellow-500" />
                    Pontos a Adicionar (opcional)
                  </Label>
                  <Input
                    type="number"
                    value={form.points}
                    onChange={(e) => setForm({ ...form, points: e.target.value })}
                    placeholder="Ex: 100"
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Deixe em branco ou 0 para não adicionar pontos
                  </p>
                </div>
                <Button onClick={handleSend} disabled={createNotification.isPending} className="w-full">
                  {createNotification.isPending ? "Enviando..." : "Enviar Notificação"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Broadcast
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Broadcast para Todos</DialogTitle>
                <DialogDescription>Envie uma notificação para todos os usuários (com pontos opcionais)</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título *</Label>
                  <Input
                    value={broadcastForm.title}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                    placeholder="Título da notificação"
                  />
                </div>
                <div>
                  <Label>Mensagem *</Label>
                  <Textarea
                    value={broadcastForm.message}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                    placeholder="Conteúdo da notificação"
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={broadcastForm.type} onValueChange={(v) => setBroadcastForm({ ...broadcastForm, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="success">Sucesso</SelectItem>
                      <SelectItem value="warning">Aviso</SelectItem>
                      <SelectItem value="error">Erro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-yellow-500" />
                    Pontos a Adicionar para Cada Usuário (opcional)
                  </Label>
                  <Input
                    type="number"
                    value={broadcastForm.points}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, points: e.target.value })}
                    placeholder="Ex: 50"
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Cada usuário receberá esta quantidade de pontos
                  </p>
                </div>
                <Button onClick={handleBroadcast} disabled={broadcastNotification.isPending} className="w-full">
                  {broadcastNotification.isPending ? "Enviando..." : "Enviar para Todos"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Card de Push Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Smartphone className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Push Notifications</p>
                <p className="text-2xl font-bold">Ativo</p>
                <p className="text-xs text-muted-foreground">Firebase Cloud Messaging</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Bell className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Enviadas</p>
                <p className="text-2xl font-bold">{notifications?.length || 0}</p>
                <p className="text-xs text-muted-foreground">No banco de dados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Megaphone className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Tópicos</p>
                <p className="text-2xl font-bold">2</p>
                <p className="text-xs text-muted-foreground">all, maintenance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div><CardTitle>Rotinas programadas</CardTitle><CardDescription>Mensagens automáticas para todos os usuários</CardDescription></div>
          <Button variant="ghost" size="sm" onClick={loadSchedules}><RefreshCw className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma rotina criada.</p> : <div className="space-y-3">{schedules.map((schedule) => (
            <div key={schedule.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><p className="font-medium truncate">{schedule.title}</p><Badge variant={schedule.is_active ? "default" : "secondary"}>{schedule.is_active ? "Ativa" : "Pausada"}</Badge></div>
                <p className="text-sm text-muted-foreground truncate">{schedule.message}</p>
                <p className="text-xs text-muted-foreground">{schedule.delivery_type === "lucky_popup" ? `Lucky Popup • ${schedule.popup_points || 1000} pontos` : "Notificação normal"} • {schedule.schedule_type === "fixed" ? `todos os dias às ${schedule.fixed_time?.slice(0, 5)} (Brasília)` : `${schedule.random_count || 4} vezes aleatórias entre ${schedule.random_start?.slice(0, 5)} e ${schedule.random_end?.slice(0, 5)}`} {schedule.next_run_at ? ` • próxima: ${new Date(`${schedule.next_run_at}Z`).toLocaleString("pt-BR")}` : ""}</p>
                <p className={`text-xs ${schedule.last_run_status === "failed" || schedule.last_run_push_warning ? "text-red-600" : "text-muted-foreground"}`}>
                  {schedule.last_run_at ? `Última execução: ${new Date(`${schedule.last_run_at}Z`).toLocaleString("pt-BR")} • ` : "Última execução: "}
                  {schedule.last_run_status === "success" && schedule.last_run_push_warning
                    ? (schedule.delivery_type === "lucky_popup" ? "campanha criada, mas o aviso push falhou" : "registro criado, mas o aviso push falhou")
                    : schedule.last_run_status === "success" ? "concluída" : schedule.last_run_status === "failed" ? "falhou" : schedule.last_run_status === "processing" ? "em andamento" : "ainda não executada"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" title={schedule.is_active ? "Pausar" : "Ativar"} onClick={() => updateSchedule(schedule, { is_active: !schedule.is_active })}><Power className={schedule.is_active ? "h-4 w-4 text-green-600" : "h-4 w-4"} /></Button><Button variant="ghost" size="icon" title="Excluir" onClick={() => deleteSchedule(schedule)}><Trash2 className="h-4 w-4 text-red-500" /></Button></div>
            </div>
          ))}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Notificações</CardTitle>
          <CardDescription>Últimas 100 notificações enviadas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : notifications?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma notificação enviada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Lida</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications?.map((notif: any) => (
                  <TableRow key={notif.id}>
                    <TableCell className="font-mono">{notif.id}</TableCell>
                    <TableCell>{notif.user_name || `#${notif.user_id}`}</TableCell>
                    <TableCell className="font-medium">{notif.title}</TableCell>
                    <TableCell className="max-w-xs truncate">{notif.message}</TableCell>
                    <TableCell>{getTypeBadge(notif.type)}</TableCell>
                    <TableCell>
                      {notif.is_read ? (
                        <Badge variant="default">Lida</Badge>
                      ) : (
                        <Badge variant="secondary">Não lida</Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(notif.created_at).toLocaleString('pt-BR')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
