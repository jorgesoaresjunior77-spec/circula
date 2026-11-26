import { describe, it, expect } from 'vitest'
import { trialBannerState, trialWarningTitle } from './HomeTrialBanner'

const NOW = new Date('2026-12-01T12:00:00Z').getTime()
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString()

describe('trialBannerState', () => {
  it('não avisa quando faltam mais de 3 dias', () => {
    expect(trialBannerState('trial', day(15), NOW)).toBeNull()
    expect(trialBannerState('trial', day(4), NOW)).toBeNull()
  })
  it('avisa com os dias que faltam quando restam 3 ou menos', () => {
    expect(trialBannerState('trial', day(3), NOW)).toEqual({ kind: 'ending', days: 3 })
    expect(trialBannerState('trial', day(1), NOW)).toEqual({ kind: 'ending', days: 1 })
  })
  it('avisa que terminou quando a data já passou', () => {
    expect(trialBannerState('trial', day(-1), NOW)).toEqual({ kind: 'expired' })
  })
  it('só vale para quem está em período de teste', () => {
    expect(trialBannerState('active', day(2), NOW)).toBeNull()
    expect(trialBannerState(undefined, day(2), NOW)).toBeNull()
    expect(trialBannerState('trial', null, NOW)).toBeNull()
  })
  it('escreve o título do aviso', () => {
    expect(trialWarningTitle({ kind: 'ending', days: 3 })).toBe('Faltam 3 dias do seu período grátis')
    expect(trialWarningTitle({ kind: 'ending', days: 1 })).toContain('hoje ou amanhã')
    expect(trialWarningTitle({ kind: 'expired' })).toBe('Seu período grátis terminou')
  })
})
