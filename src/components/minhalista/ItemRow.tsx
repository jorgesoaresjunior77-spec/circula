import { useEffect, useState } from 'react'
import { CATEGORIES, UNITS, centsToInput, parsePriceToCents } from '../../lib/shopping'
import type { ListItem } from '../../lib/shopping'

// Uma linha da lista. Cada campo salva sozinho ao sair dele (ou ao marcar).
// Na criação da lista vai só o valor ESTIMADO; o valor pago se registra no
// modo supermercado, na hora da compra.

type Patch = Partial<Pick<ListItem, 'name' | 'category' | 'quantity' | 'unit' | 'est_price_cents' | 'paid_price_cents' | 'brand' | 'notes' | 'bought'>>

export function ItemRow({ item, canEdit, onChange, onRemove }: { item: ListItem; canEdit: boolean; onChange: (patch: Patch) => void; onRemove: () => void }) {
  const [qty, setQty] = useState(String(item.quantity).replace('.', ','))
  const [est, setEst] = useState(centsToInput(item.est_price_cents))
  const [brand, setBrand] = useState(item.brand ?? '')
  const [name, setName] = useState(item.name)

  // quando o item muda por fora (importação, outra pessoa), a linha acompanha
  useEffect(() => setQty(String(item.quantity).replace('.', ',')), [item.quantity])
  useEffect(() => setEst(centsToInput(item.est_price_cents)), [item.est_price_cents])
  useEffect(() => setBrand(item.brand ?? ''), [item.brand])
  useEffect(() => setName(item.name), [item.name])

  const commitQty = () => {
    const n = Number(qty.replace(',', '.'))
    if (Number.isFinite(n) && n >= 0 && n !== item.quantity) onChange({ quantity: Math.round(n * 1000) / 1000 })
    else setQty(String(item.quantity).replace('.', ','))
  }

  return (
    <li className={`ml-item${item.bought ? ' ml-item--done' : ''}`}>
      <label className="ml-check ml-item-check">
        <input type="checkbox" checked={item.bought} disabled={!canEdit} onChange={(e) => onChange({ bought: e.target.checked })} aria-label={`Comprado: ${item.name}`} />
      </label>
      <div className="ml-item-main">
        <input
          className="ml-item-name"
          value={name}
          maxLength={160}
          disabled={!canEdit}
          aria-label="Nome do produto"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== item.name && onChange({ name: name.trim() })}
        />
        {item.source_recipe_title && <small className="ml-item-from">da receita: {item.source_recipe_title}</small>}
        {item.notes && <small className="ml-item-from">{item.notes}</small>}
        <div className="ml-item-fields">
          <input inputMode="decimal" className="ml-qty" aria-label="Quantidade" value={qty} disabled={!canEdit} onChange={(e) => setQty(e.target.value)} onBlur={commitQty} />
          <select aria-label="Unidade" value={item.unit} disabled={!canEdit} onChange={(e) => onChange({ unit: e.target.value as ListItem['unit'] })}>
            {UNITS.map((u) => (
              <option key={u.key} value={u.key}>
                {u.short}
              </option>
            ))}
          </select>
          <select aria-label="Categoria" value={item.category} disabled={!canEdit} onChange={(e) => onChange({ category: e.target.value as ListItem['category'] })}>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-item-fields">
          <label className="ml-price-field">
            Estimado R$
            <input
              inputMode="decimal"
              value={est}
              disabled={!canEdit}
              onChange={(e) => setEst(e.target.value)}
              onBlur={() => {
                const c = parsePriceToCents(est)
                if (c !== item.est_price_cents) onChange({ est_price_cents: c })
              }}
            />
          </label>
          <label className="ml-price-field ml-brand-field">
            Marca
            <input
              value={brand}
              maxLength={80}
              disabled={!canEdit}
              placeholder="opcional"
              onChange={(e) => setBrand(e.target.value)}
              onBlur={() => {
                const b = brand.trim() || null
                if (b !== (item.brand ?? null)) onChange({ brand: b })
              }}
            />
          </label>
        </div>
      </div>
      {canEdit && (
        <button type="button" className="ml-remove" onClick={onRemove} aria-label={`Remover ${item.name}`}>
          ×
        </button>
      )}
    </li>
  )
}
