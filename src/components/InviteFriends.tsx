import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildInviteUrl } from '../lib/inviteToken'
import { InviteMessageComposer } from './CommunityInviteWhatsApp'

// Meu perfil (membro): convidar amigas para o Círcula pelo WhatsApp, com o
// mesmo link de convite da comunidade. O app nunca envia nada sozinho: abre o
// WhatsApp com a mensagem pronta e o envio é da própria membro.
export function InviteFriends({ communityId }: { communityId: string }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (url) return
    setLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('get_member_invite_link', { p_community_id: communityId })
    setLoading(false)
    if (rpcError) {
      setError('Não foi possível carregar o convite agora. Tente de novo.')
      return
    }
    if (typeof data === 'string' && data) setUrl(buildInviteUrl(data))
    else setError('O convite está desativado no momento. Fale com a nutri.')
  }

  return (
    <section className="invite-friends" aria-label="Convidar amigas">
      <button type="button" className="water-primary" onClick={() => void toggle()} aria-expanded={open}>
        {open ? 'Fechar convite' : 'Convidar amigas para o Círcula'}
      </button>
      {open && loading && <p className="home-muted">Preparando o convite…</p>}
      {open && error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {open && url && <InviteMessageComposer communityName="Círcula" inviteUrl={url} />}
    </section>
  )
}
