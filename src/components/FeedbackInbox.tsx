import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatRelativeTime } from '../lib/formatRelativeTime'

// Painel → Problemas e sugestões: o que as participantes enviaram pelo botão do fim do Início.

interface Item {
  id: string
  tipo: 'problema' | 'sugestao'
  texto: string
  lido: boolean
  criado_em: string
  nome: string
}

export function FeedbackInbox({ onChanged }: { onChanged?: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('feedback_list')
    if (rpcError) setError('Não foi possível carregar agora.')
    else {
      setError(null)
      setItems((data ?? []) as Item[])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('feedback_list').then(({ data, error: rpcError }) => {
      if (cancelled) return
      if (rpcError) setError('Não foi possível carregar agora.')
      else setItems((data ?? []) as Item[])
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function mark(id: string, lido: boolean) {
    await supabase.rpc('feedback_mark', { p_id: id, p_lido: lido })
    await load()
    onChanged?.()
  }

  return (
    <div className="cty-admin">
      <h3 className="cty-form-title">Problemas e sugestões</h3>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {!items && !error && <p className="home-muted">Carregando…</p>}
      {items && items.length === 0 && <p className="home-muted">Nada por enquanto.</p>}
      {items?.map((f) => (
        <article key={f.id} className={`cty-admin-item feedback-item${f.lido ? ' feedback-item--lido' : ''}`}>
          <p>
            <strong>{f.tipo === 'problema' ? 'Problema' : 'Sugestão'}</strong> · {f.nome} · {formatRelativeTime(f.criado_em)}
            {!f.lido && <span className="notif-dot notif-dot--mini feedback-dot" aria-label="Novo" />}
          </p>
          <p className="feedback-text">{f.texto}</p>
          <div className="cty-actions">
            <button type="button" className="cty-btn cty-btn--small" onClick={() => void mark(f.id, !f.lido)}>
              {f.lido ? 'Marcar como novo' : 'Marcar como lido'}
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
