import type { GardenShareSummary } from '../types/post'
import { GARDEN_COLOR_HEX } from '../types/garden'
import type { GardenColor } from '../types/profile'

interface GardenShareCardProps {
  share: GardenShareSummary
  /** `post.content` — texto livre opcional digitado pela Member ao compartilhar ("Conte como foi"). */
  content?: string | null
}

function hexOf(color: string | null): string | null {
  return color && color in GARDEN_COLOR_HEX ? GARDEN_COLOR_HEX[color as GardenColor] : null
}

/**
 * Composição visual do compartilhamento de conclusão de um Member
 * (Meu Jardim) no Feed — substitui o corpo padrão de texto do PostCard
 * quando `post.post_type === 'garden_share'`. TODOS os dados aqui são
 * um SNAPSHOT congelado no momento da publicação (garden_shares) —
 * nunca mudam depois, mesmo que o desafio/dia/cores do perfil mudem.
 */
export function GardenShareCard({ share, content }: GardenShareCardProps) {
  const colorOne = hexOf(share.color_one) ?? '#c9b48f'
  const colorTwo = hexOf(share.color_two) ?? colorOne
  const percent = share.total_days > 0 ? Math.round((share.days_completed / share.total_days) * 100) : 0
  const trimmedContent = content?.trim()

  return (
    <div
      className="garden-feed-card garden-feed-card--share"
      style={
        {
          '--garden-share-color-1': colorOne,
          '--garden-share-color-2': colorTwo,
        } as React.CSSProperties
      }
    >
      <div className="garden-feed-card-eyebrow">
        <span aria-hidden="true">🌼</span> Meu Jardim · concluiu o dia {share.day_number}
      </div>
      <p className="garden-feed-card-challenge">{share.challenge_title}</p>
      <p className="garden-feed-card-day">{share.day_title}</p>
      <div className="garden-share-progress">
        <div className="garden-share-progress-bar">
          <div className="garden-share-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="garden-share-progress-label">
          {share.days_completed}/{share.total_days} dias · {percent}%
        </span>
      </div>
      {trimmedContent && <p className="garden-feed-card-message">{trimmedContent}</p>}
    </div>
  )
}
