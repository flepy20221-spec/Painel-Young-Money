import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldBan, ShieldCheck, Plus, Smartphone, Search, Eye, Users } from "lucide-react";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatDateTime(value: unknown) {
  if (!value) return "Sem registro";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Sem registro";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export default function Blacklist() {
  const { data: devices, isLoading, refetch: refetchDevices } = trpc.blacklist.list.useQuery({ limit: 1000 });
  const { data: bannedAccounts, isLoading: isBannedLoading, refetch: refetchBanned } =
    trpc.blacklist.bannedAccounts.useQuery({ limit: 1000 });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", reason: "" });
  const [unbanOpen, setUnbanOpen] = useState(false);
  const [unbanEmail, setUnbanEmail] = useState("");
  const [selectedBan, setSelectedBan] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const addToBlacklist = trpc.blacklist.add.useMutation({
    onSuccess: result => {
      toast.success(
        `Banimento concluído: ${result.matchedAccounts} conta(s), ${result.matchedDevices} dispositivo(s). Pontos preservados e fora do ranking.`
      );
      refetchDevices();
      refetchBanned();
      setOpen(false);
      setForm({ email: "", reason: "" });
    },
    onError: error => toast.error(`Erro: ${error.message}`),
  });

  const unbanByEmail = trpc.blacklist.unbanByEmail.useMutation({
    onSuccess: result => {
      toast.success(
        `Desbanimento concluído: ${result.matchedAccounts} conta(s) liberada(s), ${result.removedDevices} dispositivo(s) desbloqueado(s). Faça login novamente no app.`
      );
      refetchDevices();
      refetchBanned();
      setUnbanOpen(false);
      setUnbanEmail("");
    },
    onError: error => toast.error(`Erro: ${error.message}`),
  });

  const handleAdd = () => {
    const email = form.email.trim();
    const reason = form.reason.trim();
    if (!email || !reason) {
      toast.error("Informe o e-mail da conta e o motivo do banimento.");
      return;
    }
    addToBlacklist.mutate({ email, reason });
  };

  const handleUnban = () => {
    const email = unbanEmail.trim();
    if (!email) {
      toast.error("Informe o e-mail da conta que será desbanida.");
      return;
    }
    unbanByEmail.mutate({ email });
  };

  const banList = bannedAccounts || [];
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredBans = banList.filter((ban: any) => {
    if (!normalizedSearch) return true;
    const accountText = (ban.accounts || [])
      .map((account: any) => `${account.id} ${account.name} ${account.username} ${account.email}`)
      .join(" ");
    const deviceText = (ban.devices || []).map((device: any) => device.id).join(" ");
    return `${ban.email} ${ban.reason} ${accountText} ${deviceText}`.toLowerCase().includes(normalizedSearch);
  });
  const totalBannedAccounts = banList.reduce(
    (total: number, ban: any) => total + toNumber(ban.accountCount), 0
  );
  const totalBannedDevices = new Set(
    banList.flatMap((ban: any) => (ban.devices || []).map((device: any) => device.id))
  ).size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldBan className="h-8 w-8 text-red-500" />
          <div>
            <h1 className="text-3xl font-bold">Blacklist de Contas</h1>
            <p className="text-muted-foreground">Bloqueie ou libere contas pelo e-mail</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Banir Conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Banir conta por e-mail</DialogTitle>
                <DialogDescription>
                  Todas as contas e dispositivos vinculados ao e-mail serão bloqueados enquanto o banimento estiver ativo. Pontos, saldo e histórico são preservados; o acesso e a participação no ranking podem ser restaurados pelo desbanimento na Blacklist.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="blacklist-account-email">E-mail da Conta</Label>
                  <Input
                    id="blacklist-account-email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="Ex: usuario@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="blacklist-reason">Motivo do Banimento</Label>
                  <Textarea
                    id="blacklist-reason"
                    value={form.reason}
                    onChange={e => setForm({ ...form, reason: e.target.value })}
                    placeholder="Descreva o motivo do banimento"
                  />
                </div>
                <Button onClick={handleAdd} disabled={addToBlacklist.isPending} className="w-full">
                  {addToBlacklist.isPending ? "Banindo..." : "Banir conta"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={unbanOpen} onOpenChange={setUnbanOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Desbanir por e-mail
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Desbanir conta por e-mail</DialogTitle>
                <DialogDescription>
                  O banimento desse e-mail será removido. Dispositivos compartilhados com outra conta ainda banida continuarão bloqueados. Pontos, saldo, histórico e saques não serão alterados; a participação anterior no ranking será restaurada quando disponível. Como a sessão foi invalidada no banimento, a pessoa precisará entrar novamente no app.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="unban-account-email">E-mail da conta</Label>
                  <Input
                    id="unban-account-email"
                    type="email"
                    autoComplete="email"
                    value={unbanEmail}
                    onChange={e => setUnbanEmail(e.target.value)}
                    placeholder="Ex: usuario@email.com"
                  />
                </div>
                <Button
                  onClick={handleUnban}
                  disabled={unbanByEmail.isPending}
                  className="w-full"
                >
                  {unbanByEmail.isPending ? "Desbanindo..." : "Desbanir conta por e-mail"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">E-mails banidos</p>
              <p className="mt-1 text-2xl font-bold">{numberFormatter.format(banList.length)}</p>
              <p className="text-xs text-muted-foreground">Bloqueios ativos na Blacklist</p>
            </div>
            <ShieldBan className="h-9 w-9 text-red-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Contas afetadas</p>
              <p className="mt-1 text-2xl font-bold">{numberFormatter.format(totalBannedAccounts)}</p>
              <p className="text-xs text-muted-foreground">Pontos e histórico preservados</p>
            </div>
            <Users className="h-9 w-9 text-amber-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Dispositivos vinculados</p>
              <p className="mt-1 text-2xl font-bold">{numberFormatter.format(totalBannedDevices)}</p>
              <p className="text-xs text-muted-foreground">Inclui vínculos das contas banidas</p>
            </div>
            <Smartphone className="h-9 w-9 text-blue-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldBan className="h-5 w-5 text-red-500" />
              Contas banidas
            </CardTitle>
            <CardDescription>
              Lista por e-mail com contas relacionadas, dispositivos, motivo e data. O banimento não apaga saldo, pontos ou histórico.
            </CardDescription>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar e-mail, nome, ID ou motivo"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isBannedLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredBans.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              {banList.length === 0 ? "Nenhuma conta banida encontrada." : "Nenhum resultado para essa busca."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail bloqueado</TableHead>
                    <TableHead>Contas afetadas</TableHead>
                    <TableHead>Dispositivos</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data do banimento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBans.map((ban: any) => (
                    <TableRow key={ban.email}>
                      <TableCell className="min-w-[220px]">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{ban.email}</span>
                          <Badge variant="destructive" className="w-fit">Banido</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <div className="font-medium">{numberFormatter.format(ban.accountCount || 0)} conta(s)</div>
                        <div className="max-w-[260px] truncate text-xs text-muted-foreground" title={(ban.accounts || []).map((account: any) => `#${account.id} ${account.name || account.username || "Sem nome"}`).join(", ")}>
                          {(ban.accounts || []).slice(0, 2).map((account: any) => `#${account.id} ${account.name || account.username || "Sem nome"}`).join(" · ") || "Sem conta vinculada"}
                          {(ban.accounts || []).length > 2 ? ` · +${ban.accounts.length - 2}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>{numberFormatter.format(ban.deviceCount || 0)}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={ban.reason}>{ban.reason || "Sem motivo informado"}</TableCell>
                      <TableCell className="min-w-[140px]">{formatDateTime(ban.bannedAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setSelectedBan(ban); setDetailsOpen(true); }}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            Detalhes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setUnbanEmail(ban.email); setUnbanOpen(true); }}
                          >
                            <ShieldCheck className="mr-1 h-4 w-4" />
                            Desbanir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Dispositivos bloqueados
          </CardTitle>
          <CardDescription>
            {numberFormatter.format(devices?.length || 0)} IDs de dispositivo na lista técnica. Vínculos compartilhados permanecem bloqueados enquanto outro e-mail associado continuar banido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : devices?.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum dispositivo na lista de bloqueio</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Data do Banimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices?.map((device: any) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-mono">{device.id}</TableCell>
                    <TableCell className="font-mono text-sm">{device.device_id}</TableCell>
                    <TableCell className="max-w-xs truncate">{device.reason}</TableCell>
                    <TableCell>{new Date(device.created_at).toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do banimento</DialogTitle>
            <DialogDescription>
              {selectedBan?.email || "Conta"} · Banido em {formatDateTime(selectedBan?.bannedAt)}
            </DialogDescription>
          </DialogHeader>
          {selectedBan && (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Contas relacionadas</p>
                    <p className="mt-1 text-xl font-semibold">{numberFormatter.format(selectedBan.accountCount || 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Dispositivos vinculados</p>
                    <p className="mt-1 text-xl font-semibold">{numberFormatter.format(selectedBan.deviceCount || 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Motivo registrado</p>
                    <p className="mt-1 break-words font-medium">{selectedBan.reason || "Sem motivo informado"}</p>
                  </CardContent>
                </Card>
              </div>

              <section className="space-y-3">
                <h3 className="font-semibold">Contas afetadas</h3>
                {(selectedBan.accounts || []).length === 0 ? (
                  <p className="rounded-md border p-4 text-sm text-muted-foreground">Não há conta ativa atualmente vinculada a este e-mail.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Nome / usuário</TableHead>
                          <TableHead>Pontos</TableHead>
                          <TableHead>Saldo</TableHead>
                          <TableHead>Cadastro</TableHead>
                          <TableHead>Device ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedBan.accounts.map((account: any) => (
                          <TableRow key={account.id}>
                            <TableCell className="font-mono">#{account.id}</TableCell>
                            <TableCell className="min-w-[180px]">
                              <div className="font-medium">{account.name || account.username || "Sem nome"}</div>
                              {account.name && account.username && <div className="text-xs text-muted-foreground">@{account.username}</div>}
                              <div className="text-xs text-muted-foreground">{account.email}</div>
                            </TableCell>
                            <TableCell>{numberFormatter.format(toNumber(account.points))}</TableCell>
                            <TableCell>{currencyFormatter.format(toNumber(account.balance))}</TableCell>
                            <TableCell className="min-w-[130px]">{formatDateTime(account.createdAt)}</TableCell>
                            <TableCell className="max-w-[180px] break-all font-mono text-xs">{account.deviceId || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="font-semibold">Dispositivos associados</h3>
                {(selectedBan.devices || []).length === 0 ? (
                  <p className="rounded-md border p-4 text-sm text-muted-foreground">Nenhum dispositivo vinculado encontrado.</p>
                ) : (
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                    {selectedBan.devices.map((device: any) => (
                      <div key={device.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="break-all font-mono">{device.id}</span>
                        <Badge variant={device.active ? "secondary" : "outline"}>
                          {device.active ? "Ativo" : "Vínculo inativo"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setUnbanEmail(selectedBan.email);
                    setDetailsOpen(false);
                    setUnbanOpen(true);
                  }}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Desbanir por e-mail
                </Button>
                <Button variant="secondary" onClick={() => setDetailsOpen(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
