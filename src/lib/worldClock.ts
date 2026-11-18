// Fusos do mundo (página do relógio): lugares com fuso horário, hora local e
// diferença para o horário de Brasília. A busca usa o mesmo serviço de cidades
// da previsão (Open-Meteo), que já devolve o fuso de cada lugar.

import type { WeatherCity } from './weather'

export interface WorldPlace extends WeatherCity {
  /** Fuso IANA, ex.: "Europe/Lisbon". */
  timezone: string
}

/** Os três lugares fixos no topo da página. */
export const PINNED_PLACES: WorldPlace[] = [
  { name: 'Brasília', country: 'Brasil', latitude: -15.78, longitude: -47.93, timezone: 'America/Sao_Paulo' },
  { name: 'Pequim', country: 'China', latitude: 39.9, longitude: 116.41, timezone: 'Asia/Shanghai' },
  { name: 'Nova York', country: 'Estados Unidos', latitude: 40.71, longitude: -74.01, timezone: 'America/New_York' },
]

type FetchLike = (input: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'

export async function searchPlaces(query: string, fetchImpl: FetchLike = fetch): Promise<WorldPlace[]> {
  const name = query.trim()
  if (name.length < 2) return []
  const res = await fetchImpl(`${GEOCODING_URL}?name=${encodeURIComponent(name)}&count=6&language=pt&format=json`)
  if (!res.ok) throw new Error('Não foi possível buscar o lugar agora.')
  const body = (await res.json()) as {
    results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone?: string }[]
  }
  return (body.results ?? [])
    .filter((r) => typeof r.timezone === 'string' && r.timezone.length > 0)
    .map((r) => ({
      name: r.name,
      region: r.admin1,
      country: r.country,
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone as string,
    }))
}

/** Minutos de diferença do fuso em relação ao UTC, naquele instante. */
export function offsetMinutes(timeZone: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return Math.round((asUtc - at.getTime()) / 60000)
}

/** "mesmo horário de Brasília", "3 h a mais que Brasília", "4h30 a menos que Brasília". */
export function diffFromBrasilia(timeZone: string, at: Date = new Date()): string {
  const diff = offsetMinutes(timeZone, at) - offsetMinutes('America/Sao_Paulo', at)
  if (diff === 0) return 'mesmo horário de Brasília'
  const abs = Math.abs(diff)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const amount = m === 0 ? `${h} h` : `${h}h${String(m).padStart(2, '0')}`
  return `${amount} ${diff > 0 ? 'a mais' : 'a menos'} que Brasília`
}

export function localTime(timeZone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)
}

export function localDate(timeZone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(at)
}

// ---- últimos lugares pesquisados (ficam só neste aparelho) ----------------
const RECENT_KEY = 'circula:world-clock-recent'
const RECENT_MAX = 4

function isPlace(v: unknown): v is WorldPlace {
  const p = v as WorldPlace
  return !!p && typeof p.name === 'string' && typeof p.timezone === 'string' && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
}

export function loadRecentPlaces(): WorldPlace[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter(isPlace).slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

export function rememberPlace(place: WorldPlace): WorldPlace[] {
  const same = (a: WorldPlace, b: WorldPlace) => a.name === b.name && a.timezone === b.timezone
  const next = [place, ...loadRecentPlaces().filter((p) => !same(p, place))].slice(0, RECENT_MAX)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* sem storage: vale só nesta visita */
  }
  return next
}
