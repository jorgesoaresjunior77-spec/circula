// Previsão do tempo da Home. Sem chave e sem banco: a cidade escolhida fica só
// neste aparelho (localStorage) e os dados vêm da API pública Open-Meteo.
// ATENÇÃO (licença): o plano gratuito da Open-Meteo é para uso não comercial.
// Com o Círcula em operação paga, trocar de provedor ou contratar o plano deles
// — por isso toda a chamada de rede mora neste arquivo.

export interface WeatherCity {
  name: string
  region?: string
  country?: string
  latitude: number
  longitude: number
}

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'storm' | 'snow'

export interface WeatherDescription {
  kind: WeatherKind
  label: string
}

export interface WeatherCurrent {
  temp: number
  feels: number
  humidity: number
  wind: number
  code: number
  isDay: boolean
}

export interface WeatherDay {
  date: string
  code: number
  max: number
  min: number
  rainChance: number | null
}

export interface WeatherData {
  current: WeatherCurrent
  daily: WeatherDay[]
  sunrise: string | null
  sunset: string | null
  fetchedAt: number
}

/** Códigos WMO usados pela Open-Meteo -> tipo de ícone e rótulo em português. */
export function describeWeather(code: number): WeatherDescription {
  if (code === 0) return { kind: 'clear', label: 'Céu limpo' }
  if (code === 1) return { kind: 'clear', label: 'Predomínio de sol' }
  if (code === 2) return { kind: 'partly', label: 'Parcialmente nublado' }
  if (code === 3) return { kind: 'cloudy', label: 'Nublado' }
  if (code === 45 || code === 48) return { kind: 'fog', label: 'Neblina' }
  if (code >= 51 && code <= 57) return { kind: 'drizzle', label: 'Garoa' }
  if (code >= 61 && code <= 67) return { kind: 'rain', label: 'Chuva' }
  if (code >= 71 && code <= 77) return { kind: 'snow', label: 'Neve' }
  if (code >= 80 && code <= 82) return { kind: 'rain', label: 'Pancadas de chuva' }
  if (code === 85 || code === 86) return { kind: 'snow', label: 'Pancadas de neve' }
  if (code >= 95) return { kind: 'storm', label: 'Tempestade' }
  return { kind: 'cloudy', label: 'Tempo instável' }
}

export function cityLabel(city: WeatherCity): string {
  return [city.name, city.region].filter(Boolean).join(', ')
}

// ---- Cidade escolhida (só neste aparelho) --------------------------------
const CITY_KEY = 'circula:weather-city'
export const WEATHER_CITY_EVENT = 'circula:weather-city-changed'

function isCity(value: unknown): value is WeatherCity {
  const v = value as WeatherCity | null
  return (
    !!v &&
    typeof v.name === 'string' &&
    typeof v.latitude === 'number' &&
    typeof v.longitude === 'number' &&
    Number.isFinite(v.latitude) &&
    Number.isFinite(v.longitude)
  )
}

export function loadCity(): WeatherCity | null {
  try {
    const raw = window.localStorage.getItem(CITY_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isCity(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveCity(city: WeatherCity | null): void {
  try {
    if (city) window.localStorage.setItem(CITY_KEY, JSON.stringify(city))
    else window.localStorage.removeItem(CITY_KEY)
  } catch {
    // Sem armazenamento (aba privada): vale só até fechar a página.
  }
  window.dispatchEvent(new Event(WEATHER_CITY_EVENT))
}

// ---- Rede ----------------------------------------------------------------
type FetchLike = (input: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

export async function searchCities(query: string, fetchImpl: FetchLike = fetch): Promise<WeatherCity[]> {
  const name = query.trim()
  if (name.length < 2) return []
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(name)}&count=6&language=pt&format=json`
  const res = await fetchImpl(url)
  if (!res.ok) throw new Error('Não foi possível buscar a cidade agora.')
  const body = (await res.json()) as {
    results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[]
  }
  return (body.results ?? [])
    .map((r) => ({ name: r.name, region: r.admin1, country: r.country, latitude: r.latitude, longitude: r.longitude }))
    .filter(isCity)
}

export async function fetchWeather(city: WeatherCity, fetchImpl: FetchLike = fetch): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(city.latitude),
    longitude: String(city.longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '7',
  })
  const res = await fetchImpl(`${FORECAST_URL}?${params.toString()}`)
  if (!res.ok) throw new Error('Não foi possível carregar a previsão agora.')
  const b = (await res.json()) as {
    current: {
      temperature_2m: number
      apparent_temperature: number
      relative_humidity_2m: number
      weather_code: number
      wind_speed_10m: number
      is_day: number
    }
    daily: {
      time: string[]
      weather_code: number[]
      temperature_2m_max: number[]
      temperature_2m_min: number[]
      precipitation_probability_max?: (number | null)[]
      sunrise?: string[]
      sunset?: string[]
    }
  }
  const daily: WeatherDay[] = b.daily.time.map((date, i) => ({
    date,
    code: b.daily.weather_code[i],
    max: b.daily.temperature_2m_max[i],
    min: b.daily.temperature_2m_min[i],
    rainChance: b.daily.precipitation_probability_max?.[i] ?? null,
  }))
  return {
    current: {
      temp: b.current.temperature_2m,
      feels: b.current.apparent_temperature,
      humidity: b.current.relative_humidity_2m,
      wind: b.current.wind_speed_10m,
      code: b.current.weather_code,
      isDay: b.current.is_day === 1,
    },
    daily,
    sunrise: b.daily.sunrise?.[0] ?? null,
    sunset: b.daily.sunset?.[0] ?? null,
    fetchedAt: Date.now(),
  }
}

export function weekdayShort(isoDate: string, index: number): string {
  if (index === 0) return 'Hoje'
  const d = new Date(`${isoDate}T12:00:00`)
  return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
}

/** "2026-11-10T06:12" -> "06:12". */
export function timeOnly(iso: string | null): string {
  return iso ? iso.slice(11, 16) : '—'
}
