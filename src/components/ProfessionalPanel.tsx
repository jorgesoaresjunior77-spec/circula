import { useState } from 'react'
import { QuestionBankManager } from './QuestionBankManager'
import { ChallengeManager } from './ChallengeManager'
import { CircleManager } from './CircleManager'
import { EventManager } from './EventManager'
import { RecipeManager } from './RecipeManager'
import { ContentManager } from './ContentManager'
import { MoodMessageManager } from './MoodMessageManager'
import { CheckinManager } from './CheckinManager'
import { EngagementCommandManager } from './EngagementCommandManager'
import { CommunityMetricsPanel } from './CommunityMetricsPanel'
import { HelpQueue } from './HelpQueue'
import { PointsPanel } from './PointsPanel'
import { ProductManager } from './ProductManager'
import { SubscriptionPanel } from './SubscriptionPanel'
import { ProfessionalDashboard } from './ProfessionalDashboard'
import { ParticipantsPanel } from './ParticipantsPanel'
import { PostsModerationPanel } from './PostsModerationPanel'

type PanelTab =
  | 'visao'
  | 'participantes'
  | 'publicacoes'
  | 'desafios'
  | 'receitas'
  | 'eventos'
  | 'circulos'
  | 'conteudo'
  | 'ajuda'
  | 'pontos'
  | 'metricas'
  | 'produtos'
  | 'assinaturas'

const TABS: { key: PanelTab; label: string }[] = [
  { key: 'visao', label: 'Visão geral' },
  { key: 'participantes', label: 'Participantes' },
  { key: 'publicacoes', label: 'Publicações' },
  { key: 'desafios', label: 'Desafios' },
  { key: 'receitas', label: 'Receitas' },
  { key: 'eventos', label: 'Eventos' },
  { key: 'circulos', label: 'Círculos' },
  { key: 'conteudo', label: 'Conteúdo' },
  { key: 'ajuda', label: 'Pedidos de ajuda' },
  { key: 'pontos', label: 'Pontos' },
  { key: 'metricas', label: 'Métricas' },
  { key: 'produtos', label: 'Produtos' },
  { key: 'assinaturas', label: 'Assinaturas' },
]

interface ProfessionalPanelProps {
  communityId: string
  profileId: string
  onFeedRefresh: () => void
  onOpenConversation: (conversationId: string) => void
}

export function ProfessionalPanel({
  communityId,
  profileId,
  onFeedRefresh,
  onOpenConversation,
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
            communityId={communityId}
            onOpenTab={(tab) => setActiveTab(tab as PanelTab)}
          />
        </div>
      )}

      {activeTab === 'participantes' && (
        <div className="panel-tab-content">
          <ParticipantsPanel communityId={communityId} />
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

      {activeTab === 'receitas' && (
        <div className="panel-tab-content">
          <RecipeManager communityId={communityId} profileId={profileId} canManage />
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
          <ContentManager communityId={communityId} profileId={profileId} canManage excludeRecipes />
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

      {activeTab === 'assinaturas' && <SubscriptionPanel subject="platform" />}
    </section>
  )
}
