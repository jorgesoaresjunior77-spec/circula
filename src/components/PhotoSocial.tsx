import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { HeartIcon } from './icons'

// Curtir e comentar uma foto da galeria do perfil. Aparece dentro da foto
// ampliada. A foto é identificada pela dona do perfil + o endereço da imagem.
// Quem pode ver/curtir/comentar é quem já pode ver o perfil (regra no banco).

interface PhotoComment {
  id: string
  author_id: string
  content: string
  created_at: string
  author: { full_name: string | null; avatar_url: string | null } | null
}

interface PhotoSocialProps {
  /** Dona da foto (perfil visitado). */
  ownerId: string
  photoUrl: string
  /** Quem está olhando. */
  viewerId: string
}

export function PhotoSocial({ ownerId, photoUrl, viewerId }: PhotoSocialProps) {
  const [likes, setLikes] = useState<string[]>([])
  const [comments, setComments] = useState<PhotoComment[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [l, c] = await Promise.all([
      supabase.from('profile_photo_likes').select('profile_id').eq('owner_id', ownerId).eq('photo_url', photoUrl).limit(500),
      supabase
        .from('profile_photo_comments')
        .select('id,author_id,content,created_at,author:profiles!profile_photo_comments_author_id_fkey(full_name,avatar_url)')
        .eq('owner_id', ownerId)
        .eq('photo_url', photoUrl)
        .order('created_at', { ascending: true })
        .limit(100),
    ])
    setLikes(((l.data as { profile_id: string }[] | null) ?? []).map((r) => r.profile_id))
    setComments((c.data as unknown as PhotoComment[] | null) ?? [])
  }, [ownerId, photoUrl])

  useEffect(() => {
    setLikes([])
    setComments([])
    void load()
  }, [load])

  const liked = likes.includes(viewerId)

  async function toggleLike() {
    if (busy) return
    setBusy(true)
    setError(null)
    const { error: likeError } = liked
      ? await supabase
          .from('profile_photo_likes')
          .delete()
          .eq('owner_id', ownerId)
          .eq('photo_url', photoUrl)
          .eq('profile_id', viewerId)
      : await supabase.from('profile_photo_likes').insert({ owner_id: ownerId, photo_url: photoUrl })
    setBusy(false)
    if (likeError) setError('Não foi possível curtir agora.')
    else void load()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const content = text.trim()
    if (!content || busy) return
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase
      .from('profile_photo_comments')
      .insert({ owner_id: ownerId, photo_url: photoUrl, content })
    setBusy(false)
    if (insertError) {
      setError('Não foi possível comentar agora.')
      return
    }
    setText('')
    void load()
  }

  async function removeComment(id: string) {
    setBusy(true)
    const { error: deleteError } = await supabase.from('profile_photo_comments').delete().eq('id', id)
    setBusy(false)
    if (deleteError) setError('Não foi possível apagar agora.')
    else void load()
  }

  return (
    <div className="photo-social" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={`photo-social-like${liked ? ' photo-social-like--on' : ''}`}
        onClick={() => void toggleLike()}
        disabled={busy}
        aria-pressed={liked}
      >
        <HeartIcon size={16} /> {likes.length} {likes.length === 1 ? 'curtida' : 'curtidas'}
      </button>

      {comments.length > 0 && (
        <ul className="photo-social-comments">
          {comments.map((c) => (
            <li key={c.id}>
              <strong>{c.author?.full_name ?? 'Participante'}</strong> {c.content}
              {(c.author_id === viewerId || ownerId === viewerId) && (
                <button type="button" className="auth-link" disabled={busy} onClick={() => void removeComment(c.id)}>
                  Apagar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="photo-social-form" onSubmit={(e) => void submit(e)}>
        <input
          type="text"
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva um comentário…"
          aria-label="Comentar esta foto"
        />
        <button type="submit" disabled={busy || !text.trim()}>
          Enviar
        </button>
      </form>
      {error && <p className="auth-error">{error}</p>}
    </div>
  )
}
