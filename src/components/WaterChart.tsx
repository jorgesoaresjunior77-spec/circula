import { useMemo, useState } from 'react'
import { addDaysIso, parseIso } from '../lib/weekCalendar'
import { formatMl } from '../lib/water'

// Evolução do consumo de água: barras por dia, linha da meta e uma bolinha
// verde nos dias em que a meta foi concluída. Visão da semana ou do mês
// (últimos 30 dias). A meta mostrada é a atual (peso informado hoje).

interface Props {
  today: string
  goalMl: number
  totals: Record<string, number>
}

export function WaterChart({ today, goalMl, totals }: Props) {
  const [range, setRange] = useState<7 | 30>(7)

  const days = useMemo(() => Array.from({ length: range }, (_, i) => addDaysIso(today, -(range - 1 - i))), [range, today])
  const values = days.map((d) => totals[d] ?? 0)
  const max = Math.max(goalMl * 1.15, ...values, 1)
  const reachedCount = values.filter((v) => v >= goalMl).length

  const W = 320
  const H = 150
  const padL = 6
  const slot = (W - padL * 2) / range
  const barW = Math.max(4, slot * 0.62)
  const y = (v: number) => H - 22 - (v / max) * (H - 44)

  return (
    <article className="water-panel water-chart" aria-label="Evolução do consumo de água">
      <h3>Minha evolução</h3>
      <div className="water-chart-tabs" role="tablist" aria-label="Período">
        <button type="button" role="tab" aria-selected={range === 7} className={range === 7 ? 'is-on' : ''} onClick={() => setRange(7)}>
          Semana
        </button>
        <button type="button" role="tab" aria-selected={range === 30} className={range === 30 ? 'is-on' : ''} onClick={() => setRange(30)}>
          Mês
        </button>
      </div>
      <p className="water-muted">
        Meta diária: {formatMl(goalMl)} · meta concluída em {reachedCount} {reachedCount === 1 ? 'dia' : 'dias'}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Consumo de água dos últimos ${range} dias`} className="water-chart-svg">
        <line x1={padL} x2={W - padL} y1={y(goalMl)} y2={y(goalMl)} stroke="#7a9a6a" strokeDasharray="4 4" strokeWidth="1" />
        <text x={W - padL} y={y(goalMl) - 4} textAnchor="end" fontSize="8" fill="#5c7a4e">
          meta
        </text>
        {days.map((d, i) => {
          const v = values[i]
          const x = padL + i * slot + (slot - barW) / 2
          const done = v >= goalMl
          const { day } = parseIso(d)
          return (
            <g key={d}>
              <rect x={x} y={y(v)} width={barW} height={Math.max(0, H - 22 - y(v))} rx="3" fill={done ? '#8bbf7a' : '#9ac7dc'} opacity={v === 0 ? 0.25 : 1}>
                <title>{`${day}: ${formatMl(v)}${done ? ' — meta concluída' : ''}`}</title>
              </rect>
              {done && <circle cx={x + barW / 2} cy={y(v) - 7} r={Math.min(5, barW / 2 + 1)} fill="#3f9a4b" />}
              {(range === 7 || i % 5 === 0 || d === today) && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="8" fill="#6b5a4c">
                  {day}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <p className="water-muted">
        <span className="water-dot" aria-hidden="true" /> Bolinha verde = meta do dia concluída.
      </p>
    </article>
  )
}
