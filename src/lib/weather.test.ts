import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  cityLabel,
  describeWeather,
  fetchWeather,
  loadCity,
  saveCity,
  searchCities,
  timeOnly,
  weekdayShort,
  WEATHER_CITY_EVENT,
} from './weather'

const LAJEADO = { name: 'Lajeado', region: 'Rio Grande do Sul', country: 'Brasil', latitude: -29.46, longitude: -51.96 }

function fakeFetch(body: unknown, ok = true) {
  return vi.fn(async (_url: string) => ({ ok, json: async () => body }))
}

describe('describeWeather', () => {
  it.each([
    [0, 'clear'],
    [2, 'partly'],
    [3, 'cloudy'],
    [45, 'fog'],
    [53, 'drizzle'],
    [63, 'rain'],
    [81, 'rain'],
    [73, 'snow'],
    [95, 'storm'],
  ])('código %i vira %s', (code, kind) => {
    expect(describeWeather(code).kind).toBe(kind)
  })

  it('código desconhecido não quebra', () => {
    expect(describeWeather(999).label).toBeTruthy()
  })
})

describe('cidade escolhida (só neste aparelho)', () => {
  afterEach(() => window.localStorage.clear())

  it('guarda, lê e apaga, avisando quem estiver ouvindo', () => {
    const onChange = vi.fn()
    window.addEventListener(WEATHER_CITY_EVENT, onChange)
    expect(loadCity()).toBeNull()
    saveCity(LAJEADO)
    expect(loadCity()).toEqual(LAJEADO)
    saveCity(null)
    expect(loadCity()).toBeNull()
    expect(onChange).toHaveBeenCalledTimes(2)
    window.removeEventListener(WEATHER_CITY_EVENT, onChange)
  })

  it('ignora valor salvo inválido', () => {
    window.localStorage.setItem('circula:weather-city', '{"name":"X"}')
    expect(loadCity()).toBeNull()
    window.localStorage.setItem('circula:weather-city', 'não é json')
    expect(loadCity()).toBeNull()
  })

  it('rótulo da cidade', () => {
    expect(cityLabel(LAJEADO)).toBe('Lajeado, Rio Grande do Sul')
  })
})

describe('searchCities', () => {
  it('não busca com menos de 2 letras', async () => {
    const f = fakeFetch({})
    expect(await searchCities(' a ', f)).toEqual([])
    expect(f).not.toHaveBeenCalled()
  })

  it('converte o resultado da API e pede em português', async () => {
    const f = fakeFetch({
      results: [{ name: 'Lajeado', admin1: 'Rio Grande do Sul', country: 'Brasil', latitude: -29.46, longitude: -51.96 }],
    })
    const out = await searchCities('Lajeado', f)
    expect(out).toEqual([LAJEADO])
    expect(String(f.mock.calls[0]?.[0])).toContain('language=pt')
  })

  it('sem resultado devolve lista vazia; erro de rede levanta mensagem', async () => {
    expect(await searchCities('xyzxyz', fakeFetch({}))).toEqual([])
    await expect(searchCities('Lajeado', fakeFetch({}, false))).rejects.toThrow(/buscar/)
  })
})

describe('fetchWeather', () => {
  const body = {
    current: { temperature_2m: 21.4, apparent_temperature: 20.2, relative_humidity_2m: 63, weather_code: 3, wind_speed_10m: 11.8, is_day: 1 },
    daily: {
      time: ['2026-11-10', '2026-11-11'],
      weather_code: [3, 61],
      temperature_2m_max: [24, 19],
      temperature_2m_min: [14, 12],
      precipitation_probability_max: [10, 80],
      sunrise: ['2026-11-10T05:40', '2026-11-11T05:39'],
      sunset: ['2026-11-10T19:10', '2026-11-11T19:11'],
    },
  }

  it('monta o agora, os dias e o sol, pedindo as coordenadas da cidade', async () => {
    const f = fakeFetch(body)
    const data = await fetchWeather(LAJEADO, f)
    expect(String(f.mock.calls[0]?.[0])).toContain('latitude=-29.46')
    expect(data.current).toEqual({ temp: 21.4, feels: 20.2, humidity: 63, wind: 11.8, code: 3, isDay: true })
    expect(data.daily).toHaveLength(2)
    expect(data.daily[1]).toMatchObject({ date: '2026-11-11', code: 61, max: 19, min: 12, rainChance: 80 })
    expect(timeOnly(data.sunrise)).toBe('05:40')
    expect(timeOnly(null)).toBe('—')
  })

  it('erro de rede levanta mensagem', async () => {
    await expect(fetchWeather(LAJEADO, fakeFetch({}, false))).rejects.toThrow(/previsão/)
  })

  it('o primeiro dia aparece como "Hoje"', () => {
    expect(weekdayShort('2026-11-10', 0)).toBe('Hoje')
    expect(weekdayShort('2026-11-11', 1)).toMatch(/qua/i)
  })
})
