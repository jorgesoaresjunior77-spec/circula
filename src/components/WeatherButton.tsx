import { useWeather } from '../hooks/useWeather'
import { describeWeather, cityLabel } from '../lib/weather'
import { WeatherIcon } from './WeatherIcon'

// Só o ícone do tempo de agora, ao lado da saudação. Toca e abre a página
// completa. Sem cidade escolhida, mostra um céu neutro e a página pede a cidade.

export function WeatherButton({ onOpen }: { onOpen: () => void }) {
  const { city, data } = useWeather()
  const description = data ? describeWeather(data.current.code) : null
  const label =
    city && data && description
      ? `Previsão do tempo em ${cityLabel(city)}: ${description.label}, ${Math.round(data.current.temp)} graus. Abrir`
      : city
        ? `Previsão do tempo em ${cityLabel(city)}. Abrir`
        : 'Previsão do tempo. Escolher a cidade'

  return (
    <button type="button" className="weather-button" onClick={onOpen} aria-label={label} title={description?.label ?? 'Previsão do tempo'}>
      <WeatherIcon kind={description?.kind ?? 'partly'} isDay={data?.current.isDay ?? true} size={34} />
    </button>
  )
}
