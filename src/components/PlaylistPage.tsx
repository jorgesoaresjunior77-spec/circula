import { useState } from 'react'
import type { FormEvent } from 'react'
import { useManagedContent } from '../hooks/useManagedContent'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { CoverImageInput } from './CoverImageInput'

// Playlist: um cartão para cada playlist cadastrada pela profissional, com
// imagem e um botão que leva ao Spotify. O app não traz nenhuma playlist
// pronta; sem cadastro, a tela avisa com honestidade.

export interface CommunityPlaylist {
  id: string
  community_id: string
  title: string
  description: string | null
  cover_image_url: string | null
  spotify_url: string
  position: number
  status: 'draft' | 'published'
}

interface PlaylistPageProps {
  communityId?: string | null
  isOwner?: boolean
  profileId?: string
}

interface FormState {
  id: string | null
  title: string
  description: string
  cover: string
  url: string
  status: 'draft' | 'published'
}

const EMPTY: FormState = { id: null, title: '', description: '', cover: '', url: '', status: 'published' }

function PlaylistCover({ path }: { path: string | null }) {
  const { url } = useSignedImageUrl(path)
  return url ? <img className="playlist-card-photo" src={url} alt="" loading="lazy" decoding="async" /> : null
}

function SpotifyMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M7.500 9.800c3.200-.900 6.400-.600 9.200.900M8.200 12.700c2.500-.700 5-.400 7.200.800M9 15.400c1.800-.400 3.500-.200 5 .600" />
    </svg>
  )
}

export function PlaylistPage({ communityId = null, isOwner = false, profileId }: PlaylistPageProps) {
  const { items, loading, error, save, remove } = useManagedContent<CommunityPlaylist>(
    'community_playlists',
    communityId,
    'position',
  )
  const [form, setForm] = useState<FormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.title.trim()) {
      setFormError('Dê um nome à playlist.')
      return
    }
    if (!/^https:\/\//.test(form.url.trim())) {
      setFormError('O link do Spotify precisa começar com https://.')
      return
    }
    setSaving(true)
    const values: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      cover_image_url: form.cover || null,
      spotify_url: form.url.trim(),
      status: form.status,
    }
    if (!form.id) values.position = items.reduce((max, p) => Math.max(max, p.position), 0) + 1
    const result = await save(form.id, values)
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    setForm(null)
    setFormError(null)
  }

  async function handleDelete(id: string) {
    setSaving(true)
    const result = await remove(id)
    setSaving(false)
    if (result.error) setFormError(result.error)
    else setForm(null)
  }

  return (
    <section className="playlist-page">
      <h2>Playlist</h2>

      {loading && <p className="home-muted">Carregando…</p>}
      {error && <p className="auth-error">{error}</p>}

      {!loading && items.length === 0 && (
        <p className="home-muted">
          {isOwner
            ? 'Você ainda não cadastrou nenhuma playlist. Use o botão abaixo para começar.'
            : 'Em breve, aqui vão ficar as playlists da comunidade para respirar, relaxar e começar o dia com calma. Ainda não há nenhuma publicada.'}
        </p>
      )}

      {items.length > 0 && (
        <ul className="playlist-grid">
          {items.map((pl) => (
            <li key={pl.id} className="playlist-card">
              <div className="playlist-card-frame">
                <PlaylistCover path={pl.cover_image_url} />
              </div>
              <strong className="playlist-card-title">{pl.title}</strong>
              {pl.status === 'draft' && <p className="reading-draft">Rascunho — só você vê</p>}
              {pl.description && <p className="playlist-card-desc">{pl.description}</p>}
              <a className="playlist-card-open" href={pl.spotify_url} target="_blank" rel="noopener noreferrer">
                <SpotifyMark /> Ouvir no Spotify
              </a>
              {isOwner && (
                <button
                  type="button"
                  className="water-link"
                  onClick={() => {
                    setForm({
                      id: pl.id,
                      title: pl.title,
                      description: pl.description ?? '',
                      cover: pl.cover_image_url ?? '',
                      url: pl.spotify_url,
                      status: pl.status,
                    })
                    setFormError(null)
                  }}
                >
                  Editar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOwner && !form && (
        <button type="button" className="water-primary" onClick={() => setForm({ ...EMPTY })}>
          Nova playlist
        </button>
      )}

      {isOwner && form && communityId && profileId && (
        <form className="wellness-form" onSubmit={(e) => void handleSubmit(e)} aria-label={form.id ? 'Editar playlist' : 'Nova playlist'}>
          <h3>{form.id ? 'Editar playlist' : 'Nova playlist'}</h3>
          <label>
            Nome
            <input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            Descrição (opcional)
            <textarea rows={3} maxLength={600} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label>
            Link do Spotify (https)
            <input
              type="url"
              placeholder="https://open.spotify.com/playlist/..."
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
          </label>
          <CoverImageInput
            value={form.cover}
            communityId={communityId}
            uid={profileId}
            label="Imagem do cartão"
            aspectRatio="16 / 9"
            recommendedSize="1600 × 900 px"
            onChange={(path) => setForm((f) => (f ? { ...f, cover: path } : f))}
          />
          <label>
            Situação
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'draft' | 'published' })}>
              <option value="published">Publicada para a comunidade</option>
              <option value="draft">Rascunho (só você vê)</option>
            </select>
          </label>
          {formError && <p className="auth-error">{formError}</p>}
          <div className="wellness-form-actions">
            <button type="submit" className="water-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" className="water-link" onClick={() => setForm(null)} disabled={saving}>
              Cancelar
            </button>
            {form.id && (
              <button type="button" className="agenda-danger" onClick={() => void handleDelete(form.id!)} disabled={saving}>
                Excluir
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  )
}
