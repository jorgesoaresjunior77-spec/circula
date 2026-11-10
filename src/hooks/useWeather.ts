import { useCallback, useEffect, useState } from 'react'
import { fetchWeather, loadCity, saveCity, WEATHER_CITY_EVENT } from '../lib/weather'
import type { WeatherCity, WeatherData } from '../lib/weather'

// Cidade escolhida (neste aparelho) + previsão dela. Sem cidade, não faz
// nenhuma chamada de rede. A previsão é guardada por 15 minutos e atualizada
// de 30 em 30 enquanto a tela estiver aberta. O botão da Home e a página de
// previsão usam o mesmo estado: trocar a cidade em um atualiza o outro.

const CACHE_MS = 15 * 60 * 1000
const REFRESH_MS = 30 * 60 * 1000
const cache = new Map<string, WeatherData>()

function keyOf(city: WeatherCity): string {
  return `${city.latitude.toFixed(3)},${city.longitude.toFixed(3)}`
}

export function useWeather() {
  const [city, setCityState] = useState<WeatherCity | null>(loadCity)
  const [data, setData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setCityState(loadCity())
    window.addEventListener(WEATHER_CITY_EVENT, sync)
    return () => window.removeEventListener(WEATHER_CITY_EVENT, sync)
  }, [])

  const latitude = city?.latitude
  const longitude = city?.longitude

  useEffect(() => {
    if (!city) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    const key = keyOf(city)

    async function load(force: boolean) {
      if (!city) return
      const cached = cache.get(key)
      if (cached && !force && Date.now() - cached.fetchedAt < CACHE_MS) {
        setData(cached)
        setError(null)
        return
      }
      setLoading(true)
      try {
        const fresh = await fetchWeather(city)
        if (cancelled) return
        cache.set(key, fresh)
        setData(fresh)
        setError(null)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Não foi possível carregar a previsão agora.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load(false)
    const timer = window.setInterval(() => void load(true), REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
    // A previsão depende só das coordenadas da cidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude])

  const setCity = useCallback((next: WeatherCity | null) => saveCity(next), [])

  return { city, data, loading, error, setCity }
}
