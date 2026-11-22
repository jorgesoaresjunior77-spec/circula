import { describe, expect, it } from 'vitest'
import { cityKey, distinctCities, filterPlaces, stateName } from './travel'
import type { TravelPlace } from './travel'

const base = { description: null, what_to_do: null, points_to_visit: null, image_paths: [], status: 'published' as const }
const places: TravelPlace[] = [
  { ...base, id: '1', title: 'Gramado', state: 'RS', city: 'Gramado', audiences: ['casal', 'familia'] },
  { ...base, id: '2', title: 'Canela', state: 'RS', city: 'Canela', audiences: ['familia'] },
  { ...base, id: '3', title: 'Bonito', state: 'MS', city: 'Bonito', audiences: ['sozinha'] },
]

describe('travel', () => {
  it('filtra por estado, cidade e público', () => {
    expect(filterPlaces(places, { state: 'RS' })).toHaveLength(2)
    expect(filterPlaces(places, { state: 'RS', audience: 'casal' }).map((p) => p.id)).toEqual(['1'])
    expect(filterPlaces(places, { city: 'Bonito' }).map((p) => p.id)).toEqual(['3'])
    expect(filterPlaces(places, {})).toHaveLength(3)
  })
  it('lista cidades sem repetir e em ordem', () => {
    expect(distinctCities([...places, { ...places[0], id: '9' }])).toEqual(['Bonito', 'Canela', 'Gramado'])
  })
  it('nomes e chaves', () => {
    expect(stateName('SP')).toBe('São Paulo')
    expect(cityKey('RS', ' Gramado ')).toBe('RS:gramado')
  })
})
