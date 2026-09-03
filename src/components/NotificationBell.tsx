import { useEffect, useRef, useState } from 'react'
import { useSocialNotifications } from '../hooks/useSocialNotifications'
import type { SocialNotification, SocialNotificationType } from '../types/notification'
import type { NavKey } from './PrimaryNav'
import { NotificationList } from './NotificationList'
import { BellIcon } from './icons'

interface NotificationBellProps {
  profileId: string
  onNavigate: (key: NavKey) => void
  /** Abrir uma conversa específica (notificações de mensagem direta). */
  onOpenConversation?: (conversationId: string) => void
}

// Destino de navegação por tipo — mapeado só para chaves de navegação
// que já existem, sem reestruturar a navegação.
const TYPE_TO_NAV: Record<SocialNotificationType, NavKey> = {
  post_comment: 'comunidades',
  post_reaction: 'comunidades',
  circle_join: 'circulos',
  event_rsvp: 'eventos',
  challenge_comment: 'inicio',
  direct_message: 'mensagens',
  // Notificação de pedido de ajuda vai sempre para a dona da comunidade
  // → leva à fila no Painel.
  help_request: 'painel',
}

export function NotificationBell({
  profileId,
  onNavigate,
  onOpenConversation,
}: NotificationBellProps) {
  const { notifications, loading, error, unreadCount, markRead, markAllRead, refresh } =
    useSocialNotifications(profileId)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    refresh()

    function handlePointer(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, refresh])

  async function handleItemClick(notification: SocialNotification) {
    await markRead(notification.id)
    setOpen(false)
    if (
      notification.type === 'direct_message' &&
      notification.related_conversation_id &&
      onOpenConversation
    ) {
      onOpenConversation(notification.related_conversation_id)
      return
    }
    onNavigate(TYPE_TO_NAV[notification.type])
  }

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className="notification-bell-button"
        aria-label={
          unreadCount > 0
            ? `Notificações, ${unreadCount} não lidas`
            : 'Notificações'
        }
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <BellIcon size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-panel" role="dialog" aria-label="Notificações">
          <div className="notification-panel-head">
            <span>Notificações</span>
            {unreadCount > 0 && (
              <button type="button" className="auth-link" onClick={() => markAllRead()}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          <NotificationList
            notifications={notifications}
            loading={loading}
            error={error}
            onItemClick={handleItemClick}
          />
        </div>
      )}
    </div>
  )
}
