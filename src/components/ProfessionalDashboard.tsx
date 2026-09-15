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
 * (16.2.3-B), participantes, desafios ativos, pontos, próximos eventos,
 * publicações recentes e métricas resumidas. Tudo com
 * dados reais (RPCs community_metrics / points_community_summary +
 * consultas que a RLS já libera para a dona) e a linha de `communities`
 * que o Dashboard já carregou (nenhuma RPC nova, nenhuma alteração de RLS).
 *
 * Apresentação editorial (redesign "Visão geral"): seções planas, muito
 * respiro, sem card dentro de card. Nenhum dado, hook, ação ou destino
 * mudou — só o markup/classes.
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
    <div className="panel-overview">
      {/* 1 — Cabeçalho da aba */}
      <header className="panel-overview-head">
        <p className="panel-overview-eyebrow">Painel · Visão geral</p>
        <p className="panel-overview-lede">
          Um resumo do que está acontecendo na sua comunidade.
        </p>
      </header>

      {/* 2 — Precisa de atenção (16.2.3-F / 16.2.3-H C2): pendências
          acionáveis agregadas. Único ponto com véu rosé quando há algo;
          estado calmo e discreto quando não há. */}
      {attention.length === 0 ? (
        <p className="panel-overview-calm">Tudo em dia.</p>
      ) : (
        <section className="panel-overview-attention" aria-label="Precisa de atenção">
          <p className="panel-overview-eyebrow">Precisa de atenção</p>
          <ul className="panel-overview-attention-list">
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
        </section>
      )}

      {/* 3 — Informações da comunidade (16.2.3-A) */}
      <section className="panel-overview-identity" aria-label="Informações da comunidade">
        <div className="panel-overview-cover" aria-hidden="true">
          {coverUrl ? (
            <img src={coverUrl} alt="" />
          ) : (
            <span className="panel-overview-cover-fallback" />
          )}
        </div>

        <div className="panel-overview-identity-body">
          <div className="panel-overview-identity-head">
            <h4 className="panel-overview-name">{community.name}</h4>
            <button
              type="button"
              className="auth-link"
              onClick={() => setEditingInfo((open) => !open)}
            >
              {editingInfo ? 'Fechar' : 'Editar'}
            </button>
          </div>

          {community.description ? (
            <p className="panel-overview-description">{community.description}</p>
          ) : (
            <p className="panel-overview-none">Sem descrição.</p>
          )}

          <p className="panel-overview-path" title={publicPath}>
            {publicPath}
          </p>

          {/* 16.2.3-H (C1) — contadores de membros saíram daqui: aparecem
              no grupo de KPI "Membros" logo abaixo. */}
          <div className="panel-overview-facts">
            <span className="panel-overview-fact">
              Descoberta
              <span
                className={`panel-community-badge${
                  community.is_discoverable ? ' panel-community-badge--open' : ''
                }`}
              >
                {community.is_discoverable ? 'Aberta' : 'Fechada'}
              </span>
            </span>
            <span className="panel-overview-fact">Criada em {createdLabel(community.created_at)}</span>
          </div>

          {editingInfo && (
            <div className="panel-overview-editor">
              <CommunityInfoEditor
                community={community}
                profileId={profileId}
                onSave={(patch) => onUpdateCommunity(community.id, patch)}
                onClose={() => setEditingInfo(false)}
              />
            </div>
          )}
        </div>
      </section>

      {/* 4 — Panorama: KPIs de Membros e de Atividade (16.2.3-B).
          Continuam botões; cada um pula para a aba certa via onOpenTab. */}
      <section className="panel-overview-numbers" aria-label="Panorama da comunidade">
        <div className="panel-overview-number-group">
          <p className="panel-overview-eyebrow">Membros</p>
          <div className="panel-overview-kpis">
            {memberKpis.map((kpi) => (
              <button
                key={kpi.label}
                type="button"
                className="panel-overview-kpi"
                onClick={() => onOpenTab(kpi.tab)}
              >
                <span className="panel-overview-kpi-value">{kpi.value}</span>
                <span className="panel-overview-kpi-label">{kpi.label}</span>
              </button>
            ))}
          </div>
          <p className="panel-overview-hint">
            Ativas (30 d) = participantes com pelo menos uma ação (publicação, comentário, reação,
            check-in, desafio ou círculo) nos últimos 30 dias. Novas (30 d) = entraram nos últimos 30
            dias.
          </p>
        </div>

        <div className="panel-overview-number-group">
          <p className="panel-overview-eyebrow">Atividade (30 d)</p>
          <div className="panel-overview-kpis">
            {activityKpis.map((kpi) => (
              <button
                key={kpi.label}
                type="button"
                className="panel-overview-kpi"
                onClick={() => onOpenTab(kpi.tab)}
              >
                <span className="panel-overview-kpi-value">{kpi.value}</span>
                <span className="panel-overview-kpi-label">{kpi.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 5 — Atividade recente (16.2.3-E): timeline plana, sem card. */}
      <section className="panel-overview-timeline-wrap" aria-label="Atividade recente">
        <p className="panel-overview-eyebrow">Atividade recente</p>
        {data.recent_activity.length === 0 ? (
          <p className="panel-overview-line">Nada de novo por aqui ainda.</p>
        ) : (
          <ul className="panel-overview-timeline">
            {data.recent_activity.map((item) => (
              <li key={item.id}>
                <span className="panel-dashboard-clip">
                  {item.actor_name ? `${item.actor_name} ` : ''}
                  {item.summary}
                </span>
                <span className="panel-overview-aside">{formatRelativeTime(item.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 6 — Explorar: os 6 atalhos numa grade leve, separados por espaço
          em branco (sem caixas, sem sombras, sem border-top). Todos os
          links e destinos são os mesmos. */}
      <section className="panel-overview-explore" aria-label="Explorar">
        <p className="panel-overview-eyebrow">Explorar</p>
        <div className="panel-overview-explore-grid">
          <div className="panel-overview-note">
            <div className="panel-overview-note-head">
              <h4 className="panel-overview-note-title">Solicitações pendentes</h4>
              <button
                type="button"
                className="auth-link"
                onClick={() => onOpenTab('participantes')}
              >
                Revisar
              </button>
            </div>
            <p className="panel-overview-line">
              {membersPending === 0
                ? 'Nenhuma solicitação de entrada aguardando.'
                : `${membersPending} solicitação(ões) aguardando sua aprovação.`}
            </p>
          </div>

          <div className="panel-overview-note">
            <div className="panel-overview-note-head">
              <h4 className="panel-overview-note-title">Próximos eventos</h4>
              <button type="button" className="auth-link" onClick={() => onOpenTab('eventos')}>
                Abrir
              </button>
            </div>
            {data.upcoming_events.length === 0 ? (
              <p className="panel-overview-line">Nenhum evento agendado.</p>
            ) : (
              <ul className="panel-overview-note-list">
                {data.upcoming_events.map((event) => (
                  <li key={event.id}>
                    <span className="panel-dashboard-clip">{event.title}</span>
                    <span className="panel-overview-aside">{formatEventDate(event.starts_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel-overview-note">
            <div className="panel-overview-note-head">
              <h4 className="panel-overview-note-title">Publicações recentes</h4>
              <button type="button" className="auth-link" onClick={() => onOpenTab('publicacoes')}>
                Abrir
              </button>
            </div>
            {data.recent_posts.length === 0 ? (
              <p className="panel-overview-line">Nenhuma publicação recente.</p>
            ) : (
              <ul className="panel-overview-note-list">
                {data.recent_posts.map((post) => (
                  <li key={post.id}>
                    <span className="panel-dashboard-clip">
                      {post.author_name ? `${post.author_name}: ` : ''}
                      {post.content}
                    </span>
                    <span className="panel-overview-aside">
                      {formatRelativeTime(post.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel-overview-note">
            <div className="panel-overview-note-head">
              <h4 className="panel-overview-note-title">Pontos</h4>
              <button type="button" className="auth-link" onClick={() => onOpenTab('pontos')}>
                Abrir
              </button>
            </div>
            <p className="panel-overview-line">
              {data.points_period} pontos concedidos nos últimos 30 dias ({data.points_all_time} no
              total).
            </p>
            {data.top_earners.length > 0 && (
              <ul className="panel-overview-note-list">
                {data.top_earners.map((earner) => (
                  <li key={earner.profile_id}>
                    <span className="panel-dashboard-clip">
                      {earner.full_name ?? 'Participante'}
                    </span>
                    <span className="panel-overview-aside">{earner.balance} pts</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel-overview-note">
            <div className="panel-overview-note-head">
              <h4 className="panel-overview-note-title">Engajamento (30 dias)</h4>
              <button type="button" className="auth-link" onClick={() => onOpenTab('metricas')}>
                Ver métricas
              </button>
            </div>
            <ul className="panel-overview-note-list">
              <li>
                <span>Publicações</span>
                <span className="panel-overview-aside">{data.posts_count}</span>
              </li>
              <li>
                <span>Comentários</span>
                <span className="panel-overview-aside">{data.comments_count}</span>
              </li>
              <li>
                <span>Reações</span>
                <span className="panel-overview-aside">{data.reactions_count}</span>
              </li>
              <li>
                <span>Participantes inativas</span>
                <span className="panel-overview-aside">{data.members_inactive}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
