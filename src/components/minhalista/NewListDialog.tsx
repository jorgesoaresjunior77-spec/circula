import { useState } from 'react'
import type { FormEvent } from 'react'
import { guessCategory, parseIngredientLine } from '../../lib/shopping'
import type { DraftItem } from '../../lib/shopping'
import type { useShopping } from '../../hooks/useShopping'

// Janela "Nova lista de compras": o nome, os itens (um por linha, com ou sem
// quantidade) e, se quiser, a data. Cria a lista e já deixa mandar pelo WhatsApp.

type Api = ReturnType<typeof useShopping>

export function textFromDrafts(name: string, drafts: DraftItem[]): string {
  const lines = [`🛒 ${name}`, '']
  for (const d of drafts) {
    const qty = d.quantity === 1 && d.unit === 'un' ? '' : ` — ${d.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${d.unit}`
    lines.push(`▫️ ${d.name}${qty}`)
  }
  return lines.join('\n')
}

export function draftsFromText(text: string): DraftItem[] {
  return text
    .split('\n')
    .map((l) => parseIngredientLine(l))
    .filter((p): p is NonNullable<typeof p> => !!p && !!p.name)
    .map((p) => ({ name: p.name, category: guessCategory(p.name), quantity: p.quantity, unit: p.unit, notes: p.notes }))
}

export function NewListDialog({ api, onClose, onCreated }: { api: Api; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [itemsText, setItemsText] = useState('')
  const [planned, setPlanned] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const drafts = draftsFromText(itemsText)

  async function create(e: FormEvent, sendWhats = false) {
    e.preventDefault()
    if (!name.trim()) return setError('Dê um nome à lista.')
    setBusy(true)
    setError(null)
    const r = await api.createList({ name, description: '', planned_for: planned }, drafts)
    setBusy(false)
    if (r.error || !r.id) return setError(r.error ?? 'Não foi possível criar a lista.')
    if (sendWhats) window.open(`https://wa.me/?text=${encodeURIComponent(textFromDrafts(name.trim(), drafts))}`, '_blank', 'noopener,noreferrer')
    onCreated(r.id)
  }

  return (
    <div className="ml-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ml-modal" role="dialog" aria-modal="true" aria-label="Nova lista de compras">
        <div className="ml-modal-head">
          <h3>Nova lista de compras</h3>
          <button type="button" className="ml-modal-x" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <form className="ml-form" onSubmit={(e) => void create(e)}>
          <label className="ml-field">
            Nome da lista
            <input value={name} maxLength={120} autoFocus placeholder="ex.: Compras da semana" onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="ml-field">
            O que comprar (um item por linha)
            <textarea rows={7} value={itemsText} onChange={(e) => setItemsText(e.target.value)} placeholder={'2 kg de arroz\n1 dúzia de ovos\n500 g de frango\nbanana'} />
          </label>
          <p className="home-muted">{drafts.length} {drafts.length === 1 ? 'item' : 'itens'} na lista. Você ainda pode editar, marcar o que comprou e organizar depois.</p>
          <label className="ml-field">
            Data prevista (opcional)
            <input type="date" value={planned} onChange={(e) => setPlanned(e.target.value)} />
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="ml-actions ml-actions--start">
            <button type="submit" className="water-primary" disabled={busy}>
              Criar lista
            </button>
            <button type="button" className="water-primary ml-whats" disabled={busy || drafts.length === 0} onClick={(e) => void create(e as unknown as FormEvent, true)}>
              Criar e enviar pelo WhatsApp
            </button>
            <button type="button" className="auth-link" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
