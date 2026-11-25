import { describe, it, expect } from 'vitest'
import { heroOfTheDay } from './heroRotation'

const day = (d: number) => new Date(2026, 10, d, 15, 0, 0)

describe('heroOfTheDay', () => {
  it('sem imagens cadastradas devolve null', () => {
    expect(heroOfTheDay({}, day(24))).toBeNull()
  })

  it('uma imagem por dia, na ordem, e volta ao começo depois da sexta', () => {
    const imgs = { hero_1: 'a', hero_2: 'b', hero_3: 'c', hero_4: 'd', hero_5: 'e', hero_6: 'f' }
    const seq = [1, 2, 3, 4, 5, 6, 7].map((d) => heroOfTheDay(imgs, day(d)))
    // seis dias seguidos mostram as seis diferentes, e o sétimo repete o primeiro
    expect(new Set(seq.slice(0, 6)).size).toBe(6)
    expect(seq[6]).toBe(seq[0])
  })

  it('o mesmo dia mostra sempre a mesma imagem (de manhã e à noite)', () => {
    const imgs = { hero_1: 'a', hero_2: 'b' }
    expect(heroOfTheDay(imgs, new Date(2026, 10, 24, 0, 5))).toBe(heroOfTheDay(imgs, new Date(2026, 10, 24, 23, 55)))
  })

  it('pula campos vazios', () => {
    const imgs = { hero_2: 'b', hero_5: 'e' }
    const vistos = new Set([1, 2, 3, 4].map((d) => heroOfTheDay(imgs, day(d))))
    expect(vistos).toEqual(new Set(['b', 'e']))
  })
})
