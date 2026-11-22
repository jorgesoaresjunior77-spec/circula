import { useEffect, useState } from 'react'
import { recordView } from '../lib/itemViews'
import { ViewCount } from './ViewCount'
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
  buyUrl: string
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
  buyUrl: '',
  status: 'draft',
}

function ReadingTile({ tip, onOpen }: { tip: ReadingTip; onOpen: () => void }) {
  const { url } = useSignedImageUrl(tip.cover_image_url)
  return (
    <button type="button" className="reading-tile" onClick={onOpen} aria-label={`${tip.title}, de ${tip.author}`}>
      {url ? (
        <img loading="lazy" decoding="async" className="reading-tile-cover" src={url} alt="" />
      ) : (
        <span className="reading-tile-cover reading-tile-cover--blank" aria-hidden="true" />
      )}
      <span className="reading-tile-title">{tip.title}</span>
      <span className="reading-tile-author">{tip.author}</span>
      {tip.status === 'draft' && <span className="reading-draft">Rascunho</span>}
    </button>
  )
}

function ReadingDetail({
  tip,
  communityId,
  isOwner,
  onClose,
  onEdit,
}: {
  tip: ReadingTip
  communityId: string
  isOwner: boolean
  onClose: () => void
  onEdit?: () => void
}) {
  useEffect(() => {
    if (!isOwner) recordView(communityId, 'reading', tip.id)
  }, [communityId, isOwner, tip.id])
  const { url } = useSignedImageUrl(tip.cover_image_url)
  return (
    <div className="reading-detail-backdrop" role="dialog" aria-modal="true" aria-label={tip.title} onClick={onClose}>
      <article className="reading-detail" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="reading-detail-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        {url && <img className="reading-detail-cover" src={url} alt={`Capa de ${tip.title}`} decoding="async" />}
        <h4 className="reading-title">{tip.title}</h4>
        <p className="reading-author">{tip.author}</p>
        {tip.status === 'draft' && <p className="reading-draft">Rascunho — só você vê</p>}
        {isOwner && <ViewCount communityId={communityId} kind="reading" itemId={tip.id} />}
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
        {tip.buy_url && /^https:\/\//i.test(tip.buy_url) && (
          <a className="water-primary reading-buy" href={tip.buy_url} target="_blank" rel="noopener noreferrer">
            Comprar o livro
          </a>
        )}
        {onEdit && (
          <button type="button" className="water-link" onClick={onEdit}>
            Editar
          </button>
        )}
      </article>
    </div>
  )
}

export function ReadingTipsPage({ communityId, profileId, isOwner }: ReadingTipsPageProps) {
  const { items, loading, error, save, remove } = useManagedContent<ReadingTip>('reading_tips', communityId, 'created_at')
  const [form, setForm] = useState<FormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const openTip = items.find((i) => i.id === openId) ?? null

  function openEdit(tip: ReadingTip) {
    setOpenId(null)
    setForm({
      id: tip.id,
      theme: tip.theme,
      title: tip.title,
      author: tip.author,
      summary: tip.summary ?? '',
      keyLearnings: tip.key_learnings ?? '',
      why: tip.why_recommended ?? '',
      cover: tip.cover_image_url ?? '',
      buyUrl: tip.buy_url ?? '',
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
    if (form.buyUrl.trim() && !/^https:\/\//i.test(form.buyUrl.trim())) {
      setFormError('O link da loja precisa começar com https://.')
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
      buy_url: form.buyUrl.trim() || null,
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
          <div className="reading-grid">
            {group.tips.map((tip) => (
              <ReadingTile key={tip.id} tip={tip} onOpen={() => setOpenId(tip.id)} />
            ))}
          </div>
        </section>
      ))}

      {openTip && (
        <ReadingDetail
          tip={openTip}
          communityId={communityId}
          isOwner={isOwner}
          onClose={() => setOpenId(null)}
          onEdit={isOwner ? () => openEdit(openTip) : undefined}
        />
      )}

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
            Link da loja onde o livro é vendido (https://)
            <input type="url" inputMode="url" maxLength={500} placeholder="https://" value={form.buyUrl} onChange={(e) => setForm({ ...form, buyUrl: e.target.value })} />
          </label>
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

