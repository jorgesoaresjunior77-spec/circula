import { describe, expect, it } from 'vitest'
import { isNoSplitSubscription, offSplitSnapshot, resolveCommunitySplitMode } from './communitySplitMode.ts'

describe('resolveCommunitySplitMode', () => {
  it('só desliga com "off" explícito', () => {
    expect(resolveCommunitySplitMode('off')).toBe('off')
    expect(resolveCommunitySplitMode(' OFF ')).toBe('off')
  })

  it('mantém native quando ausente, vazio ou desconhecido', () => {
    expect(resolveCommunitySplitMode(undefined)).toBe('native')
    expect(resolveCommunitySplitMode(null)).toBe('native')
    expect(resolveCommunitySplitMode('')).toBe('native')
    expect(resolveCommunitySplitMode('false')).toBe('native')
    expect(resolveCommunitySplitMode('native')).toBe('native')
  })
})

describe('isNoSplitSubscription', () => {
  it('reconhece o snapshot gravado com split desligado', () => {
    const s = offSplitSnapshot(1490)
    expect(
      isNoSplitSubscription({
        split_model_snapshot: s.splitModel,
        professional_wallet_id_snapshot: s.walletId,
        professional_amount_cents_snapshot: s.professionalAmountCents,
      }),
    ).toBe(true)
  })

  it('não confunde com split nativo, ledger com parcela ou assinatura antiga (null)', () => {
    expect(
      isNoSplitSubscription({
        split_model_snapshot: 'native',
        professional_wallet_id_snapshot: 'w1',
        professional_amount_cents_snapshot: 1341,
      }),
    ).toBe(false)
    expect(
      isNoSplitSubscription({
        split_model_snapshot: 'ledger',
        professional_wallet_id_snapshot: null,
        professional_amount_cents_snapshot: 1341,
      }),
    ).toBe(false)
    expect(
      isNoSplitSubscription({
        split_model_snapshot: null,
        professional_wallet_id_snapshot: null,
        professional_amount_cents_snapshot: null,
      }),
    ).toBe(false)
  })
})

describe('offSplitSnapshot', () => {
  it('deixa 100% com a plataforma, sem carteira, em modelo ledger', () => {
    const s = offSplitSnapshot(1490)
    expect(s.splitModel).toBe('ledger')
    expect(s.walletId).toBeNull()
    expect(s.circulaPercent).toBe(100)
    expect(s.circulaAmountCents + s.professionalAmountCents).toBe(1490)
    expect(s.professionalAmountCents).toBe(0)
  })
})
