// Classifica o corpo recebido no webhook do Asaas.
//   invalid : não é um evento (sem `event`)  -> 400
//   ignore  : evento válido sem `payment` (ex.: SUBSCRIPTION_*) -> 200, só
//             registra e ignora. Responder erro faria o Asaas repetir e,
//             depois de várias falhas, PAUSAR a fila de webhooks.
//   payment : evento de cobrança, segue o fluxo normal.
export type WebhookKind =
  | { kind: 'invalid' }
  | { kind: 'ignore'; event: string; eventId: string }
  | { kind: 'payment'; event: string }

export function classifyWebhookPayload(payload: unknown): WebhookKind {
  if (!payload || typeof payload !== 'object') return { kind: 'invalid' }
  const p = payload as { event?: unknown; id?: unknown; payment?: unknown; subscription?: { id?: unknown } }
  if (typeof p.event !== 'string' || p.event.length === 0) return { kind: 'invalid' }

  if (!p.payment || typeof p.payment !== 'object') {
    const subId = typeof p.subscription?.id === 'string' ? p.subscription.id : 'sem-id'
    const eventId = typeof p.id === 'string' && p.id ? p.id : `${p.event}:${subId}:${Date.now()}`
    return { kind: 'ignore', event: p.event, eventId }
  }
  return { kind: 'payment', event: p.event }
}
