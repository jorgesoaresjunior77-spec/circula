import { useFollow, useMyVisitTotals } from '../hooks/useFollow'

// No perfil da própria membro: quantas pessoas visitaram o perfil hoje, nos
// últimos 7 dias e nos últimos 30, e quantas a seguem.
export function ProfileVisitStats({ profileId }: { profileId: string }) {
  const totals = useMyVisitTotals()
  const { followers } = useFollow(null, profileId)
  const items = [
    { label: 'visitas hoje', value: totals?.today },
    { label: 'na semana', value: totals?.week },
    { label: 'no mês', value: totals?.month },
    { label: followers === 1 ? 'seguidora' : 'seguidoras', value: followers },
  ]
  return (
    <div className="profile-visit-stats" aria-label="Visitas ao seu perfil">
      {items.map((it) => (
        <div key={it.label} className="profile-visit-stat">
          <strong>{it.value ?? '–'}</strong>
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  )
}
