import { useState } from 'react'
import { ParticipantsPanel } from './ParticipantsPanel'
import { PendingMembershipRequests } from './PendingMembershipRequests'
import { EmptyState } from './EmptyState'
import type { CommunityMember, CommunityWithMembers } from '../types/community'

// 16.2.3-D — aba "Participantes" com filtro por status.
//
// NÃO cria fonte de dados nova:
//   • "Ativas"  -> ParticipantsPanel (RPC community_participants_overview,
//                 dados ricos, sem humor individual) — inalterado.
//   • "Pendentes" / "Bloqueadas" -> community.community_members, que o
//                 useCommunity já carrega (RLS community_members_select já
//                 libera todos os status para a dona).
// Aprovar/rejeitar continua 100% nas RPCs approve/reject_membership_request
// (via as props onApprove/onReject, iguais às da 16.2.3-C).
//
// Redesign editorial: seções planas, sem card dentro de card; véu rosé
// só na zona de pendências. Nenhum dado, hook, ação, estado ou guard de
// renderização mudou — só markup/classes.

type MemberFilter = 'todas' | 'ativas' | 'pendentes' | 'bloqueadas'

const FILTERS: { key: MemberFilter; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'ativas', label: 'Ativas' },
  { key: 'pendentes', label: 'Pendentes' },
  { key: 'bloqueadas', label: 'Bloqueadas' },
]

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function dateLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return DATE_FMT.format(date).replace(/\.$/, '')
}

interface CommunityMembersPanelProps {
  communityId: string
  community: CommunityWithMembers
  onApprove: (communityId: string, profileId: string) => Promise<{ error: string | null }>
  onReject: (communityId: string, profileId: string) => Promise<{ error: string | null }>
}

/** Linha somente-leitura para membros bloqueados: avatar, nome, data, status. */
function BlockedMemberCard({ member }: { member: CommunityMember }) {
  const name = member.profile?.full_name ?? 'Participante'
  return (
    <article className="panel-members-row">
      <div className="panel-members-avatar" aria-hidden="true">
        {member.profile?.avatar_url ? (
          <img src={member.profile.avatar_url} alt="" />
        ) : (
          <span>{name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="panel-members-row-body">
        <p className="panel-members-name">{name}</p>
        <p className="panel-members-meta">Entrou em {dateLabel(member.joined_at)}</p>
      </div>
      <span className="panel-community-badge panel-community-badge--blocked">Bloqueada</span>
    </article>
  )
}

export function CommunityMembersPanel({
  communityId,
  community,
  onApprove,
  onReject,
}: CommunityMembersPanelProps) {
  const [filter, setFilter] = useState<MemberFilter>('todas')

  const pending = community.community_members.filter((m) => m.status === 'pending')
  const blocked = community.community_members.filter((m) => m.status === 'blocked')

  const showActive = filter === 'todas' || filter === 'ativas'
  const showPending = filter === 'todas' || filter === 'pendentes'
  const showBlocked = filter === 'todas' || filter === 'bloqueadas'

  return (
    <div className="panel-members">
      <header className="panel-members-head">
        <p className="panel-members-eyebrow">Painel · Participantes</p>
        <p className="panel-members-lede">
          Quem faz parte da sua comunidade — e quem está esperando para entrar.
        </p>
      </header>

      <div
        className="panel-members-filter"
        role="group"
        aria-label="Filtrar participantes por status"
      >
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`panel-members-filter-btn${
              filter === option.key ? ' panel-members-filter-btn--active' : ''
            }`}
            onClick={() => setFilter(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {showActive && (
        <section className="panel-members-section">
          {filter === 'todas' && <p className="section-label">Ativas</p>}
          <ParticipantsPanel communityId={communityId} />
        </section>
      )}

      {showPending && (pending.length > 0 || filter === 'pendentes') && (
        <section className="panel-members-section">
          {pending.length > 0 && (
            <div className="panel-members-attention">
              <PendingMembershipRequests
                communityId={community.id}
                communityName={community.name}
                members={community.community_members}
                onApprove={onApprove}
                onReject={onReject}
              />
            </div>
          )}
          {filter === 'pendentes' && pending.length === 0 && (
            <EmptyState message="Nenhuma solicitação de entrada pendente." />
          )}
        </section>
      )}

      {showBlocked && (blocked.length > 0 || filter === 'bloqueadas') && (
        <section className="panel-members-section">
          <p className="section-label">Bloqueadas ({blocked.length})</p>
          {blocked.length === 0 ? (
            <EmptyState message="Nenhuma participante bloqueada." />
          ) : (
            <div className="panel-members-list">
              {blocked.map((member) => (
                <BlockedMemberCard key={member.id} member={member} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
