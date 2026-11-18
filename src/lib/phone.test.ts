import { describe, it, expect } from 'vitest'
import { buildWhatsAppUrl, formatLoginPhone, normalizeLoginPhone, normalizeWhatsAppNumber } from './phone'

describe('normalizeWhatsAppNumber', () => {
  it('aceita celular com DDD em vários formatos e devolve 55 + número', () => {
    expect(normalizeWhatsAppNumber('(51) 99999-8888')).toBe('5551999998888')
    expect(normalizeWhatsAppNumber('51999998888')).toBe('5551999998888')
    expect(normalizeWhatsAppNumber('51 9 9999 8888')).toBe('5551999998888')
  })

  it('aceita com +55 ou 55 na frente sem duplicar', () => {
    expect(normalizeWhatsAppNumber('+55 51 99999-8888')).toBe('5551999998888')
    expect(normalizeWhatsAppNumber('5551999998888')).toBe('5551999998888')
  })

  it('aceita fixo de 8 dígitos com DDD', () => {
    expect(normalizeWhatsAppNumber('(51) 3333-4444')).toBe('555133334444')
  })

  it('recusa número sem DDD, curto, vazio ou com DDD inexistente', () => {
    expect(normalizeWhatsAppNumber('99999-8888')).toBeNull()
    expect(normalizeWhatsAppNumber('123')).toBeNull()
    expect(normalizeWhatsAppNumber('')).toBeNull()
    expect(normalizeWhatsAppNumber('   ')).toBeNull()
    expect(normalizeWhatsAppNumber('abc')).toBeNull()
    expect(normalizeWhatsAppNumber('(05) 99999-8888')).toBeNull()
  })

  it('celular de 11 dígitos precisa começar com 9 depois do DDD', () => {
    expect(normalizeWhatsAppNumber('51 89999 8888')).toBeNull()
  })

  it('número de outro país só vale com + na frente', () => {
    expect(normalizeWhatsAppNumber('+351 912 345 678')).toBe('351912345678')
    expect(normalizeWhatsAppNumber('351912345678')).toBeNull()
  })
})

describe('buildWhatsAppUrl', () => {
  it('monta o link wa.me com o texto codificado', () => {
    expect(buildWhatsAppUrl('5551999998888', 'Oi! Vem.')).toBe(
      'https://wa.me/5551999998888?text=Oi!%20Vem.',
    )
  })
})

describe('celular de login (DDD + 9 + número)', () => {
  it('aceita o padrão do Círcula e variações de digitação', () => {
    expect(normalizeLoginPhone('51996509660')).toBe('51996509660')
    expect(normalizeLoginPhone('(51) 99650-9660')).toBe('51996509660')
    expect(normalizeLoginPhone('+55 51 99650-9660')).toBe('51996509660')
    expect(normalizeLoginPhone('5551980327288')).toBe('51980327288')
  })

  it('recusa o que não é celular com DDD', () => {
    expect(normalizeLoginPhone('')).toBeNull()
    expect(normalizeLoginPhone('996509660')).toBeNull() // sem DDD
    expect(normalizeLoginPhone('5136509660')).toBeNull() // fixo
    expect(normalizeLoginPhone('51896509660')).toBeNull() // falta o 9
    expect(normalizeLoginPhone('051996509660')).toBeNull() // DDD com zero
    expect(normalizeLoginPhone('ana@exemplo.com')).toBeNull()
  })

  it('formata para mostrar', () => {
    expect(formatLoginPhone('51996509660')).toBe('(51) 99650-9660')
  })
})
