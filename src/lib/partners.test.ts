import { describe, it, expect } from 'vitest'
import { safePartnerLink } from './partners'

describe('partners', () => {
  it('aceita só links https', () => {
    expect(safePartnerLink('https://exemplo.com')).toBe('https://exemplo.com/')
    expect(safePartnerLink('http://exemplo.com')).toBeNull()
    expect(safePartnerLink('javascript:alert(1)')).toBeNull()
    expect(safePartnerLink('  ')).toBeNull()
    expect(safePartnerLink(null)).toBeNull()
  })
})
