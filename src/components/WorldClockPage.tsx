import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { describeWeather, fetchWeather, weatherScene } from '../lib/weather'
import type { WeatherData } from '../lib/weather'
import {
  PINNED_PLACES,
  diffFromBrasilia,
  loadRecentPlaces,
  localDate,
  localTime,
  rememberPlace,
  searchPlaces,
} from '../lib/worldClock'
import type { WorldPlace } from '../lib/worldClock'
import { WeatherIcon } from './WeatherIcon'

// Relógio do mundo: a pessoa digita o nome de um lugar e vê que horas são lá,
// a diferença para Brasília e como está o tempo — ajuda a organizar a mala de
// viagem. Três lugares ficam fixos no topo. Os últimos pesquisados ficam só
// neste aparelho. Hora e clima são dados reais (Open-Meteo); nada é inventado.

const weatherCache = new Map<string, WeatherData>()

function placeKey(p: WorldPlace): string {
  return `${p.latitude.toFixed(2)},${p.longitude.toFixed(2)}`
}

function placeLabel(p: WorldPlace): string {
  return [p.name, p.region && p.region !== p.name ? p.region : null, p.country].filter(Boolean).join(', ')
}

/** Dica para a mala, a partir da previsão dos próximos dias. */
export function packingHint(data: WeatherData): string {
  const days = data.daily.slice(0, 5)
  if (days.length === 0) return ''
  const min = Math.round(Math.min(...days.map((d) => d.min)))
  const max = Math.round(Math.max(...days.map((d) => d.max)))
  const rain = Math.max(...days.map((d) => d.rainChance ?? 0))
  const parts = [`Próximos dias: de ${min}° a ${max}°`]
  if (max >= 28) parts.push('roupas leves e protetor solar')
  else if (max <= 14) parts.push('casaco e roupas quentes')
  else if (min <= 12) parts.push('leve um casaco para a noite')
  else parts.push('roupas de meia-estação')
  if (rain >= 50) parts.push(`guarda-chuva (até ${Math.round(rain)}% de chance de chuva)`)
  return parts.join(' · ')
}

function PlaceCard({ place, now, featured = false }: { place: WorldPlace; now: Date; featured?: boolean }) {
  const key = placeKey(place)
  const [data, setData] = useState<WeatherData | null>(() => weatherCache.get(key) ?? null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const cached = weatherCache.get(key)
    if (cached && Date.now() - cached.fetchedAt < 20 * 60 * 1000) {
      setData(cached)
      return
    }
    let cancelled = false
    setFailed(false)
    fetchWeather(place).then(
      (fresh) => {
        if (cancelled) return
        weatherCache.set(key, fresh)
        setData(fresh)
      },
      () => {
        if (!cancelled) setFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const desc = data ? describeWeather(data.current.code) : null
  const scene = data && desc ? weatherScene(desc.kind, data.current.isDay, data.current.temp) : null

  return (
    <article className={`wclock-card${featured ? ' wclock-card--featured' : ''} weather-hero--${scene?.scene ?? 'ceu-azul'}`}>
      <div className="wclock-card-head">
        <div className="wclock-card-place">
          <strong>{place.name}</strong>
          <span>{[place.region && place.region !== place.name ? place.region : null, place.country].filter(Boolean).join(', ')}</span>
        </div>
        <p className="wclock-card-time">{localTime(place.timezone, now)}</p>
      </div>
      <p className="wclock-card-date">
        {localDate(place.timezone, now)} · {diffFromBrasilia(place.timezone, now)}
      </p>

      {data && desc ? (
        <div className="wclock-card-weather">
          <WeatherIcon kind={desc.kind} isDay={data.current.isDay} size={featured ? 44 : 34} />
          <span className="wclock-card-temp">{Math.round(data.current.temp)}°</span>
          <span className="wclock-card-label">
            {desc.label}
            <small>sensação de {Math.round(data.current.feels)}°</small>
          </span>
        </div>
      ) : (
        <p className="wclock-card-muted">{failed ? 'Não foi possível carregar o clima agora.' : 'Carregando o clima…'}</p>
      )}

      {featured && data && <p className="wclock-card-hint">{packingHint(data)}</p>}
    </article>
  )
}

export function WorldClockPage() {
  const [now, setNow] = useState(() => new Date())
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WorldPlace[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<WorldPlace | null>(null)
  const [recent, setRecent] = useState<WorldPlace[]>(loadRecentPlaces)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20_000)
    return () => window.clearInterval(id)
  }, [])

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setResults(await searchPlaces(query))
    } catch (err) {
      setResults(null)
      setError(err instanceof Error ? err.message : 'Não foi possível buscar o lugar agora.')
    } finally {
      setBusy(false)
    }
  }

  function pick(place: WorldPlace) {
    setSelected(place)
    setResults(null)
    setQuery('')
    setRecent(rememberPlace(place))
  }

  const otherRecent = recent.filter((p) => !selected || placeKey(p) !== placeKey(selected))

  return (
    <section className="wclock-page">
      <h2>Relógio do mundo</h2>
      <p className="water-note">
        Digite o nome de um lugar para ver que horas são lá e como está o tempo. Bom para combinar um horário ou
        arrumar a mala.
      </p>

      <form className="weather-picker" onSubmit={(e) => void handleSearch(e)}>
        <label className="weather-picker-label" htmlFor="wclock-input">
          Qual lugar você quer consultar?
        </label>
        <div className="weather-picker-row">
          <input
            id="wclock-input"
            className="weather-picker-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex.: Paris, Tóquio, Florianópolis"
            autoComplete="off"
          />
          <button type="submit" className="water-primary" disabled={busy || query.trim().length < 2}>
            {busy ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {results && results.length === 0 && <p className="home-muted">Nenhum lugar encontrado. Tente outro nome.</p>}
        {results && results.length > 0 && (
          <ul className="weather-results">
            {results.map((p) => (
              <li key={`${placeKey(p)}-${p.timezone}`}>
                <button type="button" className="weather-result" onClick={() => pick(p)}>
                  <strong>{placeLabel(p)}</strong>
                  <span>{localTime(p.timezone, now)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {selected && (
        <>
          <h3 className="weather-heading">Você consultou</h3>
          <PlaceCard key={placeKey(selected)} place={selected} now={now} featured />
        </>
      )}

      <h3 className="weather-heading">Sempre à mão</h3>
      <div className="wclock-grid">
        {PINNED_PLACES.map((p) => (
          <PlaceCard key={placeKey(p)} place={p} now={now} />
        ))}
      </div>

      {otherRecent.length > 0 && (
        <>
          <h3 className="weather-heading">Pesquisados por último</h3>
          <ul className="wclock-recent">
            {otherRecent.map((p) => (
              <li key={`${placeKey(p)}-${p.timezone}`}>
                <button type="button" className="weather-result" onClick={() => pick(p)}>
                  <strong>{placeLabel(p)}</strong>
                  <span>{localTime(p.timezone, now)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="plans-note">Hora pelo fuso oficial de cada lugar. Clima: Open-Meteo.com.</p>
    </section>
  )
}
