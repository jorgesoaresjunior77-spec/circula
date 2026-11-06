import { useState } from 'react'
import type { FormEvent } from 'react'
import { CoverImageInput } from './CoverImageInput'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { useManagedContent } from '../hooks/useManagedContent'
import { READING_THEMES } from '../lib/wellnessContent'
import type { PublishStatus, ReadingTheme, ReadingTip } from '../lib/wellnessContent'

// Dicas de Leitura — recomendações de livros cadastradas pela profissional,
// organizadas por tema. O app não inventa autores, títulos nem resumos:
// só aparece o que ela publica.

interface ReadingTipsPageProps {
  communityId: string
  profileId: string
  isOwner: boolean
}

interface FormState {
  id: string | null
  theme: ReadingTheme
  title: string
  author: string
  summary: string
  keyLearnings: string
  why: string
  cover: string
  status: PublishStatus
}

const EMPTY: FormState = {
  id: null,
  theme: 'saude',
  title: '',
  author: '',
  summary: '',
  keyLearnings: '',
  why: '',
  cover: '',
  status: 'draft',
}

function ReadingCard({ tip, onEdit }: { tip: ReadingTip; onEdit?: () => void }) {
  const { url } = useSignedImageUrl(tip.cover_image_url)
  return (
    <article className="reading-card">
      {url ? (
        <img loading="lazy" decoding="async" className="reading-cover" src={url} alt={`Capa de ${tip.title}`} />
      ) : (
        <div className="reading-cover reading-cover--blank" aria-hidden="true" />
      )}
      <div className="reading-body">
        <h4 className="reading-title">{tip.title}</h4>
        <p className="reading-author">{tip.author}</p>
        {tip.status === 'draft' && <p className="reading-draft">Rascunho — só você vê</p>}
        {tip.summary && <p className="reading-summary">{tip.summary}</p>}
        {tip.key_learnings && (
          <>
            <h5>Principais aprendizados</h5>
            <p className="reading-text">{tip.key_learnings}</p>
          </>
        )}
        {tip.why_recommended && (
          <>
            <h5>Por que recomendo</h5>
            <p className="reading-text">{tip.why_recommended}</p>
          </>
        )}
        {onEdit && (
          <button type="button" className="water-link" onClick={onEdit}>
            Editar
          </button>
        )}
      </div>
    </article>
  )
}

export function ReadingTipsPage({ communityId, profileId, isOwner }: ReadingTipsPageProps) {
  const { items, loading, error, save, remove } = useManagedContent<ReadingTip>('reading_tips', communityId, 'created_at')
  const [form, setForm] = useState<FormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function openEdit(tip: ReadingTip) {
    setForm({
      id: tip.id,
      theme: tip.theme,
      title: tip.title,
      author: tip.author,
      summary: tip.summary ?? '',
      keyLearnings: tip.key_learnings ?? '',
      why: tip.why_recommended ?? '',
      cover: tip.cover_image_url ?? '',
      status: tip.status,
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
    if (!form.title.trim() || !form.author.trim()) {
      setFormError('Preencha o título e o autor do livro.')
      return
    }
    setSaving(true)
    const result = await save(form.id, {
      theme: form.theme,
      title: form.title.trim(),
      author: form.author.trim(),
      summary: form.summary.trim() || null,
      key_learnings: form.keyLearnings.trim() || null,
      why_recommended: form.why.trim() || null,
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

  const groups = READING_THEMES.map((t) => ({
    ...t,
    tips: items.filter((i) => i.theme === t.key),
  })).filter((g) => g.tips.length > 0)

  return (
    <section className="reading-page">
      <h2>Dicas de Leitura</h2>

      {loading && <p className="home-muted">Carregando…</p>}
      {error && <p className="auth-error">{error}</p>}

      {!loading && items.length === 0 && (
        <p className="home-muted">
          {isOwner
            ? 'Você ainda não cadastrou nenhum livro. Use o botão abaixo para começar.'
            : 'As dicas de leitura ainda não foram publicadas. Em breve, novas recomendações por aqui.'}
        </p>
      )}

      {groups.map((group) => (
        <section key={group.key} className="reading-group" aria-label={group.label}>
          <h3>{group.label}</h3>
          {group.tips.map((tip) => (
            <ReadingCard key={tip.id} tip={tip} onEdit={isOwner ? () => openEdit(tip) : undefined} />
          ))}
        </section>
      ))}

      {isOwner && !form && (
        <button type="button" className="water-primary" onClick={() => setForm({ ...EMPTY })}>
          Novo livro
        </button>
      )}

      {isOwner && form && (
        <form className="wellness-form" onSubmit={(e) => void handleSubmit(e)} aria-label={form.id ? 'Editar livro' : 'Novo livro'}>
          <h3>{form.id ? 'Editar livro' : 'Novo livro'}</h3>
          <label>
            Tema
            <select value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value as ReadingTheme })}>
              {READING_THEMES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Título
            <input value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            Autor
            <input value={form.author} maxLength={160} onChange={(e) => setForm({ ...form, author: e.target.value })} />
          </label>
          <label>
            Resumo
            <textarea rows={3} maxLength={2000} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </label>
          <label>
            Principais aprendizados
            <textarea rows={4} maxLength={3000} value={form.keyLearnings} onChange={(e) => setForm({ ...form, keyLearnings: e.target.value })} />
          </label>
          <label>
            Por que você recomenda
            <textarea rows={3} maxLength={1500} value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })} />
          </label>
          <CoverImageInput
            id="reading-cover"
            communityId={communityId}
            uid={profileId}
            value={form.cover}
            onChange={(path) => setForm({ ...form, cover: path })}
            label="Capa do livro"
            aspectRatio="2 / 3"
            recommendedSize="800 × 1200 px"
          />
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
    </section>
  )
}

