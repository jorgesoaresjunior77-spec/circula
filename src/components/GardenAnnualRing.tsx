import { ANNUAL_CYCLE_MONTH_COUNT } from '../types/gardenEvolution'
import type { AnnualCycleBounds } from '../types/gardenEvolution'

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface GardenAnnualRingProps {
  /** `null` = ciclo ainda não começou (regra especial: antes de
   *  2027-01-01) — a roda aparece inteira apagada, com a legenda
   *  explicando quando começa. */
  cycle: AnnualCycleBounds | null
  /** 12 booleans (jan..dez) — ver computeAnnualMonthsLit. Ignorado
   *  quando `cycle` é `null`. */
  monthsLit: readonly boolean[]
  size?: number
}

/**
 * Progressão ANUAL do Meu Jardim (Etapa 6.3, evolução/gamificação) —
 * identidade visual DIFERENTE do mensal (GardenMonthlyRing): um único
 * acento de cor (nunca a paleta de 8 atividades), 12 marcos (um por mês
 * do calendário), cada um acende quando aquele mês concluiu o desafio
 * mensal (garden_monthly_completions). NUNCA baseado em pontos
 * acumulados — só na CONCLUSÃO de cada ciclo mensal (ver
 * computeAnnualMonthsLit, types/gardenEvolution.ts).
 */
export function GardenAnnualRing({ cycle, monthsLit, size = 168 }: GardenAnnualRingProps) {
  const litCount = cycle ? monthsLit.filter(Boolean).length : 0
  const radius = 46

  const marks = Array.from({ length: ANNUAL_CYCLE_MONTH_COUNT }, (_, index) => {
    const angle = (index / ANNUAL_CYCLE_MONTH_COUNT) * 2 * Math.PI - Math.PI / 2
    const cx = 50 + radius * Math.cos(angle)
    const cy = 50 + radius * Math.sin(angle)
    return { index, cx, cy, lit: cycle ? monthsLit[index] : false }
  })

  const label = cycle
    ? `Progressão anual ${cycle.year}: ${litCount} de 12 meses concluídos`
    : 'Progressão anual: ciclo ainda não começou — começa em 1 de janeiro de 2027'

  return (
    <div
      className="garden-annual-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 100 100" className="garden-annual-ring-svg" aria-hidden="true">
        <circle className="garden-annual-ring-track" cx="50" cy="50" r={radius} />
        {marks.map((mark) => (
          <circle
            key={mark.index}
            cx={mark.cx}
            cy={mark.cy}
            r={5.5}
            className={`garden-annual-ring-mark${mark.lit ? ' garden-annual-ring-mark--lit' : ''}`}
          />
        ))}
      </svg>

      <span className="garden-annual-ring-center" aria-hidden="true">
        {cycle ? (
          <>
            <strong>{litCount}</strong>
            <small>/ 12 meses</small>
          </>
        ) : (
          <small className="garden-annual-ring-pending">
            Começa em
            <br />
            01/01/2027
          </small>
        )}
      </span>
    </div>
  )
}

export { MONTH_ABBR }
