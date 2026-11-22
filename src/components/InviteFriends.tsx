import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildInviteUrl } from '../lib/inviteToken'
import { useIsPremiumMember } from '../hooks/useIsPremiumMember'
import { InviteMessageComposer } from './CommunityInviteWhatsApp'

// Convidar amigas para o Círcula pelo WhatsApp, com o mesmo link de convite
// da comunidade. O app nunca envia nada sozinho: abre o WhatsApp com a
// mensagem pronta e o envio é da própria membro.

/** Carrega o link e mostra o compositor de mensagem. `circleName` faz o convite falar daquele Círculo. */
export function MemberInvitePanel({ communityId, circleName }: { communityId: string; circleName?: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { premium, uid } = useIsPremiumMember(communityId)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('get_member_invite_link', { p_community_id: communityId }).then(({ data, error: rpcError }) => {
      if (cancelled) return
      setLoading(false)
      if (rpcError) {
        setError('Não foi possível carregar o convite agora. Tente de novo.')
        return
      }
      if (typeof data === 'string' && data) setToken(data)
      else setError('O convite está desativado no momento. Fale com a nutri.')
    })
    return () => {
      cancelled = true
    }
  }, [communityId])

  // Só quem tem o Premium leva o próprio id no link (é o que dá o desconto à convidada).
  const url = token ? buildInviteUrl(token, premium ? uid : null) : null

  return (
    <div className="invite-panel">
      {loading && <p className="home-muted">Preparando o convite…</p>}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {url && (
        <InviteMessageComposer
          key={`${premium}:${url}`}
          communityName="Círcula"
          inviteUrl={url}
          circleName={circleName}
          premiumBonus={premium}
        />
      )}
    </div>
  )
}

export function InviteFriends({ communityId }: { communityId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <section className="invite-friends" aria-label="Convidar amigas">
      <button type="button" className="water-primary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? 'Fechar convite' : 'Convidar amigas para o Círcula'}
      </button>
      {open && <MemberInvitePanel communityId={communityId} />}
    </section>
  )
}
