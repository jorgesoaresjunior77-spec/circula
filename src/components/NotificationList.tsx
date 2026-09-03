import type { SocialNotification } from '../types/notification'
import { formatRelativeTime } from '../lib/formatRelativeTime'

interface NotificationListProps {
  notifications: SocialNotification[]
  loading: boolean
  error: string | null
  onItemClick: (notification: SocialNotification) => void
}

export function NotificationList({
  notifications,
  loading,
  error,
  onItemClick,
}: NotificationListProps) {
  if (loading && notifications.length === 0) {
    return <p className="notification-empty">Carregando...</p>
  }

  if (error) {
    return <p className="auth-error">{error}</p>
  }

  if (notifications.length === 0) {
    return <p className="notification-empty">Você está em dia por aqui 🌿</p>
  }

  return (
    <ul className="notification-list">
      {notifications.map((item) => {
        const actorName = item.actor?.full_name ?? null
        return (
          <li key={item.id}>
            <button
              type="button"
              className={`notification-item${item.read_at ? '' : ' notification-item--unread'}`}
              onClick={() => onItemClick(item)}
            >
              <span className="notification-avatar" aria-hidden="true">
                {item.actor?.avatar_url ? (
                  <img src={item.actor.avatar_url} alt="" />
                ) : (
                  <span>{(actorName ?? '·').charAt(0).toUpperCase()}</span>
                )}
              </span>
              <span className="notification-body">
                <span className="notification-title">{item.title}</span>
                {item.body && <span className="notification-text">{item.body}</span>}
                <span className="notification-time">{formatRelativeTime(item.created_at)}</span>
              </span>
              {!item.read_at && <span className="notification-dot" aria-label="Não lida" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
