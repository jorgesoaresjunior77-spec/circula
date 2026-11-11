import { describe, it, expect } from 'vitest'
import { partnerLogoBoost, safePartnerLink } from './partners'

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
})
