import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Coins, Wallet, User, Mail, Phone, Calendar, History, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

export default function UserDetail() {
  const [, params] = useRoute("/users/:id");
  const [, setLocation] = useLocation();
  const userId = parseInt(params?.id || "0");

  const [showEditPoints, setShowEditPoints] = useState(false);
  const [showEditBalance, setShowEditBalance] = useState(false);
  const [newPoints, setNewPoints] = useState("");
  const [newBalance, setNewBalance] = useState("");
  const [selectedHistoryDate, setSelectedHistoryDate] = useState("");

  const { data: user, isLoading, refetch } = trpc.appUsers.getById.useQuery({ id: userId });
  const { data: transactions } = trpc.pointTransactions.list.useQuery({ userId, limit: 50 });
  const { data: pointsHistoryResponse } = trpc.pointTransactions.userHistory.useQuery({
    userId,
    limit: 5000,
    selectedDate: selectedHistoryDate || undefined,
  });

  const pointsHistory = pointsHistoryResponse?.entries ?? [];
  const totalPointsEarned = pointsHistoryResponse?.totalPointsEarned ?? 0;
  const totalHistoryEntries = pointsHistoryResponse?.totalEntries ?? pointsHistory.length;
  const totalHistoryEntriesAll = pointsHistoryResponse?.totalEntriesAll ?? totalHistoryEntries;
  const totalHistoryDays = pointsHistoryResponse?.totalDays ?? 0;
  const dailyTotalsByDate = pointsHistoryResponse?.dailyTotalsByDate ?? {};
  const dailySummaries = pointsHistoryResponse?.dailySummaries ?? [];
  const activeHistoryDate = pointsHistoryResponse?.selectedDate ?? "";
  const activeDayTotal = activeHistoryDate ? (dailyTotalsByDate[activeHistoryDate] ?? 0) : 0;

  const updatePointsMutation = trpc.appUsers.updatePoints.useMutation({
    onSuccess: () => {
      toast.success("Pontos atualizados com sucesso");
      setShowEditPoints(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const updateBalanceMutation = trpc.appUsers.updateBalance.useMutation({
    onSuccess: () => {
      toast.success("Saldo atualizado com sucesso");
      setShowEditBalance(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const handleUpdatePoints = () => {
    const points = parseInt(newPoints);
    if (isNaN(points)) {
      toast.error("Quantidade inválida");
      return;
    }
    updatePointsMutation.mutate({ id: userId, points });
  };

  const handleUpdateBalance = () => {
    const balance = parseFloat(newBalance);
    if (isNaN(balance)) {
      toast.error("Valor inválido");
      return;
    }
    updateBalanceMutation.mutate({ id: userId, balance });
  };

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(num || 0);
  };

  const formatNumber = (value: number | string) => {
    const num = typeof value === 'string' ? parseInt(value) : value;
    return new Intl.NumberFormat("pt-BR").format(num || 0);
  };

  const HISTORY_TIME_ZONE = "America/Sao_Paulo";

  const getBrazilDateKey = (date: string | Date) => {
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "";

    return new Intl.DateTimeFormat("en-CA", {
      timeZone: HISTORY_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(parsedDate);
  };

  const formatDate = (date: string | Date) => {
    if (!date) return "-";

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "-";

    return parsedDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: HISTORY_TIME_ZONE,
    });
  };

  const formatDateOnly = (date: string | Date) => {
    if (!date) return "-";

    if (typeof date === "string") {
      const normalizedDate = date.trim();
      const dateOnlyMatch = normalizedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);

      if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        return `${day}/${month}/${year}`;
      }
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "-";

    return parsedDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: HISTORY_TIME_ZONE,
    });
  };

  const getHistoryDateKey = (item: any) => {
    if (item?.history_date) return item.history_date;
    if (!item?.created_at) return "";

    return getBrazilDateKey(item.created_at);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setLocation("/users")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Usuário não encontrado
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setLocation("/users")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{user.name || "Usuário"}</h1>
          <p className="text-muted-foreground">ID #{user.id}</p>
        </div>
      </div>

      {/* User Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Pontos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(user.points)}</div>
            <Button 
              variant="link" 
              className="p-0 h-auto text-sm"
              onClick={() => {
                setNewPoints(String(user.points || 0));
                setShowEditPoints(true);
              }}
            >
              Editar pontos
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Saldo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(user.balance)}</div>
            <Button 
              variant="link" 
              className="p-0 h-auto text-sm"
              onClick={() => {
                setNewBalance(String(user.balance || 0));
                setShowEditBalance(true);
              }}
            >
              Editar saldo
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium truncate">{user.email || "N/A"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Último Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">{formatDate(user.last_login_at)}</div>
          </CardContent>
        </Card>
      </div>

      {/* User Details */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Nome</Label>
              <p className="font-medium">{user.name || "N/A"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Username</Label>
              <p className="font-medium">{user.username ? `@${user.username}` : "N/A"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-medium">{user.email || "N/A"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Device ID</Label>
              <p className="font-mono text-sm">{user.device_id || "N/A"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Código de Convite</Label>
              <p className="font-mono">{user.invite_code || "N/A"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Convidado Por</Label>
              <p className="font-mono">{user.invited_by || "N/A"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Pontos Diários</Label>
              <p className="font-medium">{formatNumber(user.daily_points)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Impressões Monetag</Label>
              <p className="font-medium">{formatNumber(user.monetag_impressions)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Transactions and Points History */}
      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Histórico de Pontos
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Transações
          </TabsTrigger>
        </TabsList>

        {/* Points History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Histórico de Pontos
              </CardTitle>
              <CardDescription>
                {selectedHistoryDate
                  ? `Exibindo as movimentações registradas em ${formatDateOnly(selectedHistoryDate)} para este usuário`
                  : "Exibindo todas as movimentações registradas em todos os dias para este usuário"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">Total de pontos feitos na conta</p>
                  <p className="text-2xl font-bold text-green-600">+{formatNumber(totalPointsEarned)}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">
                    {selectedHistoryDate ? "Movimentações no dia selecionado" : "Movimentações registradas na conta"}
                  </p>
                  <p className="text-2xl font-bold">{formatNumber(selectedHistoryDate ? totalHistoryEntries : totalHistoryEntriesAll)}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">
                    {selectedHistoryDate ? "Total de pontos do dia selecionado" : "Dias com movimentação"}
                  </p>
                  <p className={`text-2xl font-bold ${selectedHistoryDate ? 'text-blue-600' : ''}`}>
                    {selectedHistoryDate ? `+${formatNumber(activeDayTotal)}` : formatNumber(totalHistoryDays)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-background p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="space-y-2">
                    <Label htmlFor="history-date-filter">Filtrar por dia</Label>
                    <Input
                      id="history-date-filter"
                      type="date"
                      value={selectedHistoryDate}
                      onChange={(e) => setSelectedHistoryDate(e.target.value)}
                      className="w-full md:w-[240px]"
                    />
                  </div>

                  <div className="flex flex-col gap-2 text-sm text-muted-foreground md:items-end">
                    <span>
                      {selectedHistoryDate
                        ? `Visualizando ${formatNumber(totalHistoryEntries)} movimentações de ${formatDateOnly(selectedHistoryDate)}`
                        : `Visualizando ${formatNumber(totalHistoryEntriesAll)} movimentações distribuídas em ${formatNumber(totalHistoryDays)} dias`}
                    </span>
                    {selectedHistoryDate ? (
                      <Button variant="outline" onClick={() => setSelectedHistoryDate("")}>Limpar filtro</Button>
                    ) : dailySummaries.length > 0 ? (
                      <span>Último dia com registro: {formatDateOnly(dailySummaries[0].date)}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              {pointsHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {selectedHistoryDate
                    ? `Nenhum histórico de pontos encontrado para ${formatDateOnly(selectedHistoryDate)}`
                    : "Nenhum histórico de pontos encontrado para este usuário"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Total do Dia</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Pontos</TableHead>
                        <TableHead>Saldo Anterior</TableHead>
                        <TableHead>Saldo Após</TableHead>
                        <TableHead>Fonte</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Data e hora</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pointsHistory.map((item: any) => {
                        const historyDateKey = getHistoryDateKey(item);
                        const totalPointsOnDate = dailyTotalsByDate[historyDateKey] ?? 0;
                        const isPositive = item.type === 'credit' || item.type === 'add' || item.points > 0;

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">#{item.id}</TableCell>
                            <TableCell className="font-bold text-blue-600">+{formatNumber(totalPointsOnDate)}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={isPositive ? 'default' : 'destructive'}
                                className="flex items-center gap-1 w-fit"
                              >
                                {isPositive ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : (
                                  <TrendingDown className="w-3 h-3" />
                                )}
                                {item.type || (item.points > 0 ? 'credit' : 'debit')}
                              </Badge>
                            </TableCell>
                            <TableCell className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                              {isPositive ? '+' : ''}{formatNumber(item.points || item.amount || 0)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.balance_before !== undefined ? formatNumber(item.balance_before) : '-'}
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.balance_after !== undefined ? formatNumber(item.balance_after) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.source || item.action || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={item.description || item.reason || '-'}>
                              {item.description || item.reason || '-'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{formatDate(item.created_at)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Transações</CardTitle>
              <CardDescription>Últimas transações de pontos do usuário</CardDescription>
            </CardHeader>
            <CardContent>
              {!transactions || transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma transação encontrada
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx: any) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono">#{tx.id}</TableCell>
                        <TableCell>
                          <Badge variant={tx.type === 'credit' ? 'default' : 'destructive'}>
                            {tx.type === 'credit' ? '+' : '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{formatNumber(tx.points || tx.amount)}</TableCell>
                        <TableCell>{tx.description || tx.source || "N/A"}</TableCell>
                        <TableCell>{formatDate(tx.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Points Dialog */}
      <Dialog open={showEditPoints} onOpenChange={setShowEditPoints}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pontos</DialogTitle>
            <DialogDescription>
              Defina a nova quantidade de pontos para este usuário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nova quantidade de pontos</Label>
              <Input
                type="number"
                value={newPoints}
                onChange={(e) => setNewPoints(e.target.value)}
                placeholder="Ex: 1000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPoints(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdatePoints} disabled={updatePointsMutation.isPending}>
              {updatePointsMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Balance Dialog */}
      <Dialog open={showEditBalance} onOpenChange={setShowEditBalance}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Saldo</DialogTitle>
            <DialogDescription>
              Defina o novo saldo para este usuário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Novo saldo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                placeholder="Ex: 100.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditBalance(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateBalance} disabled={updateBalanceMutation.isPending}>
              {updateBalanceMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
