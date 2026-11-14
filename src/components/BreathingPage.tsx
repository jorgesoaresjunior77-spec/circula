import { useState } from 'react'
import type { FormEvent } from 'react'
import { useManagedContent } from '../hooks/useManagedContent'
import { SESSION_KINDS, formatDuration, isValidAudioUrl } from '../lib/wellnessContent'
import type { PublishStatus, SessionKind, WellnessSession } from '../lib/wellnessContent'
import { useCommunitySessionPages } from '../hooks/useSessionPages'
import type { SessionPage } from '../hooks/useSessionPages'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import type { MagazineIssue } from '../types/magazine'
import { CoverImageInput } from './CoverImageInput'
import { SessionPagesEditor } from './SessionPagesEditor'
import { MagazineReader } from './HomeMagazineStrip'

// Respiração e Meditação — sessões cadastradas pela profissional (ou
// revisadas por quem responde pela técnica). O app não traz nenhuma
// técnica nem áudio pronto.

interface BreathingPageProps {
  communityId: string
  isOwner: boolean
  /** Quem está logada (envio do banner e das páginas). */
  profileId?: string
}

interface FormState {
  id: string | null
  kind: SessionKind
  title: string
  instructions: string
  duration: string
  audio: string
  cover: string
  status: PublishStatus
}

const EMPTY: FormState = {
  id: null,
  kind: 'respiracao',
  title: '',
  instructions: '',
  duration: '5',
  audio: '',
  cover: '',
  status: 'draft',
}

function SessionBanner({ path }: { path: string | null | undefined }) {
  const { url } = useSignedImageUrl(path ?? null)
  return url ? <img className="breathing-banner" src={url} alt="" loading="lazy" decoding="async" /> : null
}

function toIssue(session: WellnessSession, pages: SessionPage[]): MagazineIssue {
  return {
    id: session.id,
    community_id: session.community_id,
    title: session.title,
    cover_path: session.cover_image_url ?? null,
    release_date: '',
    pages: pages.map((pg) => ({ id: pg.id, issue_id: session.id, position: pg.position, image_path: pg.image_path })),
  }
}

