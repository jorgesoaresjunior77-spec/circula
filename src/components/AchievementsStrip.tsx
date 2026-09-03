import { useAchievements } from '../hooks/useAchievements'

interface AchievementsStripProps {
  communityId: string
  profileId: string
}

/**
 * Fase 10 — faixa "Conquistas" na Home. Selos DESBLOQUEADOS (derivados de
 * pontos, desafios, dias e tempo de comunidade) + a próxima conquista
 * mais perto de completar, com barra de progresso. Tom celebratório e
 * de incentivo — parte do equilíbrio acolhimento + alegria + conquista.
 * Some se não houver nada a mostrar.
 */
export function AchievementsStrip({ communityId, profileId }: AchievementsStripProps) {
  const { unlocked, nextAchievement, loading } = useAchievements(communityId, profileId)

  if (loading && unlocked.length === 0 && !nextAchievement) return null
  if (!loading && unlocked.length === 0 && !nextAchievement) return null

  const pct = nextAchievement
    ? Math.min(100, Math.round((nextAchievement.current / nextAchievement.target) * 100))
    : 0

  return (
    <section className="home-section achievements-section" aria-labelledby="achievements-title">
      <div className="home-section-head">
        <h3 id="achievements-title" className="home-section-title">
          Suas conquistas
        </h3>
        {unlocked.length > 0 && (
          <span className="achievements-count">{unlocked.length} desbloqueada{unlocked.length === 1 ? '' : 's'}</span>
        )}
      </div>

      {unlocked.length > 0 ? (
        <ul className="achievements-strip">
          {unlocked.map((a) => (
            <li key={a.id} className="achievement-badge" title={a.description}>
              <span className="achievement-badge-icon" aria-hidden="true">
                {a.icon}
              </span>
              <span className="achievement-badge-title">{a.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="home-muted">
          Suas primeiras conquistas aparecem aqui conforme você participa. 🌱
        </p>
      )}

      {nextAchievement && (
        <div className="achievement-next">
          <p className="achievement-next-label">
            <span aria-hidden="true">{nextAchievement.icon}</span> Próxima: {nextAchievement.title}
          </p>
          <div className="achievement-next-bar" role="img" aria-label={`${pct}% concluído`}>
            <span className="achievement-next-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="achievement-next-meta">
            {nextAchievement.current} de {nextAchievement.target}
          </p>
        </div>
      )}
    </section>
  )
}
