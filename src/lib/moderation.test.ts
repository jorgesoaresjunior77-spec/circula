import { describe, expect, it } from 'vitest'
import { findBlockedTerm, isBlockedText } from './moderation'

describe('filtro de linguagem ofensiva', () => {
  it('libera texto normal e palavras que só contêm um termo', () => {
    expect(isBlockedText('Bom dia, meninas! Hoje bebi 2 litros de água.')).toBe(false)
    expect(isBlockedText('Comprei um computador e um cupom de desconto')).toBe(false)
  })
  it('bloqueia o termo direto, com acento, maiúsculas e repetição', () => {
    expect(isBlockedText('que MERDA')).toBe(true)
    expect(isBlockedText('merrrrda')).toBe(true)
  })
  it('bloqueia variações com números, símbolos, pontos e espaços', () => {
    expect(isBlockedText('m3rd4')).toBe(true)
    expect(isBlockedText('p.u.t.a')).toBe(true)
    expect(isBlockedText('b o s t a')).toBe(true)
  })
  it('usa a lista extra da profissional', () => {
    expect(findBlockedTerm('sua chata', ['chata'])).toBe('chata')
    expect(isBlockedText('sua chata')).toBe(false)
  })
})
