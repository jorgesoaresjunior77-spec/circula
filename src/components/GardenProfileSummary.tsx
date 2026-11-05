import { useGardenMonth } from '../hooks/useGardenMonth'
import { MonthFlower, YearTree } from './GardenArt'

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
      {cur ? (
        <MonthFlower days={cur.days} checked={g.checkedDays(cur.id)} />
      ) : (
        <p className="home-muted">Sem desafio neste mês.</p>
      )}
      <YearTree monthsDone={monthsDone} />
    </div>
  )
}
