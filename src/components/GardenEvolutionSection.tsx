import { useMemo } from 'react'
import { useGardenEvolution } from '../hooks/useGardenEvolution'
import { GardenMonthlyRing } from './GardenMonthlyRing'
import { GardenAnnualRing } from './GardenAnnualRing'
import { GardenBloom, GARDEN_STAGE_LABEL, gardenStageForPercent } from './GardenBloom'
import { GARDEN_COLOR_HEX, GARDEN_COLORS } from '../types/garden'
import {
  GARDEN_MONTHLY_ACTIVITIES,
  computeAnnualCycle,
  computeAnnualMonthsLit,
  computeMonthlyProgress,
  currentPeriodMonth,
} from '../types/gardenEvolution'
import type { GardenPointSource } from '../types/gardenEvolution'

// Etapa 6.4 (evolução/experiência/gamificação) — bloco de evolução do
// Meu Jardim: roda mensal (bolinhas por atividade + progresso), roda
// anual (12 meses), matriz de pontuação explicada, e mensagem de
// conquista quando o mês é concluído. Mostrado tanto na página do Meu
// Jardim (GardenMemberView) quanto, de forma compacta, no perfil
// (Etapa 7, ProfileCard) — mesmo componente, prop `compact` controla a
// densidade sem duplicar nenhuma lógica/consulta.
interface GardenEvolutionSectionProps {
  communityId: string
  profileId: string
  /** Perfil (Etapa 7) — só os dois anéis + resumo, sem a lista de
   *  atividades nem o histórico (evita "painel carregado" no perfil). */
  compact?: boolean
}

export function GardenEvolutionSection({
  communityId,
  profileId,
  compact = false,
}: GardenEvolutionSectionProps) {
  const { currentMonthActivities, currentMonthPoints, completions, loading, error } =
    useGardenEvolution(communityId, profileId)

  const earnedSources = useMemo(
    () => new Set(currentMonthActivities.map((row) => row.source as GardenPointSource)),
    [currentMonthActivities],
  )

  const cycle = useMemo(() => computeAnnualCycle(), [])
  const monthsLit = useMemo(
    () => (cycle ? computeAnnualMonthsLit(cycle, completions) : []),
    [cycle, completions],
  )

  const progress = computeMonthlyProgress(currentMonthPoints)
  const stage = gardenStageForPercent(progress.percent)
  const thisMonthAlreadyCompleted = completions.some(
    (c) => c.period_month === currentPeriodMonth(),
  )

  if (loading) {
    return <p className="home-muted">Carregando sua evolução no Meu Jardim…</p>
  }

  if (error) {
    // Até a migration 20261030140000 ser aplicada no banco remoto, esta
    // consulta falha (tabela ainda não existe) — mesma UX de qualquer
    // outra falha de carregamento, sem mensagem especial nem crash.
    return <p className="auth-error">Evolução do Meu Jardim indisponível no momento.</p>
  }

  return (
    <section className="garden-evolution" aria-label="Evolução no Meu Jardim">
      <div className={`garden-evolution-hero${compact ? ' garden-evolution-hero--compact' : ''}`}>
        <GardenBloom
          stage={stage}
          size={compact ? 84 : 120}
          label={`Seu jardim neste mês: ${GARDEN_STAGE_LABEL[stage]}`}
        />
        <div className="garden-evolution-hero-text">
          <p className="garden-evolution-hero-stage">{GARDEN_STAGE_LABEL[stage]}</p>
          <p className="garden-evolution-hero-hint">
            {progress.complete
              ? 'Meta do mês alcançada. Seu jardim está completo.'
              : `${progress.points} de ${progress.goal} pontos neste mês. Faltam ${progress.remaining}.`}
          </p>
        </div>
      </div>

      <div className="garden-evolution-rings">
        <div className="garden-evolution-ring-block">
          <GardenMonthlyRing points={currentMonthPoints} earnedSources={earnedSources} />
          <span className="garden-evolution-ring-label">Desafio do mês</span>
        </div>
        <div className="garden-evolution-ring-block">
          <GardenAnnualRing cycle={cycle} monthsLit={monthsLit} />
          <span className="garden-evolution-ring-label">
            Progressão anual{cycle ? ` ${cycle.year}` : ''}
          </span>
        </div>
      </div>

      {progress.complete && thisMonthAlreadyCompleted && (
        <p className="garden-evolution-achievement" role="status">
          🌸 Você concluiu o desafio deste mês! Uma nova etapa do seu Jardim foi desbloqueada.
        </p>
      )}

      {!compact && (
        <>
          <ul className="garden-evolution-activity-list">
            {GARDEN_MONTHLY_ACTIVITIES.map((activity, index) => (
              <li key={activity.source} className="garden-evolution-activity-row">
                <span
                  className="garden-evolution-activity-dot"
                  style={{
                    backgroundColor: GARDEN_COLOR_HEX[GARDEN_COLORS[index % GARDEN_COLORS.length]],
                  }}
                  aria-hidden="true"
                />
                <span className="garden-evolution-activity-info">
                  <span className="garden-evolution-activity-name">{activity.label}</span>
                  <span className="garden-evolution-activity-hint">{activity.hint}</span>
                </span>
                <span className="garden-evolution-activity-points">+{activity.points}</span>
              </li>
            ))}
          </ul>

          {completions.length > 0 && (
            <div className="garden-evolution-history">
              <p className="garden-evolution-ring-label">Meses concluídos</p>
              <ul className="garden-history-list">
                {completions.map((completion) => (
                  <li key={completion.id} className="garden-history-item">
                    <span className="garden-history-item-title">
                      {new Date(`${completion.period_month}T00:00:00Z`).toLocaleDateString('pt-BR', {
                        month: 'long',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </span>
                    <span>{completion.total_points} pontos</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
