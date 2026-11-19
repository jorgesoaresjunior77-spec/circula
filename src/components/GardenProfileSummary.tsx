import { useGardenMonth } from '../hooks/useGardenMonth'
import { MONTH_NAMES, MonthFlower, YearTree } from './GardenArt'

// Resumo do Meu Jardim dentro do perfil: flor do mês e árvore do ano.
export function GardenProfileSummary({
  communityId,
  profileId,
}: {
  communityId: string
  profileId: string
}) {
  const g = useGardenMonth(communityId, profileId)
  if (g.loading) return <p className="home-muted">Carregando…</p>
  const cur = g.current
  const monthsDone = Array.from({ length: 12 }, (_, i) => {
    const m = g.months.find((x) => x.month === i + 1)
    return !!m && g.monthDone(m)
  })
  return (
    <div className="garden-profile-summary">
      <div className="garden-glass-card">
        {cur && <p className="garden-flower-title">Mês de {MONTH_NAMES[cur.month - 1]}</p>}
        {cur ? (
          <MonthFlower days={cur.days} checked={g.checkedDays(cur.id)} month={cur.month} />
        ) : (
          <p className="home-muted">Sem desafio neste mês.</p>
        )}
      </div>
      <hr className="garden-divider" aria-hidden="true" />
      <div className="garden-glass-card">
        <p className="garden-flower-title">Ano de flores</p>
        <YearTree monthsDone={monthsDone} />
      </div>
    </div>
  )
}
