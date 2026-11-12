import { useWeather } from '../hooks/useWeather'
import { describeWeather, cityLabel } from '../lib/weather'
import { WeatherIcon } from './WeatherIcon'
import { m } from '../lib/motionKit'

// O tempo de agora ao lado da saudação: ícone da condição e a temperatura
// atual. Toca e abre a página completa. Sem cidade escolhida, mostra um céu
// neutro (sem temperatura) e a página pede a cidade.

export function WeatherButton({ onOpen }: { onOpen: () => void }) {
  const { city, data } = useWeather()
  const description = data ? describeWeather(data.current.code) : null
  const temp = data ? Math.round(data.current.temp) : null
  const label =
    city && data && description
      ? `Previsão do tempo em ${cityLabel(city)}: ${description.label}, ${temp} graus. Abrir`
      : city
        ? `Previsão do tempo em ${cityLabel(city)}. Abrir`
        : 'Previsão do tempo. Escolher a cidade'

  return (
    <button type="button" className="weather-button" onClick={onOpen} aria-label={label} title={description?.label ?? 'Previsão do tempo'}>
      <m.span
        className="weather-icon-float"
        animate={{ y: [0, -3, 0], x: [0, 2, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <WeatherIcon kind={description?.kind ?? 'partly'} isDay={data?.current.isDay ?? true} size={46} />
      </m.span>
      {/* A temperatura fica sempre escrita; sem dado ainda (cidade não escolhida
          neste aparelho ou sem internet), aparece um traço no lugar do número. */}
      <span className="weather-temp-now">{temp !== null ? `${temp}°` : '--°'}</span>
    </button>
  )
}
