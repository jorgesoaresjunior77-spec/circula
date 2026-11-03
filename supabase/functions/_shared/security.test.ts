import { describe, expect, it } from 'vitest'
import { timingSafeEqualStrings } from './security.ts'

describe('timingSafeEqualStrings', () => {
  it('aceita textos iguais', () => {
    expect(timingSafeEqualStrings('abc123', 'abc123')).toBe(true)
  })

  it('recusa textos diferentes do mesmo tamanho', () => {
    expect(timingSafeEqualStrings('abc123', 'abc124')).toBe(false)
  })

  it('recusa quando um é prefixo do outro', () => {
    expect(timingSafeEqualStrings('abc', 'abcd')).toBe(false)
    expect(timingSafeEqualStrings('abcd', 'abc')).toBe(false)
  })

  it('recusa vazio contra preenchido e aceita vazio contra vazio', () => {
    expect(timingSafeEqualStrings('', 'x')).toBe(false)
    expect(timingSafeEqualStrings('', '')).toBe(true)
  })

  it('trata caracteres fora do ASCII', () => {
    expect(timingSafeEqualStrings('çã', 'çã')).toBe(true)
    expect(timingSafeEqualStrings('çã', 'ca')).toBe(false)
  })
})
