import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const pointsFormatter = new Intl.NumberFormat("pt-BR");
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function Ranking() {
  const utils = trpc.useUtils();
  const { data: ranking, isLoading } = trpc.ranking.list.useQuery({ limit: 10000 });

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: number; name: string; dailyPoints: number } | null>(null);
  const [newPoints, setNewPoints] = useState("");
  const [operation, setOperation] = useState<"set" | "add" | "subtract">("set");
  const [searchEmail, setSearchEmail] = useState("");

  const updateDailyPointsMutation = trpc.ranking.updateDailyPoints.useMutation({
    onSuccess: () => {
      toast.success("Pontos diários atualizados com sucesso!");
      utils.ranking.list.invalidate();
      setEditDialogOpen(false);
      setSelectedUser(null);
      setNewPoints("");
      setOperation("set");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar pontos diários.");
    },
  });

  const getPrizeAmount = (position: number) => {
    if (position === 1) return 10;
    if (position === 2) return 5;
    if (position >= 3 && position <= 10) return 1;
    return 0;
  };

  const handleEditClick = (user: { id: number; name: string; daily_points: number }) => {
    setSelectedUser({ id: user.id, name: user.name, dailyPoints: user.daily_points || 0 });
    setNewPoints(String(user.daily_points || 0));
    setOperation("set");
    setEditDialogOpen(true);
  };

  const handleSavePoints = () => {
    if (!selectedUser || !newPoints) return;

    const pointsValue = parseInt(newPoints, 10);
    if (isNaN(pointsValue) || pointsValue < 0) {
      toast.error("Digite um valor válido para os pontos.");
      return;
    }

    updateDailyPointsMutation.mutate({
      id: selectedUser.id,
      points: pointsValue,
      operation,
    });
  };

  const filteredRanking = useMemo(() => {
    if (!ranking) return [];

    return ranking.filter(
      (user) =>
        searchEmail.trim() === "" ||
        (user.email && user.email.toLowerCase().includes(searchEmail.trim().toLowerCase()))
    );
  }, [ranking, searchEmail]);

  const podiumUsers = ranking?.slice(0, 3) || [];

  const podiumStyles = [
    {
      accent: "border-[#1f6feb]/28 bg-[linear-gradient(180deg,rgba(31,111,235,0.16),rgba(17,22,31,0.96))]",
      valueTone: "text-[#8ab4ff]",
      labelTone: "text-[#dbe7ff]",
    },
    {
      accent: "border-white/10 bg-[#11161f]",
      valueTone: "text-white",
      labelTone: "text-white",
    },
    {
      accent: "border-white/10 bg-[#11161f]",
      valueTone: "text-white",
      labelTone: "text-white",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Ranking diário</h1>
        <p className="text-sm text-[#99a5b8]">
          Gestão da classificação diária dos usuários com pontuação e premiação exibidas de forma clara.
        </p>
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        {podiumUsers.map((user, index) => {
          const position = index + 1;
          const prize = getPrizeAmount(position);
          const style = podiumStyles[index] || podiumStyles[1];

          return (
            <Card
              key={user.id}
              className={`border ${style.accent} shadow-[0_16px_40px_rgba(0,0,0,0.24)]`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#99a5b8]">
                        {position}º lugar
                      </span>
                      <p className={`text-lg font-semibold ${style.labelTone}`}>
                        {user.name || "Usuário sem nome"}
                      </p>
                      <p className="text-sm text-[#99a5b8]">{user.email || "E-mail não informado"}</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#7f8a9d]">Pontuação diária</p>
                      <p className={`mt-2 text-3xl font-semibold ${style.valueTone}`}>
                        {pointsFormatter.format(user.daily_points || 0)}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[#c8d1df] hover:bg-white/[0.06] hover:text-white"
                    onClick={() => handleEditClick(user)}
                  >
                    Editar
                  </Button>
                </div>

                <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/6 bg-[#0c1017] px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#7f8a9d]">Premiação</p>
                    <p className="mt-1 text-lg font-semibold text-white">{currencyFormatter.format(prize)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#7f8a9d]">Posição</p>
                    <p className="mt-1 text-lg font-semibold text-white">#{position}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="border-white/8 bg-[#11161f] shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
        <CardHeader className="border-b border-white/6 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-xl text-white">Ranking completo</CardTitle>
              <CardDescription className="text-[#99a5b8]">
                Lista operacional com posição, pontuação diária e premiação por faixa de colocação.
              </CardDescription>
            </div>

            <div className="w-full lg:max-w-sm">
              <Input
                placeholder="Pesquisar por e-mail..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="h-11 border-white/8 bg-[#0c1017] text-white placeholder:text-[#667085]"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-[#99a5b8]">Carregando ranking...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/6 hover:bg-transparent">
                    <TableHead className="w-24 text-[#99a5b8]">Posição</TableHead>
                    <TableHead className="text-[#99a5b8]">Nome</TableHead>
                    <TableHead className="text-[#99a5b8]">E-mail</TableHead>
                    <TableHead className="text-right text-[#99a5b8]">Pontos diários</TableHead>
                    <TableHead className="text-right text-[#99a5b8]">Prêmio</TableHead>
                    <TableHead className="w-32 text-right text-[#99a5b8]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRanking.length === 0 ? (
                    <TableRow className="border-white/6 hover:bg-transparent">
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-[#99a5b8]">
                        Nenhum usuário encontrado no ranking.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRanking.map((user, index) => {
                      const position = index + 1;
                      const prize = getPrizeAmount(position);
                      const highlightRow = position <= 3;

                      return (
                        <TableRow
                          key={user.id}
                          className={`border-white/6 ${highlightRow ? "bg-white/[0.02]" : "bg-transparent"} hover:bg-white/[0.03]`}
                        >
                          <TableCell>
                            <span className="inline-flex min-w-12 items-center justify-center rounded-full border border-white/10 bg-[#0c1017] px-3 py-1 text-sm font-semibold text-white">
                              {position}º
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-white">{user.name || "Sem nome"}</TableCell>
                          <TableCell className="text-[#99a5b8]">{user.email || "-"}</TableCell>
                          <TableCell className="text-right text-lg font-semibold text-white">
                            {pointsFormatter.format(user.daily_points || 0)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-[#8ab4ff]">
                            {prize > 0 ? currencyFormatter.format(prize) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[#c8d1df] hover:bg-white/[0.06] hover:text-white"
                              onClick={() => handleEditClick(user)}
                            >
                              Editar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="border-white/10 bg-[#11161f] text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar pontos diários</DialogTitle>
            <DialogDescription className="text-[#99a5b8]">
              Altere a pontuação diária de <strong className="text-white">{selectedUser?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-[#c8d1df]">Pontos atuais</Label>
              <p className="text-lg font-semibold text-white">
                {pointsFormatter.format(selectedUser?.dailyPoints || 0)} pontos
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="operation" className="text-[#c8d1df]">Operação</Label>
              <Select value={operation} onValueChange={(value) => setOperation(value as "set" | "add" | "subtract")}>
                <SelectTrigger className="border-white/10 bg-[#0c1017] text-white">
                  <SelectValue placeholder="Selecione a operação" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#11161f] text-white">
                  <SelectItem value="set">Definir valor</SelectItem>
                  <SelectItem value="add">Adicionar</SelectItem>
                  <SelectItem value="subtract">Subtrair</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="points" className="text-[#c8d1df]">
                {operation === "set" ? "Novo valor" : operation === "add" ? "Valor a adicionar" : "Valor a subtrair"}
              </Label>
              <Input
                id="points"
                type="number"
                min="0"
                value={newPoints}
                onChange={(e) => setNewPoints(e.target.value)}
                placeholder="Digite o valor"
                className="border-white/10 bg-[#0c1017] text-white placeholder:text-[#667085]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="border-white/10 bg-transparent text-white hover:bg-white/[0.04]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSavePoints}
              disabled={updateDailyPointsMutation.isPending}
              className="bg-[#1a73e8] text-white hover:bg-[#1765cc]"
            >
              {updateDailyPointsMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
