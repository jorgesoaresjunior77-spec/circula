// Modo de rateio da assinatura de comunidade.
//   native (padrão): split nativo do Asaas para a carteira da dona da comunidade.
//   off: sem split. Todo o valor cai na conta da plataforma e o acerto com a
//        profissional é feito fora do sistema.
// Qualquer valor diferente de 'off' mantém o comportamento atual (native).
export type CommunitySplitMode = 'native' | 'off'

export function resolveCommunitySplitMode(raw: string | undefined | null): CommunitySplitMode {
  return (raw ?? '').trim().toLowerCase() === 'off' ? 'off' : 'native'
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
