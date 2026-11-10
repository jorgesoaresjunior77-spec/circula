import { describe, it, expect } from 'vitest'
import { isList, recipeItems } from './recipeText'

describe('recipeItems — ingredientes', () => {
  it('uma linha por item, sem linhas vazias', () => {
    expect(recipeItems('1 banana\n\n2 ovos\r\n1 colher de aveia')).toEqual(['1 banana', '2 ovos', '1 colher de aveia'])
  })

  it('tira marcadores digitados, mas nunca o número da quantidade', () => {
    expect(recipeItems('- 1 banana\n• 2 ovos\n* 3 tâmaras\n– sal')).toEqual(['1 banana', '2 ovos', '3 tâmaras', 'sal'])
    expect(recipeItems('2 ovos\n1/2 xícara de leite\n3,5 g de sal')).toEqual(['2 ovos', '1/2 xícara de leite', '3,5 g de sal'])
  })

  it('texto vazio ou ausente vira lista vazia', () => {
    expect(recipeItems(null)).toEqual([])
    expect(recipeItems(undefined)).toEqual([])
    expect(recipeItems('  \n ')).toEqual([])
  })
})

describe('recipeItems — modo de preparo', () => {
  it('tira a numeração digitada e deixa o resto do texto', () => {
    expect(recipeItems('1. Amasse a banana\n2) Misture os ovos\n3 . Doure dos dois lados', { steps: true })).toEqual([
      'Amasse a banana',
      'Misture os ovos',
      'Doure dos dois lados',
    ])
  })

  it('não confunde um número no início da frase com numeração', () => {
    expect(recipeItems('2 minutos de cada lado, até dourar', { steps: true })).toEqual(['2 minutos de cada lado, até dourar'])
  })
})

describe('isList', () => {
  it('só uma lista quando há mais de um item', () => {
    expect(isList(['a'])).toBe(false)
    expect(isList([])).toBe(false)
    expect(isList(['a', 'b'])).toBe(true)
  })
})
