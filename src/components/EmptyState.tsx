import { SproutIcon } from './icons'

interface EmptyStateProps {
  message: string
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <SproutIcon />
      <p>{message}</p>
    </div>
  )
}
