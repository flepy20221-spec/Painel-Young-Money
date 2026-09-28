/**
 * Discord — Notificação de pagamentos pendentes
 * Dispara um embed no canal sempre que surgir saque com status "pending".
 * Configure a URL via variável de ambiente DISCORD_WEBHOOK_URL (Railway > Variables).
 */

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL?.trim();

let initialized = false;
let knownPendingIds = new Set<number>();

async function sendEmbed(payload: unknown): Promise<void> {
  if (!WEBHOOK_URL) return;
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.warn(`[Discord] Webhook respondeu HTTP ${res.status}`);
  }
}

/**
 * Chamado sempre que o painel carrega a lista de pendentes.
 * Na 1ª carga: envia um resumo (sem spammar um embed por item).
 * Depois: envia 1 embed por NOVO pendente detectado (na mesma hora que aparece no painel).
 */
export async function notifyNewPendingWithdrawals(withdrawals: any[]): Promise<void> {
  try {
    const pending = (withdrawals || []).filter(
      (w: any) => String(w?.status ?? "").toLowerCase() === "pending"
    );
    const currentIds = new Set<number>(pending.map((w: any) => Number(w.id)));

    if (!initialized) {
      initialized = true;
      knownPendingIds = currentIds;
      if (pending.length > 0) {
        const total = pending.reduce(
          (acc: number, w: any) => acc + (Number(w.amount) || 0),
          0
        );
        await sendEmbed({
          username: "YoungMoney • Pagamentos",
          embeds: [
            {
              title: "⏳ Pagamentos pendentes aguardando aprovação",
              description: `Existem **${pending.length}** saque(s) pendente(s) no painel agora.`,
              color: 15105570,
              fields: [
                { name: "Quantidade", value: String(pending.length), inline: true },
                {
                  name: "Valor total",
                  value: `R$ ${total.toFixed(2).replace(".", ",")}`,
                  inline: true,
                },
              ],
              timestamp: new Date().toISOString(),
              footer: { text: "Painel Administrativo • YoungMoney" },
            },
          ],
        });
      }
      return;
    }

    const fresh = pending.filter((w: any) => !knownPendingIds.has(Number(w.id)));
    knownPendingIds = currentIds;

    for (const w of fresh.slice(0, 5)) {
      const amount = Number(w.amount) || 0;
      const method = String(w.payment_method ?? "pix").toUpperCase();
      await sendEmbed({
        username: "YoungMoney • Pagamentos",
        embeds: [
          {
            title: "⏳ Novo pagamento PENDENTE",
            description: "Um novo saque acabou de aparecer no painel aguardando aprovação.",
            color: 15158332,
            fields: [
              {
                name: "Usuário",
                value: `${w.user_name ?? w.name ?? "N/A"} (ID ${w.user_id ?? "?"})`,
                inline: true,
              },
              {
                name: "Valor",
                value: `R$ ${amount.toFixed(2).replace(".", ",")}`,
                inline: true,
              },
              { name: "Método", value: method, inline: true },
              {
                name: "Destino",
                value: String(w.pix_key ?? w.crypto_address ?? "N/A"),
                inline: false,
              },
              { name: "Saque ID", value: `#${w.id}`, inline: true },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: "Painel Administrativo • YoungMoney" },
          },
        ],
      });
    }
  } catch (err) {
    console.warn("[Discord] Falha ao notificar pendentes:", err);
  }
}
