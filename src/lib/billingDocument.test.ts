import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))

import { documentError, maskDocument } from './billingDocument'

describe('maskDocument', () => {
  it('formata CPF enquanto digita', () => {
    expect(maskDocument('CPF', '529')).toBe('529')
    expect(maskDocument('CPF', '5299822')).toBe('529.982.2')
    expect(maskDocument('CPF', '52998224725')).toBe('529.982.247-25')
    expect(maskDocument('CPF', '529.982.247-25999')).toBe('529.982.247-25')
  })
  it('formata CNPJ', () => {
    expect(maskDocument('CNPJ', '11222333000181')).toBe('11.222.333/0001-81')
  })
})

describe('documentError', () => {
  it('pede o CPF quando vazio', () => {
    expect(documentError('CPF', '')).toMatch(/Informe/)
  })
  it('conta os dígitos', () => {
    expect(documentError('CPF', '529.982.24')).toMatch(/11 números/)
  })
  it('recusa CPF com dígito verificador errado', () => {
    expect(documentError('CPF', '529.982.247-26')).toMatch(/não é válido/)
    expect(documentError('CPF', '111.111.111-11')).toMatch(/não é válido/)
  })
  it('aceita CPF válido', () => {
    expect(documentError('CPF', '529.982.247-25')).toBeNull()
  })
})
