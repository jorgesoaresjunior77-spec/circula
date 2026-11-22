import { useMemo, useState } from 'react'
import { useShopping } from '../../hooks/useShopping'
import { formatQty } from '../../lib/shopping'
import type { DraftItem } from '../../lib/shopping'
import { MinhaListaCommercial } from './MinhaListaCommercial'

// Do cardápio do Meu Chef para a Lista de compras: mesmo caminho das receitas
// prontas (marcar o que levar, "Criar lista", aviso de lista salva e botão para
// ir direto às Listas de Compras). Sem PDF e sem página de impressão.

interface Props {
  communityId: string
  profileId: string
  defaultName: string
  drafts: DraftItem[]
  canUse: boolean
  onOpenPlans: () => void
  onGoToLists?: () => void
  onClose: () => void
}

function Sheet({ communityId, profileId, defaultName, drafts, onGoToLists, onClose }: Omit<Props, 'canUse' | 'onOpenPlans'>) {
  const api = useShopping(communityId, profileId)
  const [off, setOff] = useState<Set<string>>(new Set())
  const [name, setName] = useState(defaultName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const keyOf = (d: DraftItem, i: number) => i + ':' + d.name + ':' + d.unit
  const chosen = useMemo(() => drafts.filter((d, i) => !off.has(keyOf(d, i))), [drafts, off])

  async function create() {
    if (chosen.length === 0) {
      setError('Marque pelo menos um ingrediente.')
      return
    }
    setBusy(true)
    setError(null)
    const r = await api.createList({ name: name.trim() || 'Meu cardápio', source: 'receitas' }, chosen, [])
    setBusy(false)
    if (r.error || !r.id) {
      setError(r.error ?? 'Não foi possível criar a lista.')
      return
    }
    setSaved(name.trim() || 'Meu cardápio')
  }

  if (api.loading) return null

  if (saved) {
    return (
      <div className="ml-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Lista salva">
        <div className="ml-sheet ml-sheet--saved">
          <div className="ml-saved-check" aria-hidden="true">
            ✓
          </div>
          <h3>Lista salva!</h3>
          <p className="ml-saved-text">
            Sua lista “{saved}” está salva em <strong>Listas de Compras</strong>.
          </p>
          <button
            type="button"
            className="ml-big-btn ml-big-btn--pulse"
            onClick={() => {
              onClose()
              onGoToLists?.()
            }}
          >
            Vá para lista de compras já
          </button>
          <button type="button" className="auth-link ml-saved-close" onClick={onClose}>
            Continuar no cardápio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ml-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Ingredientes do cardápio">
      <div className="ml-sheet ml-sheet--pretty">
        <button type="button" className="plans-sheet-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <h3>Levar o cardápio para a lista de compras</h3>
        <h4>
          Ingredientes ({chosen.length} de {drafts.length})
        </h4>
        <div className="ml-actions">
          <button type="button" className="auth-link" onClick={() => setOff(new Set())}>
            Marcar todos
          </button>
          <button type="button" className="auth-link" onClick={() => setOff(new Set(drafts.map(keyOf)))}>
            Desmarcar todos
          </button>
        </div>
        <ul className="ml-ingredients">
          {drafts.map((d, i) => {
            const k = keyOf(d, i)
            return (
              <li key={k}>
                <label className="ml-check">
                  <input
                    type="checkbox"
                    checked={!off.has(k)}
                    onChange={(e) =>
                      setOff((cur) => {
                        const next = new Set(cur)
                        if (e.target.checked) next.delete(k)
                        else next.add(k)
                        return next
                      })
                    }
                  />
                  <span>
                    <strong>{d.name}</strong> · {formatQty(d.quantity, d.unit)}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        <label className="ml-field">
          Nome da lista
          <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="ml-actions ml-actions--final">
          <button type="button" className="ml-big-btn ml-big-btn--pulse" onClick={() => void create()} disabled={busy || drafts.length === 0}>
            {busy ? 'Salvando…' : 'Criar lista'}
          </button>
          <button type="button" className="auth-link" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export function MenuToList(props: Props) {
  if (!props.canUse) {
    return (
      <div className="ml-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Lista de compras">
        <div className="ml-sheet">
          <button type="button" className="plans-sheet-close" onClick={props.onClose} aria-label="Fechar">
            ×
          </button>
          <MinhaListaCommercial onOpenPlans={props.onOpenPlans} />
        </div>
      </div>
    )
  }
  return <Sheet {...props} />
}
