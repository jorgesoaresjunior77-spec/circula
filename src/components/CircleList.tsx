import { useState } from 'react'
import type { CircleWithMembers, JoinCircleResult } from '../types/circle'
import { CircleCard } from './CircleCard'
import { EmptyState } from './EmptyState'

type CircleFilter = 'todos' | 'meus' | 'novos'

interface CircleListProps {
  circles: CircleWithMembers[]
  loading: boolean
  error: string | null
  profileId: string
  /** Nome da comunidade — mostrado só quando há mais de uma opção. */
  communityName?: string
  /** Trocar a comunidade cujos círculos são listados (multi-comunidade). */
  onChangeCommunity?: () => void
  onOpenCircle: (circleId: string) => void
  onJoin: (circleId: string) => Promise<JoinCircleResult>
  onLeave: (circleId: string) => Promise<JoinCircleResult>
}

const FILTERS: { key: CircleFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'meus', label: 'Meus' },
  { key: 'novos', label: 'Novos' },
]

const byNameAsc = (a: CircleWithMembers, b: CircleWithMembers) =>
  a.name.localeCompare(b.name, 'pt-BR')

const byCreatedDesc = (a: CircleWithMembers, b: CircleWithMembers) =>
  b.created_at.localeCompare(a.created_at)

export function CircleList({
  circles,
  loading,
  error,
  profileId,
  communityName,
  onChangeCommunity,
  onOpenCircle,
  onJoin,
  onLeave,
}: CircleListProps) {
  const [filter, setFilter] = useState<CircleFilter>('todos')

  function isMember(circle: CircleWithMembers) {
    return circle.members.some((member) => member.profile_id === profileId)
  }

  let visible: CircleWithMembers[]
  if (filter === 'meus') {
    visible = circles.filter(isMember).slice().sort(byNameAsc)
  } else if (filter === 'novos') {
    visible = circles.slice().sort(byCreatedDesc)
  } else {
    visible = circles.slice().sort(byNameAsc)
  }

  return (
    <section className="circle-list">
      <div className="circle-list-head">
        <p className="section-label">
          Círculos{communityName ? ` · ${communityName}` : ''}
        </p>
        {onChangeCommunity && (
          <button type="button" className="auth-link" onClick={onChangeCommunity}>
            Trocar comunidade
          </button>
        )}
      </div>

      <div className="circle-list-filters" role="tablist" aria-label="Filtrar círculos">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={filter === item.key}
            className={`circle-list-filter${filter === item.key ? ' circle-list-filter--active' : ''}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && <p>Carregando círculos...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && visible.length === 0 && (
        <EmptyState
          message={
            filter === 'meus'
              ? 'Você ainda não participa de nenhum círculo.'
              : 'Nenhum círculo nesta comunidade ainda.'
          }
        />
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="circle-list-items">
          {visible.map((circle) => (
            <CircleCard
              key={circle.id}
              circle={circle}
              isParticipating={isMember(circle)}
              canParticipate
              onJoin={() => onJoin(circle.id)}
              onLeave={() => onLeave(circle.id)}
              onOpen={() => onOpenCircle(circle.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
