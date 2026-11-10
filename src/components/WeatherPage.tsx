import { useState } from 'react'
import type { FormEvent } from 'react'
import { useWeather } from '../hooks/useWeather'
import { cityLabel, describeWeather, searchCities, timeOnly, weekdayShort } from '../lib/weather'
import type { WeatherCity } from '../lib/weather'
import { WeatherIcon } from './WeatherIcon'

// Página da previsão do tempo: agora, detalhes e próximos 7 dias. A cidade é
// escolhida aqui e fica só neste aparelho; a previsão acompanha a cidade.

function CityPicker({ onPick, onCancel }: { onPick: (city: WeatherCity) => void; onCancel?: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WeatherCity[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setResults(await searchCities(query))
    } catch (err) {
      setResults(null)
      setError(err instanceof Error ? err.message : 'Não foi possível buscar a cidade agora.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="weather-picker" onSubmit={handleSearch}>
      <label className="weather-picker-label" htmlFor="weather-city-input">
        Em que cidade você está agora?
      </label>
      <div className="weather-picker-row">
        <input
          id="weather-city-input"
          className="weather-picker-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex.: Lajeado"
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
      {results && results.length === 0 && <p className="home-muted">Nenhuma cidade encontrada. Tente outro nome.</p>}
      {results && results.length > 0 && (
        <ul className="weather-results">
          {results.map((c) => (
            <li key={`${c.latitude},${c.longitude}`}>
              <button type="button" className="weather-result" onClick={() => onPick(c)}>
                <strong>{cityLabel(c)}</strong>
                {c.country && <span>{c.country}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {onCancel && (
        <button type="button" className="water-link" onClick={onCancel}>
          Cancelar
        </button>
      )}
    </form>
  )
}

export function WeatherPage() {
  const { city, data, loading, error, setCity } = useWeather()
  const [changing, setChanging] = useState(false)

  function pick(next: WeatherCity) {
    setCity(next)
    setChanging(false)
  }

  if (!city) {
    return (
      <section className="weather-page">
        <h2>Previsão do tempo</h2>
        <p className="water-note">Escolha a cidade para ver a previsão. Ela fica salva só neste aparelho.</p>
        <CityPicker onPick={pick} />
      </section>
    )
  }

  const now = data ? describeWeather(data.current.code) : null

  return (
    <section className="weather-page">
      <h2>Previsão do tempo</h2>

      <div className="weather-city-row">
        <span className="weather-city">{cityLabel(city)}</span>
        {!changing && (
          <button type="button" className="water-link" onClick={() => setChanging(true)}>
            Alterar cidade
          </button>
        )}
      </div>

      {changing && <CityPicker onPick={pick} onCancel={() => setChanging(false)} />}

      {error && !data && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {loading && !data && <p className="home-muted">Carregando a previsão…</p>}

      {data && now && (
        <>
          <article className="weather-now">
            <WeatherIcon kind={now.kind} isDay={data.current.isDay} size={84} />
            <div className="weather-now-text">
              <p className="weather-temp">{Math.round(data.current.temp)}°</p>
              <p className="weather-label">{now.label}</p>
            </div>
          </article>

          <ul className="weather-facts">
            <li>
              <span>Sensação</span>
              <strong>{Math.round(data.current.feels)}°</strong>
            </li>
            <li>
              <span>Umidade</span>
              <strong>{Math.round(data.current.humidity)}%</strong>
            </li>
            <li>
              <span>Vento</span>
              <strong>{Math.round(data.current.wind)} km/h</strong>
            </li>
            <li>
              <span>Nascer do sol</span>
              <strong>{timeOnly(data.sunrise)}</strong>
            </li>
            <li>
              <span>Pôr do sol</span>
              <strong>{timeOnly(data.sunset)}</strong>
            </li>
          </ul>

          <h3 className="weather-heading">Próximos dias</h3>
          <ul className="weather-days">
            {data.daily.map((d, i) => {
              const desc = describeWeather(d.code)
              return (
                <li key={d.date} className="weather-day">
                  <span className="weather-day-name">{weekdayShort(d.date, i)}</span>
                  <WeatherIcon kind={desc.kind} size={28} />
                  <span className="weather-day-rain">{d.rainChance !== null ? `${d.rainChance}%` : ''}</span>
                  <span className="weather-day-temps">
                    <strong>{Math.round(d.max)}°</strong> <span>{Math.round(d.min)}°</span>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="plans-note">Previsão atualizada automaticamente. Dados: Open-Meteo.com.</p>
        </>
      )}
    </section>
  )
}
