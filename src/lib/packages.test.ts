import { describe, it, expect } from 'vitest'
import { canReadEbooks, canUseHelpNutri } from './packages'

describe('packages', () => {
  it('sem pacote, tudo bloqueado', () => {
    expect(canUseHelpNutri(new Set())).toBe(false)
    expect(canReadEbooks([])).toBe(false)
  })

  it('cada pacote libera só o que é dele', () => {
    expect(canUseHelpNutri(['help_nutri'])).toBe(true)
    expect(canReadEbooks(['help_nutri'])).toBe(false)
    expect(canReadEbooks(new Set(['ebooks']))).toBe(true)
    expect(canUseHelpNutri(new Set(['ebooks']))).toBe(false)
  })

  it('o plano completo vale pelos dois', () => {
    expect(canUseHelpNutri(['total'])).toBe(true)
    expect(canReadEbooks(['total'])).toBe(true)
  })
})
