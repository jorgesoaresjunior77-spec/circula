// Modo de rateio da assinatura de comunidade.
//   native (padrão): split nativo do Asaas para a carteira da dona da comunidade.
//   off: sem split. Todo o valor cai na conta da plataforma e o acerto com a
//        profissional é feito fora do sistema.
// Qualquer valor diferente de 'off' mantém o comportamento atual (native).
export type CommunitySplitMode = 'native' | 'off'

export function resolveCommunitySplitMode(raw: string | undefined | null): CommunitySplitMode {
  return (raw ?? '').trim().toLowerCase() === 'off' ? 'off' : 'native'
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
