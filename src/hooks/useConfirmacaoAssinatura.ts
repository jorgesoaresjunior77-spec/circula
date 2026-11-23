import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Avisa quando uma assinatura é CONFIRMADA de verdade: o servidor liberou o acesso (novo
// pacote em member_package_access) ou a assinatura do Círcula passou a "active". Nunca pelo
// clique em "assinar": o pagamento acontece na fatura do Asaas, em outra aba, e o acesso só
// é liberado quando o pagamento é confirmado.
//
// Tira uma foto do que a pessoa já tinha ao abrir a página e, enquanto `aguardando` for true
// (depois que ela abriu uma fatura), confere de novo a cada 6 s e quando volta para a aba.

export interface Confirmacao {
  /** Identifica esta assinatura (vale uma comemoração só). */
  chave: string
  /** 'pacote' (avulso ou Premium) ou 'circula'. */
  tipo: 'pacote' | 'circula'
  pacote?: string
}

interface Foto {
  pacotes: Set<string>
  circulaAtiva: boolean
}

async function tirarFoto(communityId: string, profileId: string): Promise<Foto | null> {
  try {
    const [pk, sub] = await Promise.all([
      supabase.from('member_package_access').select('package').eq('community_id', communityId).eq('profile_id', profileId),
      supabase
        .from('subscriptions')
        .select('status')
        .eq('subject', 'community')
        .eq('community_id', communityId)
        .neq('status', 'canceled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (pk.error) return null
    return {
      pacotes: new Set(((pk.data as { package: string }[] | null) ?? []).map((r) => r.package)),
      circulaAtiva: (sub.data as { status?: string } | null)?.status === 'active',
    }
  } catch {
    return null
  }
}

/** Compara a foto de antes com a de agora e devolve o que foi confirmado entre as duas. */
export function novasConfirmacoes(antes: Foto, agora: Foto, communityId: string): Confirmacao[] {
  const saida: Confirmacao[] = []
  for (const p of agora.pacotes) {
    if (!antes.pacotes.has(p)) saida.push({ chave: `${communityId}:pacote:${p}`, tipo: 'pacote', pacote: p })
  }
  if (agora.circulaAtiva && !antes.circulaAtiva) saida.push({ chave: `${communityId}:circula`, tipo: 'circula' })
  return saida
}

export function useConfirmacaoAssinatura({
  communityId,
  profileId,
  aguardando,
  onConfirmada,
}: {
  communityId: string | null
  profileId: string | null
  aguardando: boolean
  onConfirmada: (c: Confirmacao) => void
}) {
  const base = useRef<Foto | null>(null)
  const callback = useRef(onConfirmada)
  useEffect(() => {
    callback.current = onConfirmada
  }, [onConfirmada])

  // Foto inicial (o que a pessoa já tinha ao abrir a página).
  useEffect(() => {
    if (!communityId || !profileId) return
    let ativo = true
    void tirarFoto(communityId, profileId).then((f) => {
      if (ativo && f && !base.current) base.current = f
    })
    return () => {
      ativo = false
    }
  }, [communityId, profileId])

  // Depois de abrir uma fatura: confere de novo enquanto espera.
  useEffect(() => {
    if (!aguardando || !communityId || !profileId) return
    let ativo = true
    async function conferir() {
      const agora = await tirarFoto(communityId as string, profileId as string)
      if (!ativo || !agora) return
      if (!base.current) {
        base.current = agora
        return
      }
      const novas = novasConfirmacoes(base.current, agora, communityId as string)
      if (novas.length > 0) {
        base.current = agora
        novas.forEach((c) => callback.current(c))
      }
    }
    const id = window.setInterval(() => void conferir(), 6000)
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void conferir()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', aoVoltar)
    return () => {
      ativo = false
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', aoVoltar)
    }
  }, [aguardando, communityId, profileId])
}
