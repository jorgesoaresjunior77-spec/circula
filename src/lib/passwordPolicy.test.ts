import { describe, expect, it } from 'vitest'
import { evaluatePassword, isPasswordValid } from './passwordPolicy'

describe('passwordPolicy', () => {
  it('aceita 1 maiúscula, 1 número e 1 especial, com o resto livre', () => {
    expect(isPasswordValid('abcA1!')).toBe(true)
    expect(isPasswordValid('mãe feliz Á9#')).toBe(true)
    expect(isPasswordValid('Zé*7')).toBe(false) // curta demais para o Supabase
    expect(isPasswordValid('Zé*7ab')).toBe(true)
  })

  it('recusa cada regra faltando, sinalizando qual', () => {
    const missing = (pw: string) => evaluatePassword(pw).filter((r) => !r.met).map((r) => r.id)
    expect(missing('abcdef1!')).toEqual(['uppercase'])
    expect(missing('Abcdefg!')).toEqual(['digit'])
    expect(missing('Abcdefg1')).toEqual(['special'])
    expect(missing('Ab1!')).toEqual(['length'])
    expect(missing('')).toEqual(['length', 'uppercase', 'digit', 'special'])
  })

  it('espaço não conta como caractere especial', () => {
    expect(isPasswordValid('Abcdef 1')).toBe(false)
  })
})
