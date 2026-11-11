import { describe, it, expect } from 'vitest'
import { reloadUrl, shouldReload } from './appUpdate'

describe('appUpdate', () => {
  it('recarrega só quando há versão diferente e ainda não tentada', () => {
    expect(shouldReload('A', 'B', null)).toBe(true)
    expect(shouldReload('A', 'A', null)).toBe(false)
    // já tentou esta versão nesta sessão: não entra em laço
    expect(shouldReload('A', 'B', 'B')).toBe(false)
    // saiu outra versão depois da tentativa: tenta de novo
    expect(shouldReload('A', 'C', 'B')).toBe(true)
  })

  it('não recarrega sem identificador local ou com resposta inválida', () => {
    expect(shouldReload(null, 'B', null)).toBe(false)
    expect(shouldReload('A', null, null)).toBe(false)
    expect(shouldReload('A', '', null)).toBe(false)
    expect(shouldReload('A', 42, null)).toBe(false)
  })

  it('a recarga leva ?v=<id> e preserva os outros parâmetros', () => {
    expect(reloadUrl('https://x.test/circula/', 'B')).toBe('https://x.test/circula/?v=B')
    expect(reloadUrl('https://x.test/circula/?convite=abc', 'B')).toBe('https://x.test/circula/?convite=abc&v=B')
    expect(reloadUrl('https://x.test/circula/?v=A', 'B')).toBe('https://x.test/circula/?v=B')
  })
})
