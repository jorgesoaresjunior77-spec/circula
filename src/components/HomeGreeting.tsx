// Saudação da Home ("Bom dia, Nome / Seu Círcula de hoje"). Fica numa peça
// própria porque, quando a comunidade tem banner, o Dashboard a desenha
// ACIMA do banner; sem banner, a HomeToday a desenha no topo da Home.

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

export function HomeGreeting({ fullName }: { fullName: string | null | undefined }) {
  const name = firstName(fullName)
  return (
    <header className="home-greeting">
      <div className="home-greeting-text">
        <h2 className="home-greeting-title">
          {timeGreeting()}
          {name ? `, ${name}` : ''}
        </h2>
        <p className="home-greeting-sub">Seu Círcula de hoje</p>
      </div>
      {/* A frase do dia (DailyInspiration) aparece aqui, em balão. */}
      <div id="daily-bubble-slot" className="home-greeting-slot" />
    </header>
  )
}
