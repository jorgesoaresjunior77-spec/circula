import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { BASE_BLOCKED_TERMS } from '../lib/moderation'

// Lista de termos bloqueados da comunidade (somados à lista base). A dona
// acrescenta ou tira termos; publicações e comentários com esses termos não
// são publicados (o app avisa com educação e o banco repete a regra).
interface Term {
  id: string
  term: string
}

export function BlockedTermsManager({ communityId }: { communityId: string }) {
  const [terms, setTerms] = useState<Term[]>([])
  const [input, setInput] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('blocked_terms').select('id, term').eq('community_id', communityId).order('term')
    setTerms((data ?? []) as Term[])
  }, [communityId])

  useEffect(() => {
    void load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    const term = input.trim()
    if (term.length < 2) return setMessage('Escreva pelo menos 2 letras.')
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.from('blocked_terms').insert({ community_id: communityId, term })
    setBusy(false)
    if (error) return setMessage(error.code === '23505' ? 'Esse termo já está na lista.' : 'Não foi possível adicionar agora.')
    setInput('')
    void load()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('blocked_terms').delete().eq('id', id)
    if (error) setMessage('Não foi possível remover agora.')
    else void load()
  }

  return (
    <section className="blocked-terms" aria-label="Termos bloqueados">
      <h3>Palavras bloqueadas</h3>
      <p className="home-muted">
        Já bloqueamos {BASE_BLOCKED_TERMS.length} palavrões e ofensas comuns, inclusive escritos com números, pontos ou
        espaços. Acrescente aqui o que mais quiser impedir na sua comunidade.
      </p>
      <form className="blocked-terms-form" onSubmit={(e) => void add(e)}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Novo termo" aria-label="Novo termo bloqueado" maxLength={60} />
        <button type="submit" disabled={busy}>
          Adicionar
        </button>
      </form>
      {message && <p className="auth-error">{message}</p>}
      <ul className="blocked-terms-list">
        {terms.map((t) => (
          <li key={t.id}>
            <span>{t.term}</span>
            <button type="button" className="own-menu-btn" onClick={() => void remove(t.id)}>
              Remover
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
