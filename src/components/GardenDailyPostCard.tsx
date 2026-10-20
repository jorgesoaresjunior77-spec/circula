import type { GardenDailyPostSummary } from '../types/post'

interface GardenDailyPostCardProps {
  summary: GardenDailyPostSummary
}

/**
 * Card editorial da mensagem de incentivo da profissional (Meu Jardim)
 * dentro do Feed — substitui o corpo padrão de texto do PostCard
 * quando `post.post_type === 'garden_daily'`. Dados ao vivo (join com
 * garden_challenges/garden_challenge_days) — não são um snapshot.
 */
export function GardenDailyPostCard({ summary }: GardenDailyPostCardProps) {
  const day = summary.challenge_day

  return (
    <div className="garden-feed-card garden-feed-card--daily">
      <div className="garden-feed-card-eyebrow">
        <span aria-hidden="true">🌱</span> Meu Jardim
        {day && <span> · Dia {day.day_number}</span>}
      </div>
      {summary.challenge && <p className="garden-feed-card-challenge">{summary.challenge.title}</p>}
      {day && (
        <p className="garden-feed-card-day">
          {day.icon ? `${day.icon} ` : ''}
          {day.title}
        </p>
      )}
      {day?.instructions && <p className="garden-feed-card-instructions">{day.instructions}</p>}
      <p className="garden-feed-card-message">{summary.message}</p>
    </div>
  )
}
