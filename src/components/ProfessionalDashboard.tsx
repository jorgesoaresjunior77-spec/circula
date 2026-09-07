import { useState } from 'react'
import { useProfessionalDashboard } from '../hooks/useProfessionalDashboard'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { CommunityInfoEditor } from './CommunityInfoEditor'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { formatEventDate } from '../lib/formatEventDate'
import type { CommunityUpdateInput, CommunityWithMembers } from '../types/community'

interface ProfessionalDashboardProps {
  /** Comunidade já carregada (useCommunity) — nenhuma consulta nova é feita aqui. */
  community: CommunityWithMembers
  /** auth.uid() da Professional — repassado ao editor (16.2.3-G / CoverImageInput). */
  profileId: string
  /** Pular para outra aba do painel a partir dos blocos. */
  onOpenTab: (tab: string) => void
  /** 16.2.3-G — salva as informações básicas da comunidade (useCommunity.updateCommunity). */
  onUpdateCommunity: (
    communityId: string,
    patch: CommunityUpdateInput,
  ) => Promise<{ error: string | null }>
}

const CREATED_FMT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

function createdLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return CREATED_FMT.format(date)
}

/**
 * Home do painel Professional. Mostra o que importa logo na entrada —
 * identidade da comunidade (16.2.3-A), contadores de membros separados
 * (16.2.3-B), participantes, ajuda pendente, desafios ativos, pontos,
 * próximos eventos, publicações recentes e métricas resumidas. Tudo com
 * dados reais (RPCs community_metrics / points_community_summary +
 * consultas que a RLS já libera para a dona) e a linha de `communities`
 * que o Dashboard já carregou (nenhuma RPC nova, nenhuma alteração de RLS).
 */
