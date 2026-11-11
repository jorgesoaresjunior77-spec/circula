// Saudação da Home ("Bom dia, Nome / Seu Círcula de hoje"). Fica numa peça
// própria porque, quando a comunidade tem banner, o Dashboard a desenha
// ACIMA do banner; sem banner, a HomeToday a desenha no topo da Home.

import { WeatherButton } from './WeatherButton'

export function timeGreeting(now = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function firstName(fullName: string | null | undefined): string | null {
  const name = (fullName ?? '').trim().split(/\s+/)[0]
  return name || null
}

export function HomeGreeting({
  fullName,
  onOpenWeather,
}: {
  fullName: string | null | undefined
  /** Abre a página da previsão do tempo; sem isto o ícone não aparece. */
  onOpenWeather?: () => void
}) {
  const name = firstName(fullName)
  return (
    <header className="home-greeting">
      <div className="home-greeting-row">
        <div className="home-greeting-text">
          <h2 className="home-greeting-title">
            {timeGreeting()}
            {name ? `, ${name}` : ''}
          </h2>
          <p className="home-greeting-sub">Seu Círcula de hoje</p>
        </div>
        {onOpenWeather && <WeatherButton onOpen={onOpenWeather} />}
      </div>
    </header>
  )
}
