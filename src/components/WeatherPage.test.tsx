import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { WeatherPage } from './WeatherPage'
import { WeatherButton } from './WeatherButton'

const CITY = { name: 'Lajeado', region: 'Rio Grande do Sul', country: 'Brasil', latitude: -29.46, longitude: -51.96 }
const FORECAST = {
  current: { temperature_2m: 21.4, apparent_temperature: 20.2, relative_humidity_2m: 63, weather_code: 61, wind_speed_10m: 11.8, is_day: 1 },
  daily: {
    time: ['2026-11-10', '2026-11-11', '2026-11-12'],
    weather_code: [61, 3, 0],
    temperature_2m_max: [24, 22, 27],
    temperature_2m_min: [14, 13, 15],
    precipitation_probability_max: [80, 20, 0],
    sunrise: ['2026-11-10T05:40', '', ''],
    sunset: ['2026-11-10T19:10', '', ''],
  },
}

function mockNetwork() {
  const f = vi.fn(async (url: string) => {
    if (url.includes('geocoding-api')) {
      return {
        ok: true,
        json: async () => ({
          results: [{ name: 'Lajeado', admin1: 'Rio Grande do Sul', country: 'Brasil', latitude: -29.46, longitude: -51.96 }],
        }),
      }
    }
    return { ok: true, json: async () => FORECAST }
  })
  vi.stubGlobal('fetch', f)
  return f
}

describe('Previsão do tempo', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it('sem cidade, pede a cidade e não faz nenhuma chamada de previsão', () => {
    const f = mockNetwork()
    render(<WeatherPage />)
    expect(screen.getByLabelText('Em que cidade você está agora?')).toBeInTheDocument()
    expect(f).not.toHaveBeenCalled()
  })

  it('busca a cidade, escolhe, guarda neste aparelho e mostra a previsão', async () => {
    mockNetwork()
    render(<WeatherPage />)
    fireEvent.change(screen.getByLabelText('Em que cidade você está agora?'), { target: { value: 'Lajeado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    fireEvent.click(await screen.findByRole('button', { name: /Lajeado, Rio Grande do Sul/ }))

    expect(await screen.findByText('21°')).toBeInTheDocument()
    expect(screen.getByText('Chuva')).toBeInTheDocument()
    expect(screen.getByText('Hoje')).toBeInTheDocument()
    expect(screen.getByText('63%')).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem('circula:weather-city') ?? '{}').name).toBe('Lajeado')
  })

  it('com cidade salva, a previsão acompanha a cidade e dá para alterar', async () => {
    // Coordenadas próprias: a previsão fica 15 min em cache por cidade.
    window.localStorage.setItem('circula:weather-city', JSON.stringify({ ...CITY, latitude: -30.03, longitude: -51.23 }))
    const f = mockNetwork()
    render(<WeatherPage />)
    expect(await screen.findByText('21°')).toBeInTheDocument()
    expect(String(f.mock.calls[0]?.[0])).toContain('latitude=-30.03')

    fireEvent.click(screen.getByRole('button', { name: 'Alterar cidade' }))
    expect(screen.getByLabelText('Em que cidade você está agora?')).toBeInTheDocument()
  })

  it('o botão da Home mostra só o ícone e abre a página', async () => {
    window.localStorage.setItem('circula:weather-city', JSON.stringify(CITY))
    mockNetwork()
    const onOpen = vi.fn()
    render(<WeatherButton onOpen={onOpen} />)
    const botao = await screen.findByRole('button', { name: /Previsão do tempo em Lajeado.*Chuva.*21 graus/ })
    expect(botao.textContent).toBe('')
    fireEvent.click(botao)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('o botão sem cidade convida a escolher e não usa a rede', async () => {
    const f = mockNetwork()
    render(<WeatherButton onOpen={() => {}} />)
    expect(screen.getByRole('button', { name: 'Previsão do tempo. Escolher a cidade' })).toBeInTheDocument()
    await waitFor(() => expect(f).not.toHaveBeenCalled())
  })
})
