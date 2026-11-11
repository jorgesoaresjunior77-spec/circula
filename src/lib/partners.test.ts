import { describe, it, expect } from 'vitest'
import { marqueeRepeats, partnerLogoBoost, safePartnerLink } from './partners'

describe('partners', () => {
  it('aceita só links https', () => {
    expect(safePartnerLink('https://exemplo.com')).toBe('https://exemplo.com/')
    expect(safePartnerLink('http://exemplo.com')).toBeNull()
    expect(safePartnerLink('javascript:alert(1)')).toBeNull()
    expect(safePartnerLink('  ')).toBeNull()
    expect(safePartnerLink(null)).toBeNull()
  })

  it('aumenta só o logo dos parceiros marcados', () => {
    expect(partnerLogoBoost('Speedbox')).toBe(true)
    expect(partnerLogoBoost('Speed Box Academia')).toBe(true)
    expect(partnerLogoBoost('Outro Parceiro')).toBe(false)
    expect(partnerLogoBoost(null)).toBe(false)
  })

  it('repete a lista até ter logos suficientes para cobrir a tela', () => {
    expect(marqueeRepeats(0)).toBe(0)
    expect(marqueeRepeats(1)).toBe(6)
    expect(marqueeRepeats(2)).toBe(3)
    expect(marqueeRepeats(4)).toBe(2)
    expect(marqueeRepeats(6)).toBe(1)
    expect(marqueeRepeats(9)).toBe(1)
  })
})
