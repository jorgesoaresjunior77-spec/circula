import { useId } from 'react'
import { GARDEN_COLOR_HEX, GARDEN_COLORS } from '../types/garden'
import { GARDEN_MONTHLY_ACTIVITIES, computeMonthlyProgress } from '../types/gardenEvolution'
import type { GardenPointSource } from '../types/gardenEvolution'

interface GardenMonthlyRingProps {
  /** Pontos do mês corrente (já somados pelo chamador — useGardenEvolution.currentMonthPoints). */
  points: number
  /** Quais fontes já pontuaram pelo menos 1x este mês — acende a bolinha
   *  correspondente (ver GARDEN_MONTHLY_ACTIVITIES, 8 fontes fixas). */
  earnedSources: ReadonlySet<GardenPointSource>
  size?: number
}

/**
 * Desafio MENSAL do Meu Jardim (Etapa 6.1/6.2, evolução/gamificação) —
 * referência visual da pasta identidadevisual/Meu Jardim ("7 Dias para
 * Florescer": círculo com bolinhas coloridas na borda, cada uma um
 * ícone/categoria, acesa com check quando concluída, texto central).
 * Adaptado ao conceito real daqui — não são 7 DIAS fixos de um desafio
 * autoral, são as 8 FONTES de pontuação do mês (GARDEN_MONTHLY_ACTIVITIES):
 * cada bolinha acende (cor cheia + check) assim que a participante ganha
 * pelo menos 1 ponto daquela fonte no mês corrente. O centro mostra o
 * progresso real (GardenProgressWheel/GardenJourneyRing já usam o mesmo
 * anel de preenchimento por stroke-dasharray — percentual de
 * `points/meta`, nunca um número inventado.
 *
 * 7 cores fixas (GARDEN_COLORS) para 8 fontes — a última repete a
 * primeira (ciclo), aceitável: as bolinhas também se distinguem por
 * posição/rótulo (aria-label), a cor é só reforço visual, não a única
 * forma de identificar qual é qual.
 */
export function GardenMonthlyRing({ points, earnedSources, size = 168 }: GardenMonthlyRingProps) {
  const gradientId = useId()
  const progress = computeMonthlyProgress(points)

  const dotRadius = 46
  const fillRadius = 34
  const circumference = 2 * Math.PI * fillRadius
  const dashOffset = circumference * (1 - progress.percent / 100)

  const count = GARDEN_MONTHLY_ACTIVITIES.length
  const dots = GARDEN_MONTHLY_ACTIVITIES.map((activity, index) => {
    const angle = (index / count) * 2 * Math.PI - Math.PI / 2
    const cx = 50 + dotRadius * Math.cos(angle)
    const cy = 50 + dotRadius * Math.sin(angle)
    const color = GARDEN_COLOR_HEX[GARDEN_COLORS[index % GARDEN_COLORS.length]]
    const earned = earnedSources.has(activity.source)
    return { ...activity, cx, cy, color, earned }
  })

  return (
    <div
      className="garden-monthly-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Desafio mensal: ${progress.percent}% concluído, ${progress.points} de ${progress.goal} pontos. ${
        progress.complete ? 'Mês concluído!' : `Faltam ${progress.remaining} pontos.`
      }`}
    >
      <svg viewBox="0 0 100 100" className="garden-monthly-ring-svg" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--ink-action)" />
            <stop offset="100%" stopColor="var(--circula-mocha)" />
          </linearGradient>
        </defs>

        {/* Progresso começa às 12h, igual a GardenProgressWheel — rotação
            só neste grupo (não no SVG inteiro, como lá), porque as
            bolinhas abaixo já calculam a posição certa via trigonometria
            e não devem rotacionar de novo junto. */}
        <g transform="rotate(-90 50 50)">
          <circle className="garden-monthly-ring-track" cx="50" cy="50" r={fillRadius} />
          <circle
            className="garden-monthly-ring-fill"
            cx="50"
            cy="50"
            r={fillRadius}
            stroke={`url(#${gradientId})`}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </g>

        {dots.map((dot) => (
          <circle
            key={dot.source}
            cx={dot.cx}
            cy={dot.cy}
            r={7}
            className="garden-monthly-ring-dot"
            fill={dot.earned ? dot.color : 'var(--surface)'}
            stroke={dot.color}
            strokeWidth={dot.earned ? 0 : 1.5}
          />
        ))}
      </svg>

      <span className="garden-monthly-ring-center" aria-hidden="true">
        <strong>{progress.points}</strong>
        <small>/ {progress.goal} pts</small>
      </span>
    </div>
  )
}
