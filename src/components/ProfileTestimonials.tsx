import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

// Depoimentos: uma membro escreve para outra, e o texto fica na capa do
// perfil de quem recebeu. Um depoimento por pessoa (pode apagar e reescrever).
// Quem recebeu pode tirar da própria capa; quem escreveu pode apagar o seu.

interface Testimonial {
  id: string
  author_id: string
  content: string
  created_at: string
  author: { full_name: string | null; avatar_url: string | null } | null
}

interface Props {
  /** Dona do perfil (quem recebe os depoimentos). */
  profileId: string
  communityId: string | null
  /** Quem está olhando. */
  viewerId: string | null
  /** Conteúdo (cards, fotos) mostrado entre o botão de depoimento e a lista. */
  between?: ReactNode
}

const MAX = 600

export function ProfileTestimonials({ profileId, communityId, viewerId, between }: Props) {
  const [items, setItems] = useState<Testimonial[]>([])
  const [loaded, setLoaded] = useState(false)
  const [text, setText] = useState('')
  const [writing, setWriting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!communityId) return
    const { data } = await supabase
      .from('profile_testimonials')
      .select('id,author_id,content,created_at,author:profiles!profile_testimonials_author_id_fkey(full_name,avatar_url)')
      .eq('community_id', communityId)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(30)
    setItems((data as unknown as Testimonial[] | null) ?? [])
    setLoaded(true)
  }, [communityId, profileId])

  useEffect(() => {
    void load()
  }, [load])

  if (!communityId) return null

  const isOwnProfile = viewerId === profileId
  const mine = items.find((t) => t.author_id === viewerId) ?? null
  const canWrite = !!viewerId && !isOwnProfile && !mine

  async function submit(e: FormEvent) {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase
      .from('profile_testimonials')
      .insert({ community_id: communityId, profile_id: profileId, content })
    setBusy(false)
    if (insertError) {
      setError('Não foi possível enviar agora. Tente novamente.')
      return
    }
    setText('')
    setWriting(false)
    void load()
  }

  async function removeItem(id: string) {
    setBusy(true)
    const { error: deleteError } = await supabase.from('profile_testimonials').delete().eq('id', id)
    setBusy(false)
    if (deleteError) setError('Não foi possível apagar agora.')
    else void load()
  }

  if (!loaded) return <>{between}</>
  if (items.length === 0 && !canWrite) {
    return (
      <>
        {between}
        {isOwnProfile && (
          <div className="testimonials">
            <p className="profile-section-label profile-testimonials-label">Depoimentos</p>
            <p className="home-muted">
              Quando outra participante escrever um depoimento para você, ele aparece aqui, na sua capa.
            </p>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {(canWrite || error) && (
        <div className="testimonials testimonials--write">
      {canWrite && !writing && (
        <button type="button" className="btn btn-primary testimonial-write" onClick={() => setWriting(true)}>
          Deixar depoimento
        </button>
      )}

      {canWrite && writing && (
        <form className="testimonial-form" onSubmit={(e) => void submit(e)}>
          <label htmlFor="testimonial-text">Seu depoimento</label>
          <textarea
            id="testimonial-text"
            rows={4}
            maxLength={MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Conte algo bonito sobre ela. Seu texto fica na capa do perfil dela."
          />
          <p className="home-muted">
            {text.length}/{MAX}
          </p>
          <div className="testimonial-form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
              {busy ? 'Enviando...' : 'Publicar depoimento'}
            </button>
            <button type="button" className="auth-link" onClick={() => setWriting(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && <p className="auth-error">{error}</p>}
        </div>
      )}

      {between}

      {items.length > 0 && (
        <div className="testimonials">
          <p className="profile-section-label">Depoimentos</p>
        {items.length > 0 && (
          <ul className="testimonials-list">
            {items.map((t) => {
              const name = t.author?.full_name ?? 'Participante'
              const canRemove = t.author_id === viewerId || isOwnProfile
              return (
                <li key={t.id} className="testimonial">
                  <span className="testimonial-avatar" aria-hidden="true">
                    {t.author?.avatar_url ? (
                      <img src={t.author.avatar_url} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <span>{name.charAt(0).toUpperCase()}</span>
                    )}
                  </span>
                  <div className="testimonial-body">
                    <p className="testimonial-text">“{t.content}”</p>
                    <p className="testimonial-author">
                      {name}
                      {canRemove && (
                        <button
                          type="button"
                          className="auth-link testimonial-remove"
                          disabled={busy}
                          onClick={() => void removeItem(t.id)}
                        >
                          {isOwnProfile && t.author_id !== viewerId ? 'Tirar da minha capa' : 'Apagar'}
                        </button>
                      )}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        </div>
      )}
    </>
  )
}
