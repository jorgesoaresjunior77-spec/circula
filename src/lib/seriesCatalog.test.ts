import { describe, expect, it } from 'vitest'
import { SERIES_GENRES, ageLabel, filterPicks, safeWatchLink } from './seriesCatalog'
import type { SeriesPick } from './seriesCatalog'

const pick = (over: Partial<SeriesPick>): SeriesPick => ({
  id: '1', kind: 'serie', title: 'A', description: null, genres: ['Drama'], platform: null, platform_url: null, age_rating: null, cover_path: null, status: 'published', ...over,
})

describe('dicas de séries e filmes', () => {
  it('só aceita link https', () => {
    expect(safeWatchLink('https://www.netflix.com/title/1')).toContain('https://www.netflix.com')
    expect(safeWatchLink('http://x.com')).toBeNull()
    expect(safeWatchLink('javascript:alert(1)')).toBeNull()
    expect(safeWatchLink(null)).toBeNull()
  })
  it('filtra por tipo e gênero', () => {
    const list = [pick({ id: '1' }), pick({ id: '2', kind: 'filme', genres: ['Comédia'] }), pick({ id: '3', genres: ['Drama', 'Família'] })]
    expect(filterPicks(list, { kind: 'serie' }).map((p) => p.id)).toEqual(['1', '3'])
    expect(filterPicks(list, { kind: 'serie', genre: 'Família' }).map((p) => p.id)).toEqual(['3'])
    expect(filterPicks(list, { kind: 'filme', genre: 'Drama' })).toEqual([])
  })
  it('sem tipo mostra séries e filmes, e filtra por faixa etária e plataforma', () => {
    const list = [
      pick({ id: '1', age_rating: '12', platform: 'Netflix' }),
      pick({ id: '2', kind: 'filme', genres: ['Terror'], age_rating: '16', platform: 'Max' }),
      pick({ id: '3', kind: 'filme', genres: ['Comédia'], age_rating: 'L', platform: 'Netflix' }),
    ]
    expect(filterPicks(list, { kind: '' }).map((p) => p.id)).toEqual(['1', '2', '3'])
    expect(filterPicks(list, { genre: 'Terror' }).map((p) => p.id)).toEqual(['2'])
    expect(filterPicks(list, { age: 'L' }).map((p) => p.id)).toEqual(['3'])
    expect(filterPicks(list, { platform: 'Netflix' }).map((p) => p.id)).toEqual(['1', '3'])
    expect(filterPicks(list, { kind: 'filme', platform: 'Netflix' }).map((p) => p.id)).toEqual(['3'])
  })
  it('tem muitas classificações de gênero, sem repetir', () => {
    expect(SERIES_GENRES.length).toBeGreaterThanOrEqual(35)
    expect(new Set(SERIES_GENRES).size).toBe(SERIES_GENRES.length)
  })
  it('mostra a classificação', () => {
    expect(ageLabel('L')).toBe('Livre')
    expect(ageLabel('16')).toBe('16 anos')
    expect(ageLabel(null)).toBeNull()
  })
})
