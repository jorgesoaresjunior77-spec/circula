import { useMemo, useState } from 'react'
import type { Recipe } from '../../hooks/useRecipes'
import type { useShopping } from '../../hooks/useShopping'
import { consolidateDrafts, formatQty, ingredientsToDrafts } from '../../lib/shopping'
import type { DraftItem } from '../../lib/shopping'

// Das receitas para a Minha Lista. Serve para "Adicionar ingredientes à Minha
// Lista" (uma receita, vinda da própria receita) e para "Montar lista com
// minhas receitas" (várias receitas, porções ajustáveis). Lê o texto dos
// ingredientes SEM alterá-lo; consolida só o que é compatível; e deixa a
// usuária marcar o que quer levar.

type Api = ReturnType<typeof useShopping>

interface Props {
  recipes: Recipe[]
  /** Receita fixa (botão dentro da receita). Sem isso, a usuária escolhe várias. */
  fixed?: Recipe | null
  api: Api
  onClose: () => void
  onDone: (listId: string) => void
  /** Lista já escolhida (ex.: vindo de dentro de uma lista). */
  defaultTarget?: string
  /** Leva à página de listas de compras (mostrado depois de salvar, só vindo de uma receita). */
  onGoToLists?: () => void
}

export function RecipeToList({ recipes, fixed = null, api, onClose, onDone, defaultTarget = 'nova', onGoToLists }: Props) {
  const [picked, setPicked] = useState<Record<string, number>>(fixed ? { [fixed.id]: 1 } : {})
  const [off, setOff] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState<string>(defaultTarget)
  const [name, setName] = useState(fixed ? `Compras: ${fixed.title}` : 'Compras da semana')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ id: string; name: string } | null>(null)

  const candidates = fixed ? [fixed] : recipes.filter((r) => r.status === 'published')
  const open = api.lists.filter((l) => l.status === 'em_andamento')

  const drafts: DraftItem[] = useMemo(() => {
    const all: DraftItem[] = []
    for (const r of candidates) {
      const factor = picked[r.id]
      if (!factor) continue
      all.push(...ingredientsToDrafts(r.ingredients, factor, { id: r.id, title: r.title }))
    }
    return consolidateDrafts(all)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, recipes, fixed])

  const keyOf = (d: DraftItem, i: number) => `${i}:${d.name}:${d.unit}`
  const chosen = drafts.filter((d, i) => !off.has(keyOf(d, i)))
  const withoutIngredients = candidates.filter((r) => picked[r.id] && !(r.ingredients ?? '').trim())

  async function confirm() {
    if (chosen.length === 0) {
      setError('Marque pelo menos um ingrediente.')
      return
    }
    setBusy(true)
    setError(null)
    const used = Object.entries(picked).filter(([, p]) => p > 0).map(([id, portions]) => ({ id, portions }))
    if (target === 'nova') {
      const r = await api.createList({ name: name.trim() || 'Minha lista', source: 'receitas' }, chosen, used)
      setBusy(false)
      if (r.error || !r.id) {
        setError(r.error ?? 'Não foi possível criar a lista.')
        return
      }
      if (fixed) {
        setSaved({ id: r.id, name: name.trim() || 'Minha lista' })
        return
      }
      onDone(r.id)
      return
    }
    const r = await api.importDrafts(target, chosen, used)
    setBusy(false)
    if (r.error) {
      setError(r.error)
      return
    }
    if (fixed) {
      setSaved({ id: target, name: open.find((l) => l.id === target)?.name ?? 'sua lista' })
      return
    }
    onDone(target)
  }

  if (saved) {
    return (
      <div className="ml-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Lista salva">
        <div className="ml-sheet ml-sheet--saved">
          <div className="ml-saved-check" aria-hidden="true">
            ✓
          </div>
          <h3>Lista salva!</h3>
          <p className="ml-saved-text">
            Sua lista “{saved.name}” está salva em <strong>Listas de Compras</strong>.
          </p>
          <button
            type="button"
            className="ml-big-btn ml-big-btn--pulse"
            onClick={() => {
              onDone(saved.id)
              onGoToLists?.()
            }}
          >
            Vá para lista de compras já
          </button>
          <button type="button" className="auth-link ml-saved-close" onClick={() => onDone(saved.id)}>
            Continuar na receita
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ml-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Ingredientes das receitas">
      <div className="ml-sheet ml-sheet--pretty">
        <button type="button" className="plans-sheet-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <h3>{fixed ? 'Adicionar ingredientes à Minha Lista' : 'Montar lista com minhas receitas'}</h3>

        {!fixed && (
          <>
            <p className="home-muted">Escolha as receitas e ajuste as porções (1 = a receita como está escrita).</p>
            <ul className="ml-recipes">
              {candidates.length === 0 && <li className="home-muted">Ainda não há receitas publicadas.</li>}
              {candidates.map((r) => (
                <li key={r.id}>
                  <label className="ml-check">
                    <input
                      type="checkbox"
                      checked={!!picked[r.id]}
                      onChange={(e) => setPicked((p) => (e.target.checked ? { ...p, [r.id]: 1 } : Object.fromEntries(Object.entries(p).filter(([k]) => k !== r.id))))}
                    />
                    <span>{r.title}</span>
                  </label>
                  {picked[r.id] ? (
                    <label className="ml-portions">
                      Porções ×
                      <input
                        inputMode="decimal"
                        value={picked[r.id]}
                        onChange={(e) => setPicked((p) => ({ ...p, [r.id]: Math.min(50, Math.max(0.25, Number(e.target.value.replace(',', '.')) || 1)) }))}
                      />
                    </label>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}

        {fixed && (
          <label className="ml-portions">
            Porções ×
            <input
              inputMode="decimal"
              value={picked[fixed.id] ?? 1}
              onChange={(e) => setPicked({ [fixed.id]: Math.min(50, Math.max(0.25, Number(e.target.value.replace(',', '.')) || 1)) })}
            />
          </label>
        )}

        {withoutIngredients.length > 0 && (
          <p className="home-muted">
            {withoutIngredients.map((r) => r.title).join(', ')}: a receita ainda não tem os ingredientes escritos, então não traz nada para a lista.
          </p>
        )}

        {drafts.length > 0 && (
          <>
            <h4>Ingredientes ({chosen.length} de {drafts.length})</h4>
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
                        {d.source_recipe_title && <small> · {d.source_recipe_title}</small>}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <label className="ml-field">
          Colocar em
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="nova">Uma lista nova</option>
            {open.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        {target === 'nova' && (
          <label className="ml-field">
            Nome da lista
            <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="ml-actions ml-actions--final">
          <button
            type="button"
            className="ml-big-btn ml-big-btn--pulse"
            onClick={() => void confirm()}
            disabled={busy || drafts.length === 0}
          >
            {busy ? 'Salvando…' : target === 'nova' ? 'Criar lista' : 'Adicionar à lista'}
          </button>
          <button type="button" className="auth-link" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
