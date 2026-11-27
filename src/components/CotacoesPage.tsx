import { useEffect, useMemo, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { QUOTE_CODES, QUOTE_NAMES, fetchHistory, formatPct, formatQuote, growthPct } from '../lib/quotes'
import type { QuoteCode, QuotePoint } from '../lib/quotes'
import { QuoteCalculator } from './QuoteCalculator'

// Cotações (avulso de R$ 4,90, também no Premium): o crescimento do Dólar, Euro, Bitcoin e Ethereum
// no período escolhido. Um gráfico por moeda (escalas muito diferentes: nunca dois eixos no mesmo gráfico),
// com o valor de agora, o crescimento no período e, ao tocar/passar o dedo, o valor de cada dia.

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
] as const

const W = 320
const H = 120
const PAD = { top: 10, right: 8, bottom: 18, left: 8 }

const DAY = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

function QuoteChart({ code, points }: { code: QuoteCode; points: QuotePoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const geo = useMemo(() => {
    if (points.length < 2) return null
    const xs = points.map((p) => p.at)
    const ys = points.map((p) => p.bid)
    const x0 = Math.min(...xs)
    const x1 = Math.max(...xs)
    let y0 = Math.min(...ys)
    let y1 = Math.max(...ys)
    if (y1 === y0) {
      y0 -= 1
      y1 += 1
    }
    const sx = (x: number) => PAD.left + ((x - x0) / (x1 - x0 || 1)) * (W - PAD.left - PAD.right)
    const sy = (y: number) => PAD.top + (1 - (y - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom)
    const xy = points.map((p) => [sx(p.at), sy(p.bid)] as const)
    const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
    const area = `${line}L${xy[xy.length - 1][0].toFixed(1)},${H - PAD.bottom}L${xy[0][0].toFixed(1)},${H - PAD.bottom}Z`
    return { xy, line, area }
  }, [points])

  if (!geo) return <p className="home-muted">Sem dados suficientes para o gráfico agora.</p>

  function onMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!geo) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    let best = 0
    for (let i = 1; i < geo.xy.length; i += 1) if (Math.abs(geo.xy[i][0] - x) < Math.abs(geo.xy[best][0] - x)) best = i
    setHover(best)
  }

  const h = hover !== null ? points[hover] : null
  const hxy = hover !== null ? geo.xy[hover] : null
  const first = points[0]
  const last = points[points.length - 1]

  return (
    <div className="cot-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${QUOTE_NAMES[code]}: de ${formatQuote(code, first.bid)} em ${DAY.format(first.at)} para ${formatQuote(code, last.bid)} em ${DAY.format(last.at)}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <line className="cot-base" x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} />
        <path className="cot-area" d={geo.area} />
        <path className="cot-line" d={geo.line} />
        <circle className="cot-end" cx={geo.xy[geo.xy.length - 1][0]} cy={geo.xy[geo.xy.length - 1][1]} r={4} />
        <text className="cot-axis" x={PAD.left} y={H - 4}>
          {DAY.format(first.at)}
        </text>
        <text className="cot-axis" x={W - PAD.right} y={H - 4} textAnchor="end">
          {DAY.format(last.at)}
        </text>
        {hxy && (
          <>
            <line className="cot-cross" x1={hxy[0]} x2={hxy[0]} y1={PAD.top} y2={H - PAD.bottom} />
            <circle className="cot-dot" cx={hxy[0]} cy={hxy[1]} r={5} />
          </>
        )}
      </svg>
      {h && (
        <p className="cot-tip" aria-live="polite">
          {DAY.format(h.at)}: <strong>{formatQuote(code, h.bid)}</strong>
        </p>
      )}
    </div>
  )
}

export function CotacoesPage() {
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<Partial<Record<QuoteCode, QuotePoint[]>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError(false)
    Promise.all(QUOTE_CODES.map((c) => fetchHistory(c, days, ctrl.signal).then((pts) => [c, pts] as const)))
      .then((rows) => setData(Object.fromEntries(rows)))
      .catch(() => {
        if (!ctrl.signal.aborted) setError(true)
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })
    return () => ctrl.abort()
  }, [days])

  return (
    <section className="cot-page" aria-labelledby="cot-title">
      <h2 id="cot-title">Cotações</h2>
      <p className="home-muted">Quanto o Dólar, o Euro, o Bitcoin e o Ethereum cresceram (ou caíram) em reais no período.</p>
      <QuoteCalculator />
      <div className="metrics-period" role="group" aria-label="Período">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            className={`metrics-period-button${days === p.days ? ' metrics-period-button--active' : ''}`}
            aria-pressed={days === p.days}
            onClick={() => setDays(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {loading && <p className="home-muted">Carregando…</p>}
      {!loading && error && <p className="auth-error">Não foi possível carregar as cotações agora. Tente de novo em instantes.</p>}
      {!loading && !error && (
        <div className="cot-grid">
          {QUOTE_CODES.map((code) => {
            const pts = data[code] ?? []
            const g = growthPct(pts)
            const dir = g === null ? 'flat' : g > 0 ? 'up' : g < 0 ? 'down' : 'flat'
            const now = pts[pts.length - 1]
            return (
              <article key={code} className="cot-card">
                <header className="cot-card-head">
                  <h3>
                    {QUOTE_NAMES[code]} <small>{code}</small>
                  </h3>
                  {now && <p className="cot-now">{formatQuote(code, now.bid)}</p>}
                  {g !== null && (
                    <p className={`cot-growth cot-growth--${dir}`}>
                      <span aria-hidden="true">{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■'}</span> {formatPct(g)}{' '}
                      <span className="cot-growth-label">{dir === 'up' ? 'de alta' : dir === 'down' ? 'de queda' : 'estável'} em {days} dias</span>
                    </p>
                  )}
                </header>
                <QuoteChart code={code} points={pts} />
              </article>
            )
          })}
        </div>
      )}
      <p className="home-muted cot-source">Fonte: AwesomeAPI (economia.awesomeapi.com.br). Valores de compra, só para consulta.</p>
    </section>
  )
}
