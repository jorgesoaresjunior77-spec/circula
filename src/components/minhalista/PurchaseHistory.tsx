import { useState } from 'react'
import { useShoppingPurchases } from '../../hooks/useShoppingPurchases'
import { formatBrl } from '../../lib/plansCatalog'
import { formatQty, categoryLabel } from '../../lib/shopping'
import { unitPrice, baseLabel } from '../../lib/priceInsights'
import { PriceCharts } from './PriceCharts'

// Histórico de compras (mercado, data, total, produtos, marcas e preços) e os
// gráficos de preço. Cada compra abre o detalhe.

const brDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

export function PurchaseHistory() {
  const { purchases, loading, error, remove } = useShoppingPurchases(true)
  const [tab, setTab] = useState<'compras' | 'graficos'>('compras')
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const open = purchases.find((p) => p.id === openId) ?? null

  if (loading) return <p className="home-muted">Carregando o histórico…</p>
  if (error) return <p className="auth-error">{error}</p>

  if (open) {
    return (
      <section className="ph-detail">
        <button type="button" className="auth-link" onClick={() => setOpenId(null)}>
          ‹ Todas as compras
        </button>
        <h3>{open.store_name}</h3>
        <p className="home-muted">
          {brDate(open.purchased_on)} · {open.items_count} {open.items_count === 1 ? 'produto' : 'produtos'} · total <strong>{formatBrl(open.total_cents)}</strong>
        </p>
        <table className="pc-table ph-items">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Qtd.</th>
              <th>Pago</th>
            </tr>
          </thead>
          <tbody>
            {open.items.map((it, i) => {
              const up = unitPrice(it)
              return (
                <tr key={i}>
                  <td>
                    <strong>{it.name}</strong>
                    {it.brand && <small> · {it.brand}</small>}
                    <small className="ph-cat">{categoryLabel(it.category)}</small>
                  </td>
                  <td>{formatQty(it.quantity, it.unit)}</td>
                  <td>
                    {it.paid_price_cents != null ? formatBrl(it.paid_price_cents) : '—'}
                    {up && (it.unit !== 'un' || it.quantity !== 1) && (
                      <small>
                        {' '}
                        ({formatBrl(up.cents)}/{baseLabel(up.base)})
                      </small>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {confirmDel === open.id ? (
          <div className="ml-card-confirm" role="alert">
            <span>Excluir esta compra do histórico (e dos gráficos)?</span>
            <button
              type="button"
              className="ml-card-del ml-card-del--yes"
              onClick={() => void remove(open.id).then(() => {
                setConfirmDel(null)
                setOpenId(null)
              })}
            >
              Sim, excluir
            </button>
            <button type="button" className="ml-card-del" onClick={() => setConfirmDel(null)}>
              Não
            </button>
          </div>
        ) : (
          <button type="button" className="ml-card-del" onClick={() => setConfirmDel(open.id)}>
            Excluir do histórico
          </button>
        )}
      </section>
    )
  }

  return (
    <section className="ph">
      <div className="ph-tabs" role="tablist" aria-label="Histórico">
        <button type="button" role="tab" aria-selected={tab === 'compras'} className={`schedule-type${tab === 'compras' ? ' schedule-type--on' : ''}`} onClick={() => setTab('compras')}>
          Compras
        </button>
        <button type="button" role="tab" aria-selected={tab === 'graficos'} className={`schedule-type${tab === 'graficos' ? ' schedule-type--on' : ''}`} onClick={() => setTab('graficos')}>
          Gráficos de preços
        </button>
      </div>
      {tab === 'graficos' ? (
        <PriceCharts purchases={purchases} />
      ) : purchases.length === 0 ? (
        <p className="home-muted">
          Nenhuma compra salva ainda. No modo supermercado, marque o que comprou, informe o valor pago e toque em “Finalizar compra”: o mercado, a data e os
          preços ficam aqui.
        </p>
      ) : (
        <ul className="ph-list">
          {purchases.map((p) => (
            <li key={p.id}>
              <button type="button" className="ph-item" onClick={() => setOpenId(p.id)}>
                <span className="ph-item-top">
                  <strong>{p.store_name}</strong>
                  <span>{formatBrl(p.total_cents)}</span>
                </span>
                <span className="home-muted">
                  {brDate(p.purchased_on)} · {p.items_count} {p.items_count === 1 ? 'produto' : 'produtos'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
