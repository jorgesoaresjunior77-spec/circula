import { describe, it, expect } from 'vitest'
import { trialBannerState } from './HomeTrialBanner'

const NOW = new Date('2026-12-01T12:00:00Z').getTime()
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString()

describe('trialBannerState', () => {
  it('não avisa quando faltam mais de 7 dias', () => {
    expect(trialBannerState('trial', day(15), NOW)).toBeNull()
  })
  it('avisa com os dias que faltam quando restam 7 ou menos', () => {
    expect(trialBannerState('trial', day(5), NOW)).toEqual({ kind: 'ending', days: 5 })
    expect(trialBannerState('trial', day(7), NOW)).toEqual({ kind: 'ending', days: 7 })
  })
  it('avisa que terminou quando a data já passou', () => {
    expect(trialBannerState('trial', day(-1), NOW)).toEqual({ kind: 'expired' })
  })
  it('só vale para quem está em período de teste', () => {
    expect(trialBannerState('active', day(2), NOW)).toBeNull()
    expect(trialBannerState(undefined, day(2), NOW)).toBeNull()
    expect(trialBannerState('trial', null, NOW)).toBeNull()
  })
})
