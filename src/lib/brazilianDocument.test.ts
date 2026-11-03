import { describe, expect, it } from 'vitest'
import { isValidCnpj, isValidCpf, isValidDocument } from './brazilianDocument'

describe('brazilianDocument', () => {
  it('aceita CPF válido, com ou sem máscara', () => {
    expect(isValidCpf('11144477735')).toBe(true)
    expect(isValidCpf('111.444.777-35')).toBe(true)
  })

  it('recusa CPF com dígito errado, repetido ou de tamanho errado', () => {
    expect(isValidCpf('11144477736')).toBe(false)
    expect(isValidCpf('11111111111')).toBe(false)
    expect(isValidCpf('1114447773')).toBe(false)
  })

  it('aceita CNPJ válido e recusa inválido', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11222333000182')).toBe(false)
    expect(isValidCnpj('00000000000000')).toBe(false)
  })

  it('isValidDocument escolhe o validador pelo tipo', () => {
    expect(isValidDocument('CPF', '11144477735')).toBe(true)
    expect(isValidDocument('CNPJ', '11144477735')).toBe(false)
  })
})
