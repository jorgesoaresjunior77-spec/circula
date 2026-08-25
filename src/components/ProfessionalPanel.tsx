import { useState } from 'react'
import { QuestionBankManager } from './QuestionBankManager'
import { ChallengeManager } from './ChallengeManager'
import { CircleManager } from './CircleManager'
import { CheckinManager } from './CheckinManager'
import { EngagementCommandManager } from './EngagementCommandManager'
import { CommunityMetricsPanel } from './CommunityMetricsPanel'

type PanelTab = 'conteudo' | 'comunidade' | 'assinaturas'

interface ProfessionalPanelProps {
  communityId: string
  profileId: string
  onFeedRefresh: () => void
}

export function ProfessionalPanel({ communityId, profileId, onFeedRefresh }: ProfessionalPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('conteudo')

  return (
    <section className="community-card professional-panel">
      <h3>Painel da comunidade</h3>

      <div className="panel-tabs">
        <button
          type="button"
          className={`panel-tab${activeTab === 'conteudo' ? ' panel-tab--active' : ''}`}
          onClick={() => setActiveTab('conteudo')}
        >
          Conteúdo
        </button>
        <button
          type="button"
          className={`panel-tab${activeTab === 'comunidade' ? ' panel-tab--active' : ''}`}
          onClick={() => setActiveTab('comunidade')}
        >
          Comunidade
        </button>
        <button
          type="button"
          className={`panel-tab${activeTab === 'assinaturas' ? ' panel-tab--active' : ''}`}
          onClick={() => setActiveTab('assinaturas')}
        >
          Assinaturas
        </button>
      </div>

      {activeTab === 'conteudo' && (
        <div className="panel-tab-content">
          <QuestionBankManager
            communityId={communityId}
            authorId={profileId}
            canManage
            onPublished={onFeedRefresh}
          />
          <ChallengeManager
            communityId={communityId}
            profileId={profileId}
            canManage
            canParticipate
          />
          <CircleManager
            communityId={communityId}
            profileId={profileId}
            canManage
            canParticipate
          />
          <CheckinManager
            communityId={communityId}
            profileId={profileId}
            canManage
            canParticipate
            onShared={onFeedRefresh}
          />
          <EngagementCommandManager
            communityId={communityId}
            authorId={profileId}
            canManage
            onPublished={onFeedRefresh}
          />
        </div>
      )}

      {activeTab === 'comunidade' && (
        <div className="panel-tab-content">
          <CommunityMetricsPanel communityId={communityId} />
        </div>
      )}

      {activeTab === 'assinaturas' && (
        <div className="panel-tab-content">
          <p className="panel-placeholder">Assinaturas em breve.</p>
        </div>
      )}
    </section>
  )
}
