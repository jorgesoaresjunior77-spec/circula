import { useState } from 'react'
import { QuestionBankManager } from './QuestionBankManager'
import { CircleManager } from './CircleManager'
import { EventManager } from './EventManager'
import { GardenChallengeManager } from './GardenChallengeManager'
import { ContentManager } from './ContentManager'
import { MoodMessageManager } from './MoodMessageManager'
import { CheckinManager } from './CheckinManager'
import { EngagementCommandManager } from './EngagementCommandManager'
import { CommunityMetricsPanel } from './CommunityMetricsPanel'
import { ProductManager } from './ProductManager'
import { SubscriptionPanel } from './SubscriptionPanel'
import { AsaasAccountConnect } from './AsaasAccountConnect'
import { CommunityPriceSettings } from './CommunityPriceSettings'
import { RevenuePanel } from './RevenuePanel'
import { ProfessionalDashboard } from './ProfessionalDashboard'
import { CommunityMembersPanel } from './CommunityMembersPanel'
import { PostsModerationPanel } from './PostsModerationPanel'
import { CommunityCardImagesManager } from './CommunityCardImagesManager'
import { CircleImagesManager } from './CircleImagesManager'
import { InstagramSlotsManager } from './InstagramSlotsManager'
import type {
  AddMemberResult,
  CommunityUpdateInput,
  CommunityWithMembers,
  InviteMemberResult,
} from '../types/community'

// Painel profissional (item 5/6) — "Participantes" deixou de ser aba
// própria: a gestão de participantes agora mora dentro de "Visão geral"
// (ver render abaixo, seção com id="panel-participants-section").
// "Recebimentos" também deixou de ser aba própria: virou uma sub-aba
// interna de "Assinaturas" (ver `assinaturasSubTab`). As duas chaves
// seguem existindo no tipo só para o `onOpenTab` dos KPIs de
// ProfessionalDashboard continuar funcionando sem mudar lá.
type PanelTab =
  | 'visao'
  | 'participantes'
  | 'publicacoes'
  | 'eventos'
  | 'jardim'
  | 'circulos'
  | 'conteudo'
  | 'imagens'
  | 'metricas'
  | 'produtos'
  | 'assinaturas'
  | 'recebimentos'

const TABS: { key: PanelTab; label: string }[] = [
  { key: 'visao', label: 'Visão geral' },
  { key: 'publicacoes', label: 'Publicações' },
  { key: 'eventos', label: 'Eventos' },
  { key: 'jardim', label: 'Meu Jardim' },
  { key: 'circulos', label: 'Círculos' },
  { key: 'conteudo', label: 'Conteúdo' },
  { key: 'imagens', label: 'Imagens da comunidade' },
  { key: 'metricas', label: 'Métricas' },
  { key: 'produtos', label: 'Produtos' },
  { key: 'assinaturas', label: 'Assinaturas' },
]

type AssinaturasSubTab = 'assinaturas' | 'recebimentos'

const ASSINATURAS_SUBTABS: { key: AssinaturasSubTab; label: string }[] = [
  { key: 'assinaturas', label: 'Assinaturas' },
  { key: 'recebimentos', label: 'Recebimentos' },
]

interface ProfessionalPanelProps {
  communityId: string
  /** Comunidade já carregada (useCommunity) — usada pela aba Visão geral. */
  community: CommunityWithMembers
  profileId: string
  onFeedRefresh: () => void
  /** RPCs approve/reject_membership_request via useCommunity (16.2.3-C). */
  onApproveMembership: (communityId: string, profileId: string) => Promise<{ error: string | null }>
  onRejectMembership: (communityId: string, profileId: string) => Promise<{ error: string | null }>
  /** 16.2.3-G — salva informações básicas da comunidade (useCommunity.updateCommunity). */
  onUpdateCommunity: (
    communityId: string,
    patch: CommunityUpdateInput,
  ) => Promise<{ error: string | null }>
  /** Reorganização do menu — Convite/Adição direta de membro (antes no
   *  destino "Comunidades", removido) moram na aba Participantes.
   *  Mesmos handlers de useCommunity, só repassados por aqui agora. */
  onInviteMember: (email: string, fullName: string) => Promise<InviteMemberResult>
  onAddMember: (email: string) => Promise<AddMemberResult>
}

