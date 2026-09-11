import { useParticipants } from '../hooks/useParticipants'
import type { ParticipantOverview } from '../types/panel'
import { EmptyState } from './EmptyState'

interface ParticipantsPanelProps {
  communityId: string
}

const JOIN_FMT = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' })

function joinedLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return JOIN_FMT.format(date).replace(/\.$/, '')
}

function activityLabel(iso: string | null): string {
  if (!iso) return 'sem atividade ainda'
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (diffDays <= 0) return 'ativa hoje'
  if (diffDays === 1) return 'ativa ontem'
  if (diffDays < 30) return `ativa há ${diffDays} dias`
  return `sem atividade há ${Math.floor(diffDays / 30)} mês(es)`
}

/**
 * Linha editorial plana (redesign): avatar circular + nome com hierarquia
 * (Mitr), metadados discretos (Jost) e pontos/desafios/dias em linha, com
 * os números em Mitr. Sem caixa, sem borda, sem sombra. Nenhum dado mudou.
 */
function ParticipantRow({ participant }: { participant: ParticipantOverview }) {
  const name = participant.full_name ?? 'Participante'
  return (
    <article className="panel-members-row">
      <div className="panel-members-avatar" aria-hidden="true">
        {participant.avatar_url ? (
          <img src={participant.avatar_url} alt="" />
        ) : (
          <span>{name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="panel-members-row-body">
        <p className="panel-members-name">{name}</p>
        <p className="panel-members-meta">
          Participa desde {joinedLabel(participant.joined_at)} ·{' '}
          {activityLabel(participant.last_activity_at)}
        </p>
        <p className="panel-members-figures">
          <span>
            <span className="panel-members-figure-num">{participant.balance}</span> pontos
          </span>
          <span>
            <span className="panel-members-figure-num">{participant.challenges_completed}</span>{' '}
            desafios
          </span>
          <span>
            <span className="panel-members-figure-num">{participant.challenge_days_done}</span> dias
          </span>
        </p>
      </div>
    </article>
  )
}

/**
 * Aba "Participantes" do painel da Nutri: visão consolidada das mulheres
 * ATIVAS da comunidade — foto grande, nome, desde quando participa,
 * atividade recente, pontos e desafios. Fonte: RPC
 * `community_participants_overview`. NÃO mostra humor individual (a RPC
 * nem consulta daily_mood_entries).
 */
export function ParticipantsPanel({ communityId }: ParticipantsPanelProps) {
  const { participants, loading, error } = useParticipants(communityId)

  if (loading) return <p className="home-muted">Carregando participantes...</p>
  if (error) return <p className="auth-error">Não foi possível carregar as participantes agora.</p>
  if (participants.length === 0) {
    return <EmptyState message="Ainda não há participantes ativas nesta comunidade." />
  }

  return (
    <div className="panel-members-active">
      <p className="panel-members-hint">
        {participants.length} participante{participants.length === 1 ? '' : 's'} ativa
        {participants.length === 1 ? '' : 's'}. O humor individual não é exibido — apenas os números
        agregados aparecem em Métricas.
      </p>
      <div className="panel-members-list">
        {participants.map((participant) => (
          <ParticipantRow key={participant.profile_id} participant={participant} />
        ))}
      </div>
    </div>
  )
}