export function BreathingPage({ communityId, isOwner, profileId }: BreathingPageProps) {
  const { items, loading, error, save, remove } = useManagedContent<WellnessSession>(
    'wellness_sessions',
    communityId,
    'duration_minutes',
  )
  const [form, setForm] = useState<FormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pagesKey, setPagesKey] = useState(0)
  const pagesBySession = useCommunitySessionPages(communityId, pagesKey)
  const [readingId, setReadingId] = useState<string | null>(null)
  const readingSession = readingId ? (items.find((i) => i.id === readingId) ?? null) : null

  function openEdit(s: WellnessSession) {
    setForm({
      id: s.id,
      kind: s.kind,
      title: s.title,
      instructions: s.instructions ?? '',
      duration: String(s.duration_minutes),
      audio: s.audio_url ?? '',
      cover: s.cover_image_url ?? '',
      status: s.status,
    })
    setFormError(null)
    setConfirmDelete(false)
  }

  function closeForm() {
    setForm(null)
    setFormError(null)
    setConfirmDelete(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const minutes = Number(form.duration)
    if (!form.title.trim()) {
      setFormError('Dê um nome à sessão.')
      return
    }
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
      setFormError('A duração deve ser de 1 a 120 minutos.')
      return
    }
    if (form.audio.trim() && !isValidAudioUrl(form.audio.trim())) {
      setFormError('O link do áudio precisa começar com https://.')
      return
    }
    setSaving(true)
    const result = await save(form.id, {
      kind: form.kind,
      title: form.title.trim(),
      instructions: form.instructions.trim() || null,
      duration_minutes: minutes,
      audio_url: form.audio.trim() || null,
      cover_image_url: form.cover || null,
      status: form.status,
    })
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    closeForm()
  }

  async function handleDelete() {
    if (!form?.id) return
    setSaving(true)
    const result = await remove(form.id)
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    closeForm()
  }

  const groups = SESSION_KINDS.map((k) => ({
    ...k,
    sessions: items.filter((i) => i.kind === k.key),
  })).filter((g) => g.sessions.length > 0)

  return (
    <section className="breathing-page">
      <h2>Respiração e Meditação</h2>

      <p className="water-note">
        Faça no seu ritmo e pare se sentir tontura ou desconforto. Estas práticas são um momento de pausa e
        não substituem o acompanhamento de um profissional de saúde.
      </p>

      {loading && <p className="home-muted">Carregando…</p>}
      {error && <p className="auth-error">{error}</p>}

      {!loading && items.length === 0 && (
        <p className="home-muted">
          {isOwner
            ? 'Você ainda não cadastrou nenhuma sessão. Use o botão abaixo para começar.'
            : 'As práticas de respiração e meditação ainda não foram publicadas. Em breve, por aqui.'}
        </p>
      )}

      {groups.map((group) => (
        <section key={group.key} className="breathing-group" aria-label={group.label}>
          <h3>{group.label}</h3>
          {group.sessions.map((s) => (
            <article key={s.id} className="breathing-card">
              <SessionBanner path={s.cover_image_url} />
              <div className="breathing-head">
                <h4>{s.title}</h4>
                <span className="breathing-duration">{formatDuration(s.duration_minutes)}</span>
              </div>
              {s.status === 'draft' && <p className="reading-draft">Rascunho — só você vê</p>}
              {s.instructions && <p className="reading-text">{s.instructions}</p>}
              {s.audio_url && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio controls preload="none" src={s.audio_url} aria-label={`Áudio: ${s.title}`} />
              )}
              {(pagesBySession[s.id]?.length ?? 0) > 0 && (
                <button type="button" className="water-primary breathing-open" onClick={() => setReadingId(s.id)}>
                  Ver o passo a passo
                </button>
              )}
              {isOwner && (
                <button type="button" className="water-link" onClick={() => openEdit(s)}>
                  Editar
                </button>
              )}
            </article>
          ))}
        </section>
      ))}

      {isOwner && !form && (
        <button type="button" className="water-primary" onClick={() => setForm({ ...EMPTY })}>
          Nova sessão
        </button>
      )}

      {isOwner && form && (
        <form className="wellness-form" onSubmit={(e) => void handleSubmit(e)} aria-label={form.id ? 'Editar sessão' : 'Nova sessão'}>
          <h3>{form.id ? 'Editar sessão' : 'Nova sessão'}</h3>
          <label>
            Tipo
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as SessionKind })}>
              {SESSION_KINDS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nome
            <input value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            Duração (minutos)
            <input
              type="text"
              inputMode="numeric"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            />
          </label>
          <label>
            Orientações
            <textarea rows={5} maxLength={4000} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
          </label>
          <label>
            Link do áudio (opcional, https)
            <input
              type="url"
              placeholder="https://"
              value={form.audio}
              onChange={(e) => setForm({ ...form, audio: e.target.value })}
            />
          </label>
          {profileId && (
            <CoverImageInput
              value={form.cover}
              communityId={communityId}
              uid={profileId}
              label="Banner da prática (opcional)"
              aspectRatio="16 / 9"
              recommendedSize="1600 × 900 px"
              onChange={(path) => setForm((f) => (f ? { ...f, cover: path } : f))}
            />
          )}
          {profileId && form.id && (
            <SessionPagesEditor
              sessionId={form.id}
              communityId={communityId}
              profileId={profileId}
              onChanged={() => setPagesKey((k) => k + 1)}
            />
          )}
          {profileId && !form.id && (
            <p className="home-muted">Salve a prática e toque em "Editar" para enviar as páginas (imagens).</p>
          )}
          <label>
            Situação
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PublishStatus })}>
              <option value="draft">Rascunho (só você vê)</option>
              <option value="published">Publicado para a comunidade</option>
            </select>
          </label>
          {formError && <p className="auth-error">{formError}</p>}
          <div className="wellness-form-actions">
            <button type="submit" className="water-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" className="water-link" onClick={closeForm} disabled={saving}>
              Cancelar
            </button>
            {form.id &&
              (confirmDelete ? (
                <button type="button" className="agenda-danger" onClick={() => void handleDelete()} disabled={saving}>
                  Confirmar exclusão
                </button>
              ) : (
                <button type="button" className="agenda-danger" onClick={() => setConfirmDelete(true)} disabled={saving}>
                  Excluir
                </button>
              ))}
          </div>
        </form>
      )}

      {readingSession && (
        <MagazineReader
          issue={toIssue(readingSession, pagesBySession[readingSession.id] ?? [])}
          onClose={() => setReadingId(null)}
          pageLimit={Number.POSITIVE_INFINITY}
        />
      )}
    </section>
  )
}
