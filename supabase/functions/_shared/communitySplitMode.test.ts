import { describe, expect, it } from 'vitest'
import { offSplitSnapshot, resolveCommunitySplitMode } from './communitySplitMode.ts'

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
