import { m } from '../lib/motionKit'
import { useEffect, useRef, useState } from 'react'
import { useSocialNotifications } from '../hooks/useSocialNotifications'
import { useContentReminders } from '../hooks/useContentReminders'
import { useTodayAppointments } from '../hooks/useTodayAppointments'
import type { SocialNotification, SocialNotificationType } from '../types/notification'
import type { NavKey } from './PrimaryNav'
import { NotificationList } from './NotificationList'
import { NotificationBillingStatus } from './NotificationBillingStatus'
import { BellIcon } from './icons'

interface NotificationBellProps {
  profileId: string
  onNavigate: (key: NavKey) => void
  /** Abrir uma conversa específica (notificações de mensagem direta). */
  onOpenConversation?: (conversationId: string) => void
  /** D1 — só a Professional tem assinatura de plataforma para avisar. */
  showBillingStatus?: boolean
  /** Só a Professional: avisos de "amanhã é dia de publicar" da agenda de conteúdos. */
  showContentReminders?: boolean
}

// Destino de navegação por tipo — mapeado só para chaves de navegação
// que já existem, sem reestruturar a navegação.
//
// Reorganização do menu — 'comunidades' não é mais um destino alcançável
// (navItems nunca o inclui). post_comment/post_reaction/membership_* iam
// para lá antes; agora vão para 'feed' (onde a publicação/comunidade
// realmente aparece para a Member) — mesma lógica de "chave que já
// existe", só atualizada para o destino que continua de pé.
const TYPE_TO_NAV: Record<SocialNotificationType, NavKey> = {
  post_comment: 'feed',
  post_reaction: 'feed',
  circle_join: 'circulos',
  event_rsvp: 'eventos',
  direct_message: 'mensagens',
  // 16.2.4-A — ciclo de entrada de membros.
  // A solicitação vai para a dona (Painel → Participantes / "Precisa de
  // atenção"); aprovação e rejeição vão para a Member (sua comunidade).
  membership_requested: 'painel',
  membership_approved: 'feed',
  membership_rejected: 'inicio',
  // A solicitação de Círculo leva a dona direto à lista de pedidos, na tela
  // de Círculos (CircleRequestReview, com as instruções da membro).
  circle_request: 'circulos',
  // O Círculo pedido foi criado: a membro vai para a lista de Círculos.
  circle_request_approved: 'circulos',
  // Nutri integrada: paciente e nutricionista têm o mesmo destino ('nutri').
  nutri_plan: 'nutri',
  nutri_appointment: 'nutri',
  nutri_message: 'nutri',
  nutri_request: 'nutri',
  nutri_update: 'nutri',
  nutri_link: 'nutri',
}

/** Depois de navegar, rola até o ponto exato da ação (quando ele existe na tela). */
function scrollTargetFor(notification: SocialNotification): string | null {
  switch (notification.type) {
    case 'circle_request':
      return 'circle-requests-review'
    case 'membership_requested':
      return 'panel-participants-section'
    case 'post_comment':
    case 'post_reaction':
      return notification.related_post_id ? `post-${notification.related_post_id}` : null
    default:
      return null
  }
}

function scrollToWhenReady(id: string) {
  let tries = 0
  const timer = window.setInterval(() => {
    tries += 1
    const el = document.getElementById(id)
    if (el) {
      window.clearInterval(timer)
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.classList.add('notification-target')
      window.setTimeout(() => el.classList.remove('notification-target'), 2600)
    } else if (tries > 30) {
      window.clearInterval(timer)
    }
  }, 150)
}

export function NotificationBell({
  profileId,
  onNavigate,
  onOpenConversation,
  showBillingStatus = false,
  showContentReminders = false,
}: NotificationBellProps) {
  const {
    notifications,
    loading,
    error,
    unreadCount: socialUnread,
    markRead,
    markAllRead,
    refresh,
  } = useSocialNotifications(profileId)
  const content = useContentReminders(showContentReminders)
  const agenda = useTodayAppointments(profileId)
  const unreadCount = socialUnread + content.unreadCount + agenda.unreadCount
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
    onNavigate(TYPE_TO_NAV[notification.type] ?? 'inicio')
    const target = scrollTargetFor(notification)
    if (target) scrollToWhenReady(target)
  }

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        id="tour-notification-bell"
        className={`notification-bell-button${unreadCount > 0 ? ' notification-bell-button--ringing' : ''}`}
        aria-label={
          unreadCount > 0
            ? `Notificações, ${unreadCount} não lidas`
            : 'Notificações'
        }
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {/* Com notificação, o sino balança (pendurado pelo topo) e descansa um
            pouco entre um toque e outro; sem notificação, fica parado, em relevo. */}
        <m.span
          className="notification-bell-icon"
          style={{ transformOrigin: '50% 12%' }}
          animate={unreadCount > 0 ? { rotate: [0, -18, 15, -11, 8, -4, 0] } : { rotate: 0 }}
          transition={
            unreadCount > 0
              ? { duration: 1.1, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.8 }
              : { duration: 0.3 }
          }
        >
          <BellIcon size={20} />
        </m.span>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-panel" role="dialog" aria-label="Notificações">
          <div className="notification-panel-head">
            <span className="notification-panel-title">Notificações</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  markAllRead()
                  content.reminders.forEach((r) => content.markRead(r.key))
                  agenda.markRead(agenda.appointments.map((a) => a.id))
                }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          {agenda.appointments.map((a) => (
            <button
              key={`agenda-${a.id}`}
              type="button"
              className={`notification-item notification-item--reminder${a.read ? '' : ' notification-item--unread'}`}
              onClick={() => {
                agenda.markRead([a.id])
                setOpen(false)
                onNavigate('agenda')
              }}
            >
              <span className="notification-body">
                <span className="notification-title">Compromisso de hoje</span>
                <span className="notification-text">
                  {a.all_day ? 'Dia todo' : new Date(a.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {a.title}
                </span>
              </span>
              {!a.read && <span className="notification-dot" aria-label="Não lida" />}
            </button>
          ))}
          {content.reminders.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`notification-item notification-item--reminder${r.read ? '' : ' notification-item--unread'}`}
              onClick={() => {
                content.markRead(r.key)
                setOpen(false)
                onNavigate('painel')
              }}
            >
              <span className="notification-body">
                <span className="notification-title">{r.title}</span>
                <span className="notification-text">{r.text}</span>
              </span>
              {!r.read && <span className="notification-dot" aria-label="Não lida" />}
            </button>
          ))}
          {showBillingStatus && (
            <NotificationBillingStatus
              onActivate={() => {
                setOpen(false)
                onNavigate('painel')
              }}
            />
          )}
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
