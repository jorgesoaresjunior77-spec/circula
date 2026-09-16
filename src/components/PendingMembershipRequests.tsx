import { useState } from 'react'
import type { CommunityMember } from '../types/community'

interface PendingMembershipRequestsProps {
  communityId: string
  communityName: string
  members: CommunityMember[]
  onApprove: (communityId: string, profileId: string) => Promise<{ error: string | null }>
  onReject: (communityId: string, profileId: string) => Promise<{ error: string | null }>
  // Redesign de Comunidades (Fase 6): variant só troca a classe raiz
  // (App.css escopa por `.panel-members-pending--editorial`, sempre com
  // essa classe como ancestral) — CommunityMembersPanel (aba Painel,
  // outra tela) nunca passa variant, então mantém exatamente o visual
  // "véu rosé" de sempre. Nenhuma lógica (run/busy/errors/onApprove/
  // onReject) muda com a variant.
  variant?: 'panel' | 'editorial'
}

const REQUEST_FMT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function requestedLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return REQUEST_FMT.format(date).replace(/\.$/, '')
}

/**
 * Fase 12.3 — Professional revisa solicitações de entrada (`pending`) da
 * própria comunidade. Não faz nenhuma chamada nova nem checagem de
 * autorização no cliente: `members` já vem carregado (COMMUNITY_SELECT
 * já inclui community_members de qualquer status) e a aprovação/rejeição
 * chamam as RPCs `approve_membership_request` / `reject_membership_request`
 * (via useCommunity), que são as únicas a decidir se a chamadora pode.
 * Um erro delas (ex.: comunidade errada) só aparece como mensagem — a
 * segurança real está inteiramente no banco.
 *
 * Redesign editorial: cada solicitação vira uma linha plana; o bloco é
 * embrulhado no véu rosé pelo componente pai (CommunityMembersPanel).
 * Nenhuma lógica (run/busy/errors/onApprove/onReject) ou estado mudou.
 */
export function PendingMembershipRequests({
  communityId,
  communityName,
  members,
  onApprove,
  onReject,
  variant = 'panel',
}: PendingMembershipRequestsProps) {
  const pending = members.filter((member) => member.status === 'pending')
  const [busy, setBusy] = useState<{ profileId: string; action: 'approve' | 'reject' } | null>(
    null,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function run(profileId: string, action: 'approve' | 'reject') {
    setBusy({ profileId, action })
    setErrors((prev) => ({ ...prev, [profileId]: '' }))

    const { error } = action === 'approve'
      ? await onApprove(communityId, profileId)
      : await onReject(communityId, profileId)

    setBusy(null)

    if (error) {
      setErrors((prev) => ({
        ...prev,
        [profileId]:
          action === 'approve'
            ? 'Não foi possível aprovar agora. Tente novamente.'
            : 'Não foi possível rejeitar agora. Tente novamente.',
      }))
    }
    // sucesso: useCommunity já reconsulta as comunidades (fetchCommunities)
    // depois da RPC — a lista de pendentes reflete o novo estado sozinha.
  }

  if (pending.length === 0) return null

  return (
    <section
      className={`panel-members-pending${
        variant === 'editorial' ? ' panel-members-pending--editorial' : ''
      }`}
    >
      <p className="section-label">Solicitações pendentes ({pending.length})</p>

      <div className="panel-members-list">
        {pending.map((member) => {
          const profileId = member.profile?.id
          if (!profileId) return null

          const name = member.profile?.full_name ?? 'Mulher do Círcula'
          const rowBusy = busy?.profileId === profileId ? busy.action : null
          const error = errors[profileId]

          return (
            <article key={member.id} className="panel-members-row">
              <div className="panel-members-avatar" aria-hidden="true">
                {member.profile?.avatar_url ? (
                  <img src={member.profile.avatar_url} alt="" />
                ) : (
                  <span>{name.charAt(0).toUpperCase()}</span>
                )}
              </div>

              <div className="panel-members-row-body">
                <p className="panel-members-name">{name}</p>
                <p className="panel-members-meta">
                  {communityName} · Solicitado em {requestedLabel(member.joined_at)}
                </p>
                {error && <p className="auth-error">{error}</p>}
              </div>

              <div className="panel-members-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => run(profileId, 'approve')}
                  disabled={rowBusy !== null}
                >
                  {rowBusy === 'approve' ? 'Aprovando...' : 'Aprovar'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => run(profileId, 'reject')}
                  disabled={rowBusy !== null}
                >
                  {rowBusy === 'reject' ? 'Rejeitando...' : 'Rejeitar'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
