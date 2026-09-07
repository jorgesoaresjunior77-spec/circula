import { useState } from 'react'
import { QuestionBankManager } from './QuestionBankManager'
import { ChallengeManager } from './ChallengeManager'
import { CircleManager } from './CircleManager'
import { EventManager } from './EventManager'
import { ContentManager } from './ContentManager'
import { MoodMessageManager } from './MoodMessageManager'
import { CheckinManager } from './CheckinManager'
import { EngagementCommandManager } from './EngagementCommandManager'
import { CommunityMetricsPanel } from './CommunityMetricsPanel'
import { HelpQueue } from './HelpQueue'
import { PointsPanel } from './PointsPanel'
import { ProductManager } from './ProductManager'
import { SubscriptionPanel } from './SubscriptionPanel'
import { AsaasAccountConnect } from './AsaasAccountConnect'
import { CommunityPriceSettings } from './CommunityPriceSettings'
import { RevenuePanel } from './RevenuePanel'
import { ProfessionalDashboard } from './ProfessionalDashboard'
import { CommunityMembersPanel } from './CommunityMembersPanel'
import { PostsModerationPanel } from './PostsModerationPanel'
import type { CommunityUpdateInput, CommunityWithMembers } from '../types/community'

type PanelTab =
  | 'visao'
  | 'participantes'
  | 'publicacoes'
  | 'desafios'
  | 'eventos'
  | 'circulos'
  | 'conteudo'
  | 'ajuda'
  | 'pontos'
  | 'metricas'
  | 'produtos'
  | 'assinaturas'
  | 'recebimentos'

const TABS: { key: PanelTab; label: string }[] = [
  { key: 'visao', label: 'Visão geral' },
  { key: 'participantes', label: 'Participantes' },
  { key: 'publicacoes', label: 'Publicações' },
  { key: 'desafios', label: 'Desafios' },
  { key: 'eventos', label: 'Eventos' },
  { key: 'circulos', label: 'Círculos' },
  { key: 'conteudo', label: 'Conteúdo' },
  { key: 'ajuda', label: 'Pedidos de ajuda' },
  { key: 'pontos', label: 'Pontos' },
  { key: 'metricas', label: 'Métricas' },
  { key: 'produtos', label: 'Produtos' },
  { key: 'assinaturas', label: 'Assinaturas' },
  { key: 'recebimentos', label: 'Recebimentos' },
]

interface ProfessionalPanelProps {
  communityId: string
  /** Comunidade já carregada (useCommunity) — usada pela aba Visão geral. */
  community: CommunityWithMembers
  profileId: string
  onFeedRefresh: () => void
  onOpenConversation: (conversationId: string) => void
  /** RPCs approve/reject_membership_request via useCommunity (16.2.3-C). */
  onApproveMembership: (communityId: string, profileId: string) => Promise<{ error: string | null }>
  onRejectMembership: (communityId: string, profileId: string) => Promise<{ error: string | null }>
  /** 16.2.3-G — salva informações básicas da comunidade (useCommunity.updateCommunity). */
  onUpdateCommunity: (
    communityId: string,
    patch: CommunityUpdateInput,
  ) => Promise<{ error: string | null }>
}

export function ProfessionalPanel({
  communityId,
  community,
  profileId,
  onFeedRefresh,
  onOpenConversation,
  onApproveMembership,
  onRejectMembership,
  onUpdateCommunity,
}: ProfessionalPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('visao')

  return (
    <section className="community-card community-card--quiet professional-panel">
      <h3>Painel da comunidade</h3>

      <div className="panel-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`panel-tab${activeTab === tab.key ? ' panel-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'visao' && (
        <div className="panel-tab-content">
          <ProfessionalDashboard
            community={community}
            profileId={profileId}
            onOpenTab={(tab) => setActiveTab(tab as PanelTab)}
            onUpdateCommunity={onUpdateCommunity}
          />
        </div>
      )}

      {activeTab === 'participantes' && (
        <div className="panel-tab-content">
          {/* 16.2.3-C/D — roster por status (Todas/Ativas/Pendentes/Bloqueadas).
              "Ativas" mantém o ParticipantsPanel (RPC community_participants_overview);
              "Pendentes"/"Bloqueadas" leem community.community_members já carregado.
              Aprovar/rejeitar segue nas RPCs approve/reject_membership_request. */}
          <CommunityMembersPanel
            communityId={communityId}
            community={community}
            onApprove={onApproveMembership}
            onReject={onRejectMembership}
          />
        </div>
      )}

      {activeTab === 'publicacoes' && (
        <div className="panel-tab-content">
          <PostsModerationPanel communityId={communityId} />
        </div>
      )}

      {activeTab === 'desafios' && (
        <div className="panel-tab-content">
          <ChallengeManager communityId={communityId} profileId={profileId} canManage canParticipate />
        </div>
      )}

      {activeTab === 'eventos' && (
        <div className="panel-tab-content">
          <EventManager communityId={communityId} profileId={profileId} canManage />
        </div>
      )}

      {activeTab === 'circulos' && (
        <div className="panel-tab-content">
          <CircleManager communityId={communityId} profileId={profileId} canManage canParticipate />
        </div>
      )}

      {activeTab === 'conteudo' && (
        <div className="panel-tab-content">
          <QuestionBankManager
            communityId={communityId}
            authorId={profileId}
            canManage
            onPublished={onFeedRefresh}
          />
          <ContentManager communityId={communityId} profileId={profileId} canManage />
          <CheckinManager
            communityId={communityId}
            profileId={profileId}
            canManage
            canParticipate
            onShared={onFeedRefresh}
          />
          <MoodMessageManager communityId={communityId} profileId={profileId} />
          <EngagementCommandManager
            communityId={communityId}
            authorId={profileId}
            canManage
            onPublished={onFeedRefresh}
          />
        </div>
      )}

      {activeTab === 'ajuda' && (
        <div className="panel-tab-content">
          <HelpQueue
            communityId={communityId}
            profileId={profileId}
            onOpenConversation={onOpenConversation}
          />
        </div>
      )}

      {activeTab === 'pontos' && (
        <div className="panel-tab-content">
          <PointsPanel communityId={communityId} profileId={profileId} />
        </div>
      )}

      {activeTab === 'metricas' && (
        <div className="panel-tab-content">
          <CommunityMetricsPanel communityId={communityId} />
        </div>
      )}

      {activeTab === 'produtos' && (
        <div className="panel-tab-content">
          <ProductManager communityId={communityId} profileId={profileId} canManage />
        </div>
      )}

      {activeTab === 'assinaturas' && (
        <div className="panel-tab-content">
          <SubscriptionPanel subject="platform" />
          {/* FASE 16.1 — onboarding financeiro: conectar a conta Asaas
              recebedora do split 90/10. Só a anfitriã chega ao painel. */}
          <AsaasAccountConnect enabled />
          {/* FASE 16.1-P — preço da assinatura da própria comunidade
              (piso R$ 14,90, validado no servidor). */}
          <CommunityPriceSettings communityId={communityId} />
        </div>
      )}

      {activeTab === 'recebimentos' && (
        <div className="panel-tab-content">
          {/* FASE P1-A — extrato de recebimentos da assinatura da comunidade
              (só leitura; deriva de subscription_payouts). */}
          <RevenuePanel communityId={communityId} communityName={community.name} />
        </div>
      )}
    </section>
  )
}