export function ProfessionalPanel({
  communityId,
  community,
  profileId,
  onFeedRefresh,
  onApproveMembership,
  onRejectMembership,
  onUpdateCommunity,
  onInviteMember,
  onAddMember,
}: ProfessionalPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('visao')
  const [assinaturasSubTab, setAssinaturasSubTab] = useState<AssinaturasSubTab>('assinaturas')

  // Item 5 — "Participantes" não é mais uma aba própria: os KPIs/atalhos
  // de ProfessionalDashboard (onOpenTab('participantes')) continuam
  // chamando com a mesma chave de sempre, mas aqui ela vira "ficar em
  // Visão geral e rolar até a seção de participantes" em vez de trocar
  // de aba. "Recebimentos" idem — vira sub-aba dentro de "Assinaturas".
  function handleOpenTab(tab: string) {
    if (tab === 'participantes') {
      setActiveTab('visao')
      requestAnimationFrame(() => {
        document
          .getElementById('panel-participants-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return
    }
    if (tab === 'recebimentos') {
      setActiveTab('assinaturas')
      setAssinaturasSubTab('recebimentos')
      return
    }
    setActiveTab(tab as PanelTab)
  }

  return (
    <section className="community-card community-card--quiet professional-panel">
      <p className="section-label">Painel</p>
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
            onOpenTab={handleOpenTab}
            onUpdateCommunity={onUpdateCommunity}
          />

          {/* Item 5 — Participantes deixou de ser aba própria: os dados
              gerais (acima) vêm primeiro, a gestão de participantes fica
              numa seção clara, separada, logo abaixo. Mesmo componente,
              mesmas props/handlers de sempre — só o local de montagem
              mudou. `id` é o alvo do scroll de `handleOpenTab`. */}
          <section
            id="panel-participants-section"
            className="panel-overview-section-divider"
            aria-label="Participantes"
          >
            {/* 16.2.3-C/D — roster por status (Todas/Ativas/Pendentes/Bloqueadas).
                "Ativas" mantém o ParticipantsPanel (RPC community_participants_overview);
                "Pendentes"/"Bloqueadas" leem community.community_members já carregado.
                Aprovar/rejeitar segue nas RPCs approve/reject_membership_request. */}
            <CommunityMembersPanel
              communityId={communityId}
              community={community}
              onApprove={onApproveMembership}
              onReject={onRejectMembership}
              onInvite={onInviteMember}
              onAdd={onAddMember}
            />
          </section>
        </div>
      )}

      {activeTab === 'publicacoes' && (
        <div className="panel-tab-content">
          <PostsModerationPanel communityId={communityId} />
        </div>
      )}

      {activeTab === 'eventos' && (
        <div className="panel-tab-content">
          <EventManager communityId={communityId} profileId={profileId} canManage />
        </div>
      )}

      {activeTab === 'jardim' && (
        <div className="panel-tab-content">
          <GardenChallengeManager
            communityId={communityId}
            profileId={profileId}
            onPublished={onFeedRefresh}
          />
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

      {activeTab === 'imagens' && (
        <div className="panel-tab-content panel-images-sections">
          {/* Ajustes de navegação (item 5) — três seções bem separadas:
              A. Hoje no Círcula, B. Círculos, C. Publicações do
              Instagram. Cada uma reaproveita sua própria estrutura de
              dados já existente; nenhuma mistura de campos entre elas. */}
          <CommunityCardImagesManager communityId={communityId} profileId={profileId} />
          <CircleImagesManager communityId={communityId} profileId={profileId} />
          <InstagramSlotsManager communityId={communityId} profileId={profileId} />
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
          {/* Item 6 — Assinaturas e Recebimentos viraram uma única opção
              no Painel, com sub-abas internas. Mesmos componentes,
              mesmos dados/cálculos/regras financeiras de sempre — só a
              navegação (uma aba a menos) mudou. */}
          <div className="panel-subtabs">
            {ASSINATURAS_SUBTABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`panel-subtab${assinaturasSubTab === tab.key ? ' panel-subtab--active' : ''}`}
                onClick={() => setAssinaturasSubTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {assinaturasSubTab === 'assinaturas' && (
            <>
              <SubscriptionPanel subject="platform" />
              {/* FASE 16.1 — onboarding financeiro: conectar a conta Asaas
                  recebedora do split 90/10. Só a anfitriã chega ao painel. */}
              <AsaasAccountConnect enabled />
              {/* FASE 16.1-P — preço da assinatura da própria comunidade
                  (piso R$ 14,90, validado no servidor). */}
              <CommunityPriceSettings communityId={communityId} />
            </>
          )}

          {assinaturasSubTab === 'recebimentos' && (
            // FASE P1-A/P1-D — extrato de recebimentos da comunidade (só
            // leitura): consolida assinaturas (subscription_payouts) e
            // vendas de produto da Loja (product_payouts).
            <RevenuePanel communityId={communityId} communityName={community.name} />
          )}
        </div>
      )}
    </section>
  )
}
