import type { NavKey } from './PrimaryNav'
import { formatEventDate } from '../lib/formatEventDate'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import {
  CalendarIcon,
  ChevronRightIcon,
  CommunitiesIcon,
  FeedIcon,
  MessageIcon,
  RecipeIcon,
  SparkleIcon,
  UserIcon,
} from './icons'

// Fase 1 — Trilho direito da Home (>= 1280px).
//
// Puramente apresentacional: recebe só dados que o Dashboard já tem em
// mãos (nome/capa/contagem da comunidade em foco e nº de mensagens não
// lidas) e a função de navegação. NÃO instancia hook, NÃO faz consulta,
// NÃO toca Feed/billing/produtos/banco. Serve para a Home continuar
// rica e com as ações importantes sempre visíveis mesmo com o menu
// lateral aberto — botões grandes, ícone + nome, letras legíveis.

interface DashboardRailProps {
  communityName?: string | null
  communityCoverUrl?: string | null
  memberCount?: number
  unreadMessages: number
  /** Fase 10 — resumo leve (só se disponível). */
  pointsBalance?: number
  achievementsCount?: number
  nextEvent?: { title: string; starts_at: string } | null
  onNavigate: (key: NavKey) => void
}

const QUICK_LINKS: { key: NavKey; label: string; Icon: typeof FeedIcon }[] = [
  { key: 'feed', label: 'Feed', Icon: FeedIcon },
  { key: 'receitas', label: 'Receitas', Icon: RecipeIcon },
  { key: 'eventos', label: 'Eventos', Icon: CalendarIcon },
  { key: 'mensagens', label: 'Mensagens', Icon: MessageIcon },
  { key: 'perfil', label: 'Meu perfil', Icon: UserIcon },
]

export function DashboardRail({
  communityName,
  communityCoverUrl,
  memberCount,
  unreadMessages,
  pointsBalance,
  achievementsCount,
  nextEvent,
  onNavigate,
}: DashboardRailProps) {
  const { url: coverUrl } = useSignedImageUrl(communityCoverUrl)
  return (
    <aside className="dashboard-rail" aria-label="Resumo e atalhos">
      {(typeof pointsBalance === 'number' || typeof achievementsCount === 'number') && (
        <section className="rail-card">
          <p className="rail-card-title">Seu resumo</p>
          <div className="rail-summary">
            <button
              type="button"
              className="rail-summary-item"
              onClick={() => onNavigate('inicio')}
            >
              <SparkleIcon size={18} />
              <span className="rail-summary-value">{pointsBalance ?? 0}</span>
              <span className="rail-summary-label">pontos</span>
            </button>
            <button
              type="button"
              className="rail-summary-item"
              onClick={() => onNavigate('inicio')}
            >
              <span className="rail-summary-value">{achievementsCount ?? 0}</span>
              <span className="rail-summary-label">
                conquista{(achievementsCount ?? 0) === 1 ? '' : 's'}
              </span>
            </button>
          </div>
        </section>
      )}

      {nextEvent && (
        <section className="rail-card">
          <p className="rail-card-title">Próximo evento</p>
          <button
            type="button"
            className="rail-next-event"
            onClick={() => onNavigate('eventos')}
          >
            <CalendarIcon size={18} />
            <span className="rail-next-event-text">
              <span className="rail-next-event-title">{nextEvent.title}</span>
              <span className="rail-next-event-date">{formatEventDate(nextEvent.starts_at)}</span>
            </span>
          </button>
        </section>
      )}

      {communityName && (
        <section className="rail-card">
          <p className="rail-card-title">Sua comunidade</p>
          <button
            type="button"
            className="rail-community"
            onClick={() => onNavigate('comunidades')}
          >
            <span className="rail-community-cover" aria-hidden="true">
              {coverUrl ? (
                <img src={coverUrl} alt="" />
              ) : (
                <span>{communityName.charAt(0).toUpperCase()}</span>
              )}
            </span>
            <span className="rail-community-text">
              <span className="rail-community-name">{communityName}</span>
              {typeof memberCount === 'number' && (
                <span className="rail-community-meta">
                  {memberCount === 1 ? '1 mulher' : `${memberCount} mulheres`}
                </span>
              )}
            </span>
            <ChevronRightIcon size={18} />
          </button>
        </section>
      )}

      <section className="rail-card">
        <p className="rail-card-title">Ir rápido</p>
        <ul className="rail-links">
          {QUICK_LINKS.map(({ key, label, Icon }) => (
            <li key={key}>
              <button
                type="button"
                className="rail-link"
                onClick={() => onNavigate(key)}
              >
                <Icon size={22} />
                <span className="rail-link-label">{label}</span>
                {key === 'mensagens' && unreadMessages > 0 && (
                  <span className="rail-link-badge">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rail-card rail-card--quiet">
        <p className="rail-note">
          <CommunitiesIcon size={16} />
          <span>O Círcula é um espaço de cuidado e amizade entre mulheres.</span>
        </p>
      </section>
    </aside>
  )
}
