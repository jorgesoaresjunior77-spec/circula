// Modo de rateio da assinatura de comunidade.
//   off (PADRÃO desde 2026-12): sem split. Todo o valor cai na conta da plataforma,
//        que é da própria nutricionista; não há repasse 90/10.
//   native: split nativo do Asaas para a carteira da dona da comunidade. Só liga
//        com COMMUNITY_SPLIT_MODE=native explícito (ex.: uma segunda profissional).
export type CommunitySplitMode = 'native' | 'off'

export function resolveCommunitySplitMode(raw: string | undefined | null): CommunitySplitMode {
  return (raw ?? '').trim().toLowerCase() === 'native' ? 'native' : 'off'
}

// A assinatura foi criada com o split desligado (ver offSplitSnapshot)? Vale
// só para snapshots gravados explicitamente assim: ledger, sem carteira e com
// parcela da profissional igual a ZERO (null = assinatura antiga, não conta).
// Nesse caso o webhook NÃO cria repasse (sale/reversal): o valor é todo da
// plataforma. O código de split/repasse continua no sistema, desligado só por
// esta flag, para o caso de entrar uma segunda profissional.
export function isNoSplitSubscription(sub: {
  split_model_snapshot?: unknown
  professional_wallet_id_snapshot?: unknown
  professional_amount_cents_snapshot?: unknown
}): boolean {
  return (
    sub.split_model_snapshot === 'ledger' &&
    (sub.professional_wallet_id_snapshot ?? null) === null &&
    sub.professional_amount_cents_snapshot === 0
  )
}

// Snapshot gravado em `subscriptions` quando o split está desligado: 100% do
// valor fica com a plataforma. O percentual combinado com a profissional NÃO
// é gravado aqui; é aplicado só no relatório de acerto.
export function offSplitSnapshot(priceCents: number) {
  return {
    splitModel: 'ledger' as const,
    walletId: null,
    circulaPercent: 100,
    circulaAmountCents: priceCents,
    professionalAmountCents: 0,
  }
}
