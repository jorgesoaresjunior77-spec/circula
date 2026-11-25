import { describe, it, expect } from 'vitest'
import { heroImage } from './heroRotation'

describe('heroImage', () => {
  it('sem imagem cadastrada devolve null', () => {
    expect(heroImage({})).toBeNull()
    expect(heroImage({ hero_1: '' })).toBeNull()
  })

  it('usa sempre a imagem hero_1, e ignora as outras chaves', () => {
    expect(heroImage({ hero_1: 'a', hero_2: 'b' })).toBe('a')
    expect(heroImage({ hero_2: 'b' })).toBeNull()
  })
})
