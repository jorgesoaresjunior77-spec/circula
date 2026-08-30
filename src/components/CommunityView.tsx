import { useState } from 'react'
import type { CommunityWithMembers, JoinResult } from '../types/community'

interface CommunityViewProps {
  community: CommunityWithMembers
  memberCount?: number
  badge?: string
  onJoin?: () => Promise<JoinResult>
}

interface HeroStat {
  key: string
  value: string
  label: string
}

/**
 * Indicadores do hero, todos derivados de dados que o componente já
 * recebe (prop memberCount) ou que já vêm carregados em
 * community.community_members / community.created_at. Nenhuma chamada
 * nova ao Supabase, nenhum número inventado — se um dado não existir,
 * o indicador simplesmente não entra na faixa.
 */
function buildStats(community: CommunityWithMembers, memberCount?: number): HeroStat[] {
  const members = community.community_members ?? []
  const totalMembers = memberCount ?? members.length

  const now = new Date()
  const newThisMonth = members.filter((member) => {
    const joined = new Date(member.joined_at)
    return (
      !Number.isNaN(joined.getTime()) &&
      joined.getFullYear() === now.getFullYear() &&
      joined.getMonth() === now.getMonth()
    )
  }).length

  const founded = new Date(community.created_at)
  const foundedYear = founded.getFullYear()

  const stats: HeroStat[] = []

  if (totalMembers > 0) {
    stats.push({
      key: 'members',
      value: totalMembers.toLocaleString('pt-BR'),
      label: totalMembers === 1 ? 'mulher' : 'mulheres',
    })
  }

  if (newThisMonth > 0) {
    stats.push({
      key: 'new',
      value: newThisMonth.toLocaleString('pt-BR'),
      label: newThisMonth === 1 ? 'nova no mês' : 'novas no mês',
    })
  }

  if (!Number.isNaN(founded.getTime()) && Number.isFinite(foundedYear)) {
    stats.push({ key: 'since', value: String(foundedYear), label: 'desde' })
  }

  return stats
}

export function CommunityView({ community, memberCount, badge, onJoin }: CommunityViewProps) {
  const [joining, setJoining] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  )

  async function handleJoin() {
    if (!onJoin) return

    setJoining(true)
    setMessage(null)

    const result = await onJoin()

    setJoining(false)

    if (result.status === 'already_member') {
      setMessage({ type: 'error', text: 'Você já participa desta comunidade.' })
    } else if (result.status === 'error') {
      setMessage({ type: 'error', text: 'Não foi possível entrar agora. Tente novamente.' })
    }
  }

  const stats = buildStats(community, memberCount)

  return (
    <section className="community-card community-card--highlight community-hero">
      <div className="community-hero-cover" aria-hidden="true" />

      <div className="community-hero-body">
        <div className="community-hero-headline">
          <div className="community-avatar" aria-hidden="true">
            {community.name.charAt(0).toUpperCase()}
          </div>
          <div className="community-hero-titles">
            {badge && <span className="community-badge">{badge}</span>}
            {!badge && onJoin && (
              <span className="community-badge community-badge--outline">
                Disponível para descobrir
              </span>
            )}
            <h2 className="community-hero-name">{community.name}</h2>
          </div>
        </div>

        {community.description && (
          <div className="community-hero-about">
            <p className="community-hero-about-label">Sobre a comunidade</p>
            <p className="community-hero-description">{community.description}</p>
          </div>
        )}

        {stats.length > 0 && (
          <div className="community-hero-stats">
            {stats.map((stat) => (
              <div key={stat.key} className="community-hero-stat">
                <span className="community-hero-stat-value">{stat.value}</span>
                <span className="community-hero-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        )}

        {onJoin && (
          <div className="community-hero-actions">
            {message && (
              <p className={message.type === 'success' ? 'auth-success' : 'auth-error'}>
                {message.text}
              </p>
            )}
            <button type="button" onClick={handleJoin} disabled={joining}>
              {joining ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
