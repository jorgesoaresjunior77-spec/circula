import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronLeftIcon } from './icons'

interface PersonRow {
  id: string
  full_name: string | null
  avatar_url: string | null
  city: string | null
}

interface NewConversationProps {
  myProfileId: string
  onBack: () => void
  onPick: (profileId: string) => void
}

// Busca de pessoas: a RLS de `profiles` já limita o resultado a perfis
// de comunidade em comum (shares_active_community) — não é preciso RPC.
// Master é excluído explicitamente (não tem Mensagens).
export function NewConversation({ myProfileId, onBack, onPick }: NewConversationProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PersonRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    const handle = setTimeout(async () => {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id,full_name,avatar_url,city')
        .neq('id', myProfileId)
        .neq('role', 'master')
        .ilike('full_name', `%${term}%`)
        .order('full_name', { ascending: true })
        .limit(20)

      if (!active) return
      if (fetchError) {
        setError('Não foi possível buscar agora.')
        setResults([])
      } else {
        setError(null)
        setResults((data as PersonRow[] | null) ?? [])
      }
      setLoading(false)
    }, 250)

    return () => {
      active = false
      clearTimeout(handle)
    }
  }, [query, myProfileId])

  return (
    <div className="new-conversation">
      <header className="conversation-view-head">
        <button
          type="button"
          className="conversation-back"
          onClick={onBack}
          aria-label="Voltar"
        >
          <ChevronLeftIcon />
        </button>
        <span className="conversation-view-name">Nova conversa</span>
      </header>

      <div className="new-conversation-body">
        <input
          type="search"
          className="content-search"
          placeholder="Buscar por nome..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />

        {query.trim().length < 2 && (
          <p className="home-muted">Digite ao menos 2 letras do nome.</p>
        )}
        {loading && <p className="home-muted">Buscando...</p>}
        {error && <p className="auth-error">{error}</p>}
        {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
          <p className="home-muted">Ninguém encontrado na sua comunidade.</p>
        )}

        <ul className="new-conversation-results">
          {results.map((person) => {
            const name = person.full_name ?? 'Participante'
            return (
              <li key={person.id}>
                <button
                  type="button"
                  className="conversation-row"
                  onClick={() => onPick(person.id)}
                >
                  <span className="conversation-avatar" aria-hidden="true">
                    {person.avatar_url ? (
                      <img src={person.avatar_url} alt="" />
                    ) : (
                      <span>{name.charAt(0).toUpperCase()}</span>
                    )}
                  </span>
                  <span className="conversation-row-body">
                    <span className="conversation-row-name">{name}</span>
                    {person.city && (
                      <span className="conversation-row-text">{person.city}</span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
