import { useState } from 'react'
import type { useShopping } from '../../hooks/useShopping'
import { centsToInput, groupByCategory, guessCategory, parsePriceToCents, totalsOf, formatQty } from '../../lib/shopping'
import type { ListItem, ShoppingList } from '../../lib/shopping'
import { formatBrl } from '../../lib/plansCatalog'

// Modo supermercado: tela cheia pensada para o celular. Toque grande para
// marcar, ajuste de quantidade, preço pago, o que ainda falta e o total da
// compra. Tudo salva na hora, sem botão de salvar.

type Api = ReturnType<typeof useShopping>

function Row({ item, canEdit, api }: { item: ListItem; canEdit: boolean; api: Api }) {
  const [paid, setPaid] = useState(centsToInput(item.paid_price_cents))
  const step = item.unit === 'g' || item.unit === 'ml' ? 100 : item.unit === 'kg' || item.unit === 'l' ? 0.5 : 1
  const bump = (d: number) => void api.updateItem(item, { quantity: Math.max(0, Math.round((item.quantity + d * step) * 1000) / 1000) })
  return (
    <li className={`sm-item${item.bought ? ' sm-item--done' : ''}`}>
      <button
        type="button"
        className="sm-check"
        aria-pressed={item.bought}
        aria-label={`${item.bought ? 'Desmarcar' : 'Marcar como comprado'}: ${item.name}`}
        disabled={!canEdit}
        onClick={() => void api.updateItem(item, { bought: !item.bought })}
      >
        {item.bought ? '✓' : ''}
      </button>
      <div className="sm-body">
        <strong>{item.name}</strong>
        <span className="sm-qty">
          {canEdit && (
            <button type="button" aria-label={`Menos ${item.name}`} onClick={() => bump(-1)}>
              −
            </button>
          )}
          <span>{formatQty(item.quantity, item.unit)}</span>
          {canEdit && (
            <button type="button" aria-label={`Mais ${item.name}`} onClick={() => bump(1)}>
              +
            </button>
          )}
        </span>
      </div>
      <label className="sm-price">
        <span>R$</span>
        <input
          inputMode="decimal"
          aria-label={`Preço pago de ${item.name}`}
          placeholder={item.est_price_cents != null ? centsToInput(item.est_price_cents) : '0,00'}
          value={paid}
          disabled={!canEdit}
          onChange={(e) => setPaid(e.target.value)}
          onBlur={() => {
            const c = parsePriceToCents(paid)
            if (c !== item.paid_price_cents) void api.updateItem(item, { paid_price_cents: c })
          }}
        />
      </label>
    </li>
  )
}

export function SupermarketMode({ list, items, canEdit, api, onClose }: { list: ShoppingList; items: ListItem[]; canEdit: boolean; api: Api; onClose: () => void }) {
  const [hideDone, setHideDone] = useState(false)
  const [newName, setNewName] = useState('')
  const t = totalsOf(items)
  const shown = hideDone ? items.filter((i) => !i.bought) : items

  async function add() {
    const name = newName.trim()
    if (!name) return
    await api.addItem(list.id, { name, category: guessCategory(name), quantity: 1, unit: 'un', notes: null })
    setNewName('')
  }

  return (
    <div className="sm" role="dialog" aria-modal="true" aria-label={`Modo supermercado: ${list.name}`}>
      <header className="sm-head">
        <button type="button" className="sm-close" onClick={onClose} aria-label="Sair do modo supermercado">
          ‹
        </button>
        <div>
          <strong>{list.name}</strong>
          <span>
            {t.bought} de {t.total} no carrinho · faltam {t.pending}
          </span>
        </div>
      </header>
      <div className="sm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(t.progress * 100)}>
        <span style={{ width: `${Math.round(t.progress * 100)}%` }} />
      </div>
      <div className="sm-total">
        <span>
          Total da compra <strong>{formatBrl(t.spentCents)}</strong>
        </span>
        <span>
          Estimado <strong>{formatBrl(t.estimatedCents)}</strong>
        </span>
      </div>
      <label className="sm-toggle">
        <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Mostrar só o que falta
      </label>
      <div className="sm-scroll">
        {groupByCategory(shown).map((g) => (
          <section key={g.key} className="sm-cat">
            <h4>{g.label}</h4>
            <ul>
              {g.items.map((i) => (
                <Row key={i.id} item={i} canEdit={canEdit} api={api} />
              ))}
            </ul>
          </section>
        ))}
        {shown.length === 0 && <p className="home-muted sm-empty">{items.length === 0 ? 'A lista está vazia.' : 'Tudo comprado! 🎉'}</p>}
      </div>
      {canEdit && (
        <form
          className="sm-add"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <input value={newName} placeholder="Adicionar produto" aria-label="Adicionar produto" onChange={(e) => setNewName(e.target.value)} />
          <button type="submit" disabled={!newName.trim()}>
            +
          </button>
        </form>
      )}
    </div>
  )
}
