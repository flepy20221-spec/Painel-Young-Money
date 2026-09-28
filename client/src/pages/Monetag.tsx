import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Activity, DollarSign, Eye, MousePointerClick, Webhook } from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const integerFormatter = new Intl.NumberFormat("pt-BR");

function formatCurrency(value: unknown) {
  const numericValue = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(numericValue) ? numericValue : 0);
}

function formatDate(value: unknown) {
  if (!value) return "-";

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR");
}

function getEventLabel(type: string) {
  if (type === "click") return "Clique";
  if (type === "impression") return "Impressão";
  return type || "Evento";
}

export default function Monetag() {
  const { data: events, isLoading: loadingEvents } = trpc.monetag.events.useQuery({ limit: 100 });
  const { data: postbacks, isLoading: loadingPostbacks } = trpc.monetag.postbacks.useQuery({ limit: 100 });

  const monetagEvents = Array.isArray(events) ? events : [];
  const monetagPostbacks = Array.isArray(postbacks) ? postbacks : [];

  const totalRevenue = monetagEvents.reduce((acc: number, event: any) => {
    const value = Number(event?.value ?? 0);
    return acc + (Number.isFinite(value) ? value : 0);
  }, 0);

  const clickCount = monetagEvents.filter((event: any) => event?.event_type === "click").length;
  const impressionCount = monetagEvents.filter((event: any) => event?.event_type === "impression").length;
  const paidEventsCount = monetagEvents.filter((event: any) => Number(event?.value ?? 0) > 0).length;
  const processedPostbacks = monetagPostbacks.filter((postback: any) => postback?.status === "processed").length;

  const summaryCards = [
    {
      title: "Receita registrada",
      description: "Soma dos ganhos capturados nos eventos exibidos",
      value: formatCurrency(totalRevenue),
      accent: "text-emerald-400",
    },
    {
      title: "Cliques registrados",
      description: "Eventos com potencial de monetização direta",
      value: integerFormatter.format(clickCount),
      accent: "text-blue-400",
    },
    {
      title: "Impressões registradas",
      description: "Visualizações contabilizadas pela Monetag",
      value: integerFormatter.format(impressionCount),
      accent: "text-slate-200",
    },
    {
      title: "Eventos com ganho",
      description: "Ocorrências que já possuem valor informado",
      value: integerFormatter.format(paidEventsCount),
      accent: "text-amber-300",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border/60 bg-gradient-to-r from-slate-950 via-slate-950 to-slate-900/80 px-6 py-7 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.85)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              Monetização e postbacks
            </div>
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 p-3 text-emerald-400 shadow-inner shadow-emerald-500/10">
                <DollarSign className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Monetag</h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Acompanhe eventos, postbacks e a receita gerada com uma visualização mais clara para operação administrativa.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.title}
                className="min-w-[180px] rounded-2xl border border-border/60 bg-background/60 px-4 py-4 backdrop-blur-sm"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{card.title}</p>
                <p className={`mt-3 text-2xl font-semibold ${card.accent}`}>{card.value}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Tabs defaultValue="events" className="space-y-6">
        <TabsList className="h-auto rounded-2xl border border-border/60 bg-card/60 p-1">
          <TabsTrigger value="events" className="flex items-center gap-2 rounded-xl px-4 py-2.5">
            <Activity className="h-4 w-4" />
            Eventos
            <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
              {integerFormatter.format(monetagEvents.length)}
            </span>
          </TabsTrigger>
          <TabsTrigger value="postbacks" className="flex items-center gap-2 rounded-xl px-4 py-2.5">
            <Webhook className="h-4 w-4" />
            Postbacks
            <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
              {integerFormatter.format(monetagPostbacks.length)}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription>Total de receita</CardDescription>
                <CardTitle className="text-2xl text-emerald-400">{formatCurrency(totalRevenue)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription>Distribuição de eventos</CardDescription>
                <CardTitle className="text-2xl text-foreground">
                  {integerFormatter.format(clickCount)} cliques / {integerFormatter.format(impressionCount)} impressões
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription>Eventos remunerados</CardDescription>
                <CardTitle className="text-2xl text-amber-300">{integerFormatter.format(paidEventsCount)}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-border/60 bg-card/80 shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle>Eventos Monetag</CardTitle>
              <CardDescription>
                Histórico operacional com usuário, tipo de evento, ganho gerado e data de registro.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEvents ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              ) : monetagEvents.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhum evento registrado.</p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="w-[90px]">ID</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Evento</TableHead>
                        <TableHead>Ganho</TableHead>
                        <TableHead className="text-right">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monetagEvents.map((event: any) => {
                        const value = Number(event?.value ?? 0);
                        const hasRevenue = Number.isFinite(value) && value > 0;

                        return (
                          <TableRow key={event.id} className="border-border/60">
                            <TableCell className="font-mono text-xs text-muted-foreground">#{event.id}</TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <p className="font-medium text-foreground">{event.user_name || `Usuário #${event.user_id}`}</p>
                                <p className="text-xs text-muted-foreground">{event.user_email || "E-mail não informado"}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  event.event_type === "click"
                                    ? "border-blue-500/20 bg-blue-500/10 text-blue-300 hover:bg-blue-500/10"
                                    : "border-slate-400/20 bg-slate-500/10 text-slate-200 hover:bg-slate-500/10"
                                }
                                variant="outline"
                              >
                                {event.event_type === "click" ? (
                                  <MousePointerClick className="mr-1.5 h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                {getEventLabel(event.event_type)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className={hasRevenue ? "font-semibold text-emerald-400" : "text-sm text-muted-foreground"}>
                                {formatCurrency(value)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">{formatDate(event.created_at)}</TableCell>
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

        <TabsContent value="postbacks" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription>Postbacks listados</CardDescription>
                <CardTitle className="text-2xl text-foreground">{integerFormatter.format(monetagPostbacks.length)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription>Processados</CardDescription>
                <CardTitle className="text-2xl text-emerald-400">{integerFormatter.format(processedPostbacks)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription>Pendentes ou recebidos</CardDescription>
                <CardTitle className="text-2xl text-amber-300">
                  {integerFormatter.format(Math.max(monetagPostbacks.length - processedPostbacks, 0))}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-border/60 bg-card/80 shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle>Postbacks Monetag</CardTitle>
              <CardDescription>
                Registro dos callbacks recebidos, com indicação de status e payload resumido para auditoria rápida.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPostbacks ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              ) : monetagPostbacks.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhum postback registrado.</p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="w-[90px]">ID</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Payload</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monetagPostbacks.map((postback: any) => (
                        <TableRow key={postback.id} className="border-border/60">
                          <TableCell className="font-mono text-xs text-muted-foreground">#{postback.id}</TableCell>
                          <TableCell className="font-medium text-foreground">{postback.type || "-"}</TableCell>
                          <TableCell className="max-w-[360px] truncate font-mono text-xs text-muted-foreground">
                            {postback.payload ? JSON.stringify(postback.payload) : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                postback.status === "processed"
                                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10"
                                  : "border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/10"
                              }
                              variant="outline"
                            >
                              {postback.status === "processed" ? "Processado" : postback.status || "Recebido"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{formatDate(postback.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
