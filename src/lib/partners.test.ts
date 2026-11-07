import { describe, it, expect } from 'vitest'
import { focusAt, safePartnerLink } from './partners'

describe('partners', () => {
  it('aceita só links https', () => {
    expect(safePartnerLink('https://exemplo.com')).toBe('https://exemplo.com/')
    expect(safePartnerLink('http://exemplo.com')).toBeNull()
    expect(safePartnerLink('javascript:alert(1)')).toBeNull()
    expect(safePartnerLink('  ')).toBeNull()
    expect(safePartnerLink(null)).toBeNull()
  })
  it('foco é 1 no centro e 0 nas pontas', () => {
    expect(focusAt(150, 0, 300)).toBe(1)
    expect(focusAt(0, 0, 300)).toBe(0)
    expect(focusAt(300, 0, 300)).toBe(0)
    expect(focusAt(75, 0, 300)).toBe(0.5)
  })
})