export function ProfessionalDashboard({
  community,
  profileId,
  onOpenTab,
  onUpdateCommunity,
}: ProfessionalDashboardProps) {
  const { data, loading, error } = useProfessionalDashboard(community.id, 30)
  const { url: coverUrl } = useSignedImageUrl(community.cover_image_url)
  const [editingInfo, setEditingInfo] = useState(false)

  if (loading) return <p className="home-muted">Carregando o painel...</p>
  if (error) return <p className="auth-error">Não foi possível carregar o painel agora.</p>

  // 16.2.3-B — pendentes/bloqueadas vêm da lista de membros que o
  // Dashboard já carregou (COMMUNITY_SELECT traz todos os status; a RLS
  // de community_members já libera isso para a dona). Sem consulta nova.
  const membersPending = community.community_members.filter((m) => m.status === 'pending').length
  const membersBlocked = community.community_members.filter((m) => m.status === 'blocked').length

  const publicPath = `${window.location.origin}/c/${community.slug}`

  // 16.2.3-B — contadores de membros, separados e rotulados sem ambiguidade.
  const memberKpis: { label: string; value: number | string; tab: string }[] = [
    { label: 'Membros', value: data.members_total, tab: 'participantes' },
    { label: 'Ativas (30 d)', value: data.members_active, tab: 'participantes' },
    { label: 'Novas (30 d)', value: data.members_new, tab: 'participantes' },
    { label: 'Pendentes', value: membersPending, tab: 'participantes' },
    { label: 'Bloqueadas', value: membersBlocked, tab: 'participantes' },
  ]

  const activityKpis: { label: string; value: number | string; tab: string }[] = [
    { label: 'Ajuda pendente', value: data.help_pending, tab: 'ajuda' },
    { label: 'Desafios ativos', value: data.challenges_active, tab: 'desafios' },
    { label: 'Pontos (30 d)', value: data.points_period, tab: 'pontos' },
    { label: 'Publicações', value: data.posts_count, tab: 'publicacoes' },
  ]

  // 16.2.3-F — "Precisa de atenção": só pendências acionáveis, todas de
  // dados já disponíveis. Cada item leva à aba certa via onOpenTab.
  // O "≤ 24 h" do próximo evento é calculado no hook (data.next_event_within_24h).
  const nextEvent = data.upcoming_events[0] ?? null
  const nextEventSoon = data.next_event_within_24h && !!nextEvent
  const attention: { key: string; text: string; action: string; tab: string }[] = []
  if (membersPending > 0) {
    attention.push({
      key: 'pending',
      text: `${membersPending} solicitação(ões) de entrada aguardando aprovação`,
      action: 'Revisar',
      tab: 'participantes',
    })
  }
  if (data.help_pending > 0) {
    attention.push({
      key: 'help',
      text: `${data.help_pending} pedido(s) de ajuda sem resposta`,
      action: 'Responder',
      tab: 'ajuda',
    })
  }
  if (nextEventSoon && nextEvent) {
    attention.push({
      key: 'event',
      text: `Evento nas próximas 24 h: ${nextEvent.title} — ${formatEventDate(nextEvent.starts_at)}`,
      action: 'Ver',
      tab: 'eventos',
    })
  }
  if (data.challenges_ending_soon > 0) {
    attention.push({
      key: 'challenges',
      text: `${data.challenges_ending_soon} desafio(s) terminando em até 3 dias`,
      action: 'Ver',
      tab: 'desafios',
    })
  }

  return (
    <div className="panel-dashboard">
      {/* 16.2.3-F — "Precisa de atenção": pendências acionáveis agregadas.
          16.2.3-H (C2) — movido para o topo da Visão geral; conteúdo e
          lógica inalterados. */}
      <section className="community-card community-card--quiet panel-dashboard-block">
        <div className="panel-dashboard-block-head">
          <h4>Precisa de atenção</h4>
        </div>
        {attention.length === 0 ? (
          <p className="panel-dashboard-line">Tudo em dia. 🌿</p>
        ) : (
          <ul className="panel-dashboard-list">
            {attention.map((item) => (
              <li key={item.key}>
                <span className="panel-dashboard-clip">{item.text}</span>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => onOpenTab(item.tab)}
                >
                  {item.action}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 16.2.3-A — Informações da comunidade */}
      <section className="community-card community-card--quiet panel-community-info">
        <div className="panel-dashboard-block-head">
          <h4>Informações da comunidade</h4>
          <button
            type="button"
            className="auth-link"
            onClick={() => setEditingInfo((open) => !open)}
          >
            {editingInfo ? 'Fechar' : 'Editar'}
          </button>
        </div>

        <div className="panel-community-info-main">
          <div className="panel-community-cover" aria-hidden="true">
            {coverUrl ? (
              <img src={coverUrl} alt="" />
            ) : (
              <span className="panel-community-cover-fallback" />
            )}
          </div>
          <div className="panel-community-identity">
            <h4>{community.name}</h4>
            {community.description ? (
              <p className="panel-community-description">{community.description}</p>
            ) : (
              <p className="panel-dashboard-muted">Sem descrição.</p>
            )}
            <p className="panel-community-path" title={publicPath}>
              {publicPath}
            </p>
          </div>
        </div>

        {/* 16.2.3-H (C1) — contadores de membros (Total/Pendentes/Bloqueados)
            saíram daqui: já aparecem no grupo de KPI "Membros" logo abaixo. */}
        <ul className="panel-community-facts">
          <li>
            <span>Descoberta</span>
            <span
              className={`panel-community-badge${
                community.is_discoverable ? ' panel-community-badge--open' : ''
              }`}
            >
              {community.is_discoverable ? 'Aberta' : 'Fechada'}
            </span>
          </li>
          <li>
            <span>Criada em</span>
            <span>{createdLabel(community.created_at)}</span>
          </li>
        </ul>

        {editingInfo && (
          <CommunityInfoEditor
            community={community}
            profileId={profileId}
            onSave={(patch) => onUpdateCommunity(community.id, patch)}
            onClose={() => setEditingInfo(false)}
          />
        )}
      </section>

      {/* 16.2.3-B — KPIs de membros, separados dos de atividade */}
      <div className="panel-dashboard-kpi-group">
        <p className="metrics-section-title">Membros</p>
        <div className="panel-dashboard-kpis">
          {memberKpis.map((kpi) => (
            <button
              key={kpi.label}
              type="button"
              className="metric-tile panel-dashboard-kpi"
              onClick={() => onOpenTab(kpi.tab)}
            >
              <p className="metric-tile-value">{kpi.value}</p>
              <p className="metric-tile-label">{kpi.label}</p>
            </button>
          ))}
        </div>
        <p className="metrics-hint">
          Ativas (30 d) = participantes com pelo menos uma ação (publicação, comentário, reação,
          check-in, desafio ou círculo) nos últimos 30 dias. Novas (30 d) = entraram nos últimos 30
          dias.
        </p>
      </div>

      <div className="panel-dashboard-kpi-group">
        <p className="metrics-section-title">Atividade (30 d)</p>
        <div className="panel-dashboard-kpis">
          {activityKpis.map((kpi) => (
            <button
              key={kpi.label}
              type="button"
              className="metric-tile panel-dashboard-kpi"
              onClick={() => onOpenTab(kpi.tab)}
            >
              <p className="metric-tile-value">{kpi.value}</p>
              <p className="metric-tile-label">{kpi.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 16.2.3-E — timeline "Atividade recente": novas participantes,
          desafios criados e conteúdos publicados, ordenados por data. */}
      <section className="community-card community-card--quiet panel-dashboard-block">
        <div className="panel-dashboard-block-head">
          <h4>Atividade recente</h4>
        </div>
        {data.recent_activity.length === 0 ? (
          <p className="panel-dashboard-line">Nada de novo por aqui ainda. 🌱</p>
        ) : (
          <ul className="panel-dashboard-list">
            {data.recent_activity.map((item) => (
              <li key={item.id}>
                <span className="panel-dashboard-clip">
                  {item.actor_name ? `${item.actor_name} ` : ''}
                  {item.summary}
                </span>
                <span className="panel-dashboard-muted">{formatRelativeTime(item.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="panel-dashboard-grid">
        {/* 16.2.3-C — nudge compacto: a fila completa (aprovar/rejeitar)
            fica na aba Participantes; aqui só a contagem + atalho. */}
        <section className="community-card community-card--quiet panel-dashboard-block">
          <div className="panel-dashboard-block-head">
            <h4>Solicitações pendentes</h4>
            <button
              type="button"
              className="auth-link"
              onClick={() => onOpenTab('participantes')}
            >
              Revisar
            </button>
          </div>
          <p className="panel-dashboard-line">
            {membersPending === 0
              ? 'Nenhuma solicitação de entrada aguardando. 🌿'
              : `${membersPending} solicitação(ões) aguardando sua aprovação.`}
          </p>
        </section>

        <section className="community-card community-card--quiet panel-dashboard-block">
          <div className="panel-dashboard-block-head">
            <h4>Pedidos de ajuda</h4>
            <button type="button" className="auth-link" onClick={() => onOpenTab('ajuda')}>
              Abrir
            </button>
          </div>
          <p className="panel-dashboard-line">
            {data.help_pending === 0
              ? 'Nenhum pedido pendente. 🌿'
              : `${data.help_pending} pedido(s) aguardando resposta.`}
          </p>
        </section>

        <section className="community-card community-card--quiet panel-dashboard-block">
          <div className="panel-dashboard-block-head">
            <h4>Próximos eventos</h4>
            <button type="button" className="auth-link" onClick={() => onOpenTab('eventos')}>
              Abrir
            </button>
          </div>
          {data.upcoming_events.length === 0 ? (
            <p className="panel-dashboard-line">Nenhum evento agendado.</p>
          ) : (
            <ul className="panel-dashboard-list">
              {data.upcoming_events.map((event) => (
                <li key={event.id}>
                  <span>{event.title}</span>
                  <span className="panel-dashboard-muted">{formatEventDate(event.starts_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="community-card community-card--quiet panel-dashboard-block">
          <div className="panel-dashboard-block-head">
            <h4>Publicações recentes</h4>
            <button type="button" className="auth-link" onClick={() => onOpenTab('publicacoes')}>
              Abrir
            </button>
          </div>
          {data.recent_posts.length === 0 ? (
            <p className="panel-dashboard-line">Nenhuma publicação recente.</p>
          ) : (
            <ul className="panel-dashboard-list">
              {data.recent_posts.map((post) => (
                <li key={post.id}>
                  <span className="panel-dashboard-clip">
                    {post.author_name ? `${post.author_name}: ` : ''}
                    {post.content}
                  </span>
                  <span className="panel-dashboard-muted">
                    {formatRelativeTime(post.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="community-card community-card--quiet panel-dashboard-block">
          <div className="panel-dashboard-block-head">
            <h4>Pontos</h4>
            <button type="button" className="auth-link" onClick={() => onOpenTab('pontos')}>
              Abrir
            </button>
          </div>
          <p className="panel-dashboard-line">
            {data.points_period} pontos concedidos nos últimos 30 dias ({data.points_all_time} no
            total).
          </p>
          {data.top_earners.length > 0 && (
            <ul className="panel-dashboard-list">
              {data.top_earners.map((earner) => (
                <li key={earner.profile_id}>
                  <span>{earner.full_name ?? 'Participante'}</span>
                  <span className="panel-dashboard-muted">{earner.balance} pts</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="community-card community-card--quiet panel-dashboard-block">
          <div className="panel-dashboard-block-head">
            <h4>Engajamento (30 dias)</h4>
            <button type="button" className="auth-link" onClick={() => onOpenTab('metricas')}>
              Ver métricas
            </button>
          </div>
          <ul className="panel-dashboard-list">
            <li>
              <span>Publicações</span>
              <span className="panel-dashboard-muted">{data.posts_count}</span>
            </li>
            <li>
              <span>Comentários</span>
              <span className="panel-dashboard-muted">{data.comments_count}</span>
            </li>
            <li>
              <span>Reações</span>
              <span className="panel-dashboard-muted">{data.reactions_count}</span>
            </li>
            <li>
              <span>Participantes inativas</span>
              <span className="panel-dashboard-muted">{data.members_inactive}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
