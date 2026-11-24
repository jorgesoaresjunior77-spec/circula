import { formatBrl, nomeMesCurto } from '../lib/financas'
import type { PontoHistorico } from '../lib/financas'

// Gráficos do módulo Finanças, desenhados em SVG (sem biblioteca). Cores do Círcula:
// receitas dourado, gastos terracota, investido marrom-rosé. Sem verde.

export const COR_RECEITA = '#B8893F'
export const COR_GASTO = '#C0705F'
export const COR_INVEST = '#85695D'
const FATIAS = ['#C0705F', '#D2A28A', '#A8704C', '#D6B286', '#85695D', '#B8893F', '#E0B9A5', '#9C7B5E', '#CFA27F', '#7A5547', '#DDC3A5', '#B38873']

export interface Fatia {
  chave: string
  nome: string
  valor: number
}

export function Donut({ fatias }: { fatias: Fatia[] }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0)
  if (total <= 0) return <p className="home-muted">Sem gastos neste mês.</p>
  const R = 60
  const C = 2 * Math.PI * R
  let acumulado = 0
  return (
    <div className="fin-donut">
      <svg viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="Gastos por categoria">
        <circle cx="80" cy="80" r={R} fill="none" stroke="#E8DECF" strokeWidth="26" />
        {fatias.map((f, i) => {
          const len = (f.valor / total) * C
          const el = (
            <circle
              key={f.chave}
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke={FATIAS[i % FATIAS.length]}
              strokeWidth="26"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-acumulado}
              transform="rotate(-90 80 80)"
            />
          )
          acumulado += len
          return el
        })}
        <text x="80" y="76" textAnchor="middle" fontSize="11" fill="#85695D">
          Gastos
        </text>
        <text x="80" y="94" textAnchor="middle" fontSize="13" fontWeight="600" fill="#5A463A">
          {formatBrl(total)}
        </text>
      </svg>
      <ul className="fin-legend">
        {fatias.map((f, i) => (
          <li key={f.chave}>
            <span className="fin-dot" style={{ background: FATIAS[i % FATIAS.length] }} aria-hidden="true" />
            <span>{f.nome}</span>
            <strong>{Math.round((f.valor / total) * 100)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Barras({ itens }: { itens: { nome: string; valor: number; cor: string }[] }) {
  const max = Math.max(1, ...itens.map((i) => Math.abs(i.valor)))
  return (
    <ul className="fin-bars">
      {itens.map((i) => (
        <li key={i.nome}>
          <span className="fin-bar-nome">{i.nome}</span>
          <span className="fin-bar-trilho">
            <span className="fin-bar-fill" style={{ width: `${(Math.abs(i.valor) / max) * 100}%`, background: i.cor }} />
          </span>
          <strong>{formatBrl(i.valor)}</strong>
        </li>
      ))}
    </ul>
  )
}

/** Curva suave (Catmull-Rom -> Bézier) por todos os pontos. */
function curva(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`
  }
  return d
}

export function Ondas({ pontos, selecionado, onPick }: { pontos: PontoHistorico[]; selecionado: string; onPick: (chave: string) => void }) {
  const W = 320
  const H = 150
  const pad = 14
  const max = Math.max(1, ...pontos.flatMap((p) => [p.receitas, p.gastos]))
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, pontos.length - 1)
  const y = (v: number) => H - 22 - (v / max) * (H - 44)
  const serie = (get: (p: PontoHistorico) => number): [number, number][] => pontos.map((p, i) => [x(i), y(get(p))])
  const area = (s: [number, number][]) => `${curva(s)} L${s[s.length - 1][0]},${H - 22} L${s[0][0]},${H - 22} Z`
  const rec = serie((p) => p.receitas)
  const gas = serie((p) => p.gastos)
  const iSel = pontos.findIndex((p) => p.chave === selecionado)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fin-ondas" role="img" aria-label="Receitas e gastos mês a mês">
      <path d={area(rec)} fill={COR_RECEITA} opacity="0.18" />
      <path d={area(gas)} fill={COR_GASTO} opacity="0.18" />
      <path d={curva(rec)} fill="none" stroke={COR_RECEITA} strokeWidth="2.4" strokeLinecap="round" />
      <path d={curva(gas)} fill="none" stroke={COR_GASTO} strokeWidth="2.4" strokeLinecap="round" />
      {iSel >= 0 && <line x1={x(iSel)} x2={x(iSel)} y1={10} y2={H - 22} stroke="#85695D" strokeDasharray="3 3" />}
      {pontos.map((p, i) => (
        <g key={p.chave} onClick={() => onPick(p.chave)} style={{ cursor: 'pointer' }}>
          <rect x={x(i) - 12} y={0} width={24} height={H} fill="transparent" />
          <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill={p.chave === selecionado ? '#5A463A' : '#85695D'} fontWeight={p.chave === selecionado ? 700 : 400}>
            {nomeMesCurto(p.chave)}
          </text>
        </g>
      ))}
    </svg>
  )
}
