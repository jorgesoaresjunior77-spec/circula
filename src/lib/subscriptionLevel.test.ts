import { describe, expect, it } from 'vitest'
import { ownedProductNames, subscriptionLevel } from './subscriptionLevel'

describe('subscriptionLevel', () => {
  it('Premium vale por tudo', () => {
    expect(subscriptionLevel(new Set(['premium']), null).id).toBe('premium')
    expect(ownedProductNames(new Set(['premium']))).toHaveLength(31)
  })
  it('plano da comunidade ativo é o nível Círcula', () => {
    expect(subscriptionLevel(new Set(), 'active').id).toBe('circula')
    expect(subscriptionLevel(new Set(), 'blocked').id).toBe('none')
  })
  it('lista só os produtos contratados e o plano completo vale por dois', () => {
    expect(ownedProductNames(new Set(['wellness']))).toEqual(['Wellness'])
    expect(ownedProductNames(new Set(['total']))).toEqual(['Loja', 'Help Nutri'])
  })
})
