import { describe, it, expect } from 'vitest'
import { buildWhatsAppUrl, normalizeWhatsAppNumber } from './phone'

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
