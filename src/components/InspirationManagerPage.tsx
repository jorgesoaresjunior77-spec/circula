import { useState } from 'react'
import type { FormEvent } from 'react'
import { useManagedContent } from '../hooks/useManagedContent'
import { attribution } from '../lib/inspiration'
import type { Inspiration, InspirationKind } from '../lib/inspiration'

// Mensagens do dia (profissional): cadastra as citações verificadas e os
// textos editoriais que aparecem no pop-up diário. O app não escreve nem
// sugere nenhuma frase.

interface InspirationManagerPageProps {
  communityId: string
}

interface FormState {
  id: string | null
  kind: InspirationKind
  body: string
  author: string
  source: string
  status: 'draft' | 'published'
}

const EMPTY: FormState = { id: null, kind: 'citacao', body: '', author: '', source: '', status: 'draft' }

export function InspirationManagerPage({ communityId }: InspirationManagerPageProps) {
  const { items, loading, error, save, remove } = useManagedContent<Inspiration>(
    'daily_inspirations',
    communityId,
    'created_at',
  )
  const [form, setForm] = useState<FormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function openEdit(i: Inspiration) {
    setForm({
      id: i.id,
      kind: i.kind,
      body: i.body,
      author: i.author ?? '',
      source: i.source ?? '',
      status: i.status,
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
    if (!form.body.trim()) {
      setFormError('Escreva a mensagem.')
      return
    }
    if (form.kind === 'frase' && !form.author.trim()) {
      setFormError('Informe o autor da frase.')
      return
    }
    if (form.kind === 'citacao' && (!form.author.trim() || !form.source.trim())) {
      setFormError('Citação precisa de autor e de obra (a fonte). Sem fonte, use "Texto editorial".')
      return
    }
    setSaving(true)
    const result = await save(form.id, {
      kind: form.kind,
      body: form.body.trim(),
      author: form.kind !== 'editorial' ? form.author.trim() : null,
      source: form.kind !== 'editorial' ? form.source.trim() || null : null,
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

  const published = items.filter((i) => i.status === 'published').length

  return (
    <section className="inspiration-page">
      <h2>Mensagens do dia</h2>
      <p className="water-note">
        Uma mensagem publicada aparece por dia, no primeiro acesso de cada pessoa, girando pela lista. Só
        publique citações cuja fonte você conferiu. Sem mensagem publicada, o pop-up não aparece.
      </p>

      {loading && <p className="home-muted">Carregando…</p>}
      {error && <p className="auth-error">{error}</p>}
      {!loading && items.length === 0 && <p className="home-muted">Nenhuma mensagem cadastrada ainda.</p>}
      {!loading && items.length > 0 && (
        <p className="home-muted">
          {published} publicada{published === 1 ? '' : 's'} de {items.length}.
        </p>
      )}

      <ul className="inspiration-list">
        {items.map((i) => (
          <li key={i.id} className="inspiration-item">
            <p className="inspiration-item-text">{i.body}</p>
            <p className="inspiration-item-meta">
              {attribution(i)} · {i.status === 'published' ? 'Publicada' : 'Rascunho'}
            </p>
            <button type="button" className="water-link" onClick={() => openEdit(i)}>
              Editar
            </button>
          </li>
        ))}
      </ul>

      {!form && (
        <button type="button" className="water-primary" onClick={() => setForm({ ...EMPTY })}>
          Nova mensagem
        </button>
      )}

      {form && (
        <form className="wellness-form" onSubmit={(e) => void handleSubmit(e)} aria-label={form.id ? 'Editar mensagem' : 'Nova mensagem'}>
          <h3>{form.id ? 'Editar mensagem' : 'Nova mensagem'}</h3>
          <label>
            Tipo
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as InspirationKind })}>
              <option value="citacao">Citação (com autor e obra)</option>
              <option value="frase">Frase (só o autor; obra opcional)</option>
              <option value="editorial">Texto editorial do Círcula</option>
            </select>
          </label>
          <label>
            Mensagem
            <textarea rows={4} maxLength={600} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </label>
          {form.kind !== 'editorial' && (
            <>
              <label>
                Autor
                <input value={form.author} maxLength={160} onChange={(e) => setForm({ ...form, author: e.target.value })} />
              </label>
              <label>
                Obra{form.kind === 'frase' ? ' (opcional)' : ''}
                <input value={form.source} maxLength={200} onChange={(e) => setForm({ ...form, source: e.target.value })} />
              </label>
            </>
          )}
          <label>
            Situação
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'draft' | 'published' })}>
              <option value="draft">Rascunho (não aparece)</option>
              <option value="published">Publicada</option>
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
