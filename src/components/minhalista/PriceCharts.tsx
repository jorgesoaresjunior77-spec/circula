import { useMemo, useState } from 'react'
import { formatBrl } from '../../lib/plansCatalog'
import { baseLabel, compareStores, monthLabel, observations, priceByStore, priceTimeline, productOptions, trendPercent } from '../../lib/priceInsights'
import type { CompareMode, PurchaseRow } from '../../lib/priceInsights'

// Gráficos de preço da Minha Lista, só com o que a pessoa registrou.
// 1) Qual mercado sai mais em conta (mesma cesta). 2) Onde o produto está
// mais barato. 3) Evolução do preço do produto no tempo. Uma cor (marrom do
// Círcula); o "mais barato" leva selo escrito, não só cor. Cada gráfico tem
// a tabela com os números logo abaixo (leitura fácil e acessível).

function Bars({ rows, unit }: { rows: { label: string; cents: number; best: boolean; sub?: string }[]; unit?: string }) {
  const max = Math.max(...rows.map((r) => r.cents), 1)
  return (
    <ul className="pc-bars">
      {rows.map((r) => (
        <li key={r.label} className={`pc-bar${r.best ? ' pc-bar--best' : ''}`} title={`${r.label}: ${formatBrl(r.cents)}${unit ? ` por ${unit}` : ''}`}>
          <span className="pc-bar-label">
            {r.label}
            {r.sub && <small>{r.sub}</small>}
          </span>
          <span className="pc-bar-track" aria-hidden="true">
            <span className="pc-bar-fill" style={{ width: `${Math.max(4, (r.cents / max) * 100)}%` }} />
          </span>
          <span className="pc-bar-value">
            {formatBrl(r.cents)}
            {r.best && <em className="pc-best">mais barato</em>}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Line({ points, unit }: { points: { month: string; cents: number }[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 320
  const H = 150
  const padX = { l: 8, r: 8, t: 22, b: 26 }
  // margem em cima e embaixo: a variação aparece sem exagero (o ponto mais baixo não encosta no chão)
  const lo = Math.min(...points.map((p) => p.cents))
  const hi = Math.max(...points.map((p) => p.cents))
  const pad = Math.max((hi - lo) * 0.9, hi * 0.06, 1)
  const min = Math.max(0, lo - pad)
  const max = hi + pad * 0.35
  const span = Math.max(1, max - min)
  const x = (i: number) => padX.l + (points.length === 1 ? (W - padX.l - padX.r) / 2 : (i * (W - padX.l - padX.r)) / (points.length - 1))
  const y = (c: number) => padX.t + (1 - (c - min) / span) * (H - padX.t - padX.b)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.cents).toFixed(1)}`).join(' ')
  const h = hover != null ? points[hover] : null
  return (
    <div className="pc-line-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="pc-line" role="img" aria-label={`Evolução do preço por ${unit}`} onMouseLeave={() => setHover(null)}>
        <line x1={padX.l} x2={W - padX.r} y1={H - padX.b} y2={H - padX.b} className="pc-axis" />
        <path d={d} className="pc-path" />
        {points.map((p, i) => (
          <g key={p.month}>
            <circle cx={x(i)} cy={y(p.cents)} r={hover === i ? 6 : 4.5} className="pc-dot" />
            <rect x={x(i) - 18} y={0} width={36} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
            {(i === 0 || i === points.length - 1 || points.length <= 6) && (
              <text x={x(i)} y={H - 8} className="pc-tick" textAnchor="middle">
                {monthLabel(p.month)}
              </text>
            )}
          </g>
        ))}
        {(h ? [hover as number] : [points.length - 1]).map((i) => (
          <text key="v" x={Math.min(W - 40, Math.max(40, x(i)))} y={Math.max(14, y(points[i].cents) - 10)} className="pc-val" textAnchor="middle">
            {formatBrl(points[i].cents)}
          </text>
        ))}
      </svg>
    </div>
  )
}

export function PriceCharts({ purchases }: { purchases: PurchaseRow[] }) {
  const [mode, setMode] = useState<CompareMode>('same_brand')
  const obs = useMemo(() => observations(purchases, mode), [purchases, mode])
  const options = useMemo(() => productOptions(obs), [obs])
  const [picked, setPicked] = useState<string>('')
  const product = options.find((o) => o.key === picked) ?? options[0] ?? null
  const storeCmp = useMemo(() => compareStores(obs), [obs])
  const byStore = useMemo(() => (product ? priceByStore(obs, product.key) : []), [obs, product])
  const timeline = useMemo(() => (product ? priceTimeline(obs, product.key) : []), [obs, product])
  const trend = trendPercent(timeline)
  const labelOf = (key: string) => options.find((o) => o.key === key)?.label ?? key.split('|')[0]

  if (purchases.length === 0) {
    return <p className="home-muted pc-empty">Os gráficos aparecem depois da primeira compra salva no histórico (no modo supermercado, toque em “Finalizar compra”).</p>
  }

  return (
    <div className="pc">
      <div className="pc-mode" role="radiogroup" aria-label="Como comparar">
        <button type="button" role="radio" aria-checked={mode === 'same_brand'} className={`schedule-type${mode === 'same_brand' ? ' schedule-type--on' : ''}`} onClick={() => setMode('same_brand')}>
          Mesmo produto e mesma marca
        </button>
        <button type="button" role="radio" aria-checked={mode === 'any_brand'} className={`schedule-type${mode === 'any_brand' ? ' schedule-type--on' : ''}`} onClick={() => setMode('any_brand')}>
          Produto em geral (qualquer marca)
        </button>
      </div>
      <p className="home-muted pc-note">
        {mode === 'same_brand'
          ? 'Compara só produtos com a mesma marca (os que ficaram sem marca não entram).'
          : 'Atenção: aqui entram marcas diferentes do mesmo produto, então a comparação é aproximada.'}{' '}
        Os preços são por kg, por litro ou por unidade quando dá para calcular.
      </p>

      <section className="pc-card">
        <h4>Qual mercado sai mais em conta</h4>
        {storeCmp ? (
          <>
            <p className="home-muted">
              Mesma cesta de {storeCmp.basket.length} produtos comprados em todos estes mercados (último preço de cada um):{' '}
              {storeCmp.basket.map(labelOf).join(', ')}.
            </p>
            <Bars rows={storeCmp.stores.map((s) => ({ label: s.store, cents: s.cents, best: s.cheapest && storeCmp.stores.length > 1 }))} />
          </>
        ) : (
          <p className="home-muted">Para comparar mercados, registre os preços de pelo menos 2 produtos iguais em 2 mercados diferentes.</p>
        )}
      </section>

      {options.length === 0 ? (
        <section className="pc-card">
          <p className="home-muted">
            {mode === 'same_brand'
              ? 'Ainda não há produtos com marca e preço pago. Preencha a marca no modo supermercado, ou veja “Produto em geral”.'
              : 'Ainda não há produtos com preço pago registrado.'}
          </p>
        </section>
      ) : (
        <>
          <label className="ml-field pc-product">
            Produto
            <select value={product?.key ?? ''} onChange={(e) => setPicked(e.target.value)}>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label} (por {baseLabel(o.base)}) · {o.stores} {o.stores === 1 ? 'mercado' : 'mercados'}
                </option>
              ))}
            </select>
          </label>
          {product?.mixedBrands && <p className="pc-warn">Este produto foi comprado em marcas diferentes: os preços abaixo misturam marcas.</p>}

          <section className="pc-card">
            <h4>Onde {product?.label} está mais barato</h4>
            {byStore.length >= 2 ? (
              <Bars
                unit={baseLabel(product?.base ?? '')}
                rows={byStore.map((r) => ({ label: r.store, cents: r.cents, best: r.cheapest, sub: `${mode === 'any_brand' && r.brand ? `${r.brand} · ` : ''}${r.date.split('-').reverse().join('/')}` }))}
              />
            ) : (
              <p className="home-muted">
                Só há preço deste produto em {byStore.length === 1 ? `um mercado (${byStore[0].store}: ${formatBrl(byStore[0].cents)} por ${baseLabel(product?.base ?? '')})` : 'nenhum mercado'}. Registre em outro mercado para comparar.
              </p>
            )}
            <small className="home-muted">Preço por {baseLabel(product?.base ?? '')}, o último registrado em cada mercado.</small>
          </section>

          <section className="pc-card">
            <h4>Evolução do preço</h4>
            {timeline.length >= 2 ? (
              <>
                <Line points={timeline} unit={baseLabel(product?.base ?? '')} />
                <p className={`pc-trend${trend != null && trend > 0 ? ' pc-trend--up' : ' pc-trend--down'}`}>
                  {trend == null
                    ? ''
                    : trend > 0
                      ? `Ficou ${String(trend).replace('.', ',')}% mais caro desde ${monthLabel(timeline[0].month)}.`
                      : trend < 0
                        ? `Ficou ${String(Math.abs(trend)).replace('.', ',')}% mais barato desde ${monthLabel(timeline[0].month)}.`
                        : 'O preço ficou igual.'}
                </p>
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Preço médio por {baseLabel(product?.base ?? '')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((p) => (
                      <tr key={p.month}>
                        <td>{monthLabel(p.month)}</td>
                        <td>
                          {formatBrl(p.cents)}
                          {p.count > 1 ? ` (${p.count} compras)` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="home-muted">A linha do tempo aparece quando este produto tiver preço registrado em pelo menos 2 meses diferentes.</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
