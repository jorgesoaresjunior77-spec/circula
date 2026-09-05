import { usePlatformCommunities } from '../hooks/usePlatformCommunities'
import type { PlatformCommunity } from '../types/platform'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { EmptyState } from './EmptyState'

function activityLabel(iso: string | null): string {
  if (!iso) return 'sem atividade registrada'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'ativa hoje'
  if (days === 1) return 'ativa ontem'
  if (days < 30) return `ativa há ${days} dias`
  return `sem atividade há ${Math.floor(days / 30)} mês(es)`
}

const STATUS_LABEL: Record<string, string> = {
  trial: 'Em teste',
  active: 'Ativa',
  past_due: 'Pagamento pendente',
  canceled: 'Cancelada',
  blocked: 'Bloqueada',
}

function CommunityCard({ community }: { community: PlatformCommunity }) {
  const name = community.name || 'Comunidade'
  // Nota: para comunidades com mídia nova (path no bucket privado
  // `community-media`), a signed URL aqui tende a falhar — o Master
  // não tem `owns_community`/`is_community_member` sobre comunidades
  // alheias. Consistente com a filosofia já estabelecida nas fases
  // 12.4/12.4b/12.4c ("Master não tem acesso individual"): o
  // fallback (inicial do nome) assume normalmente, sem ser um bug.
  const { url: coverUrl } = useSignedImageUrl(community.cover_image_url)
  return (
    <article className="master-community-card">
      <div className="master-community-cover" aria-hidden="true">
        {coverUrl ? (
          <img src={coverUrl} alt="" />
        ) : (
          <span>{name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="master-community-body">
        <div className="master-community-head">
          <p className="master-community-name">{name}</p>
          {community.subscription_status && (
            <span className="master-status-pill">
              {STATUS_LABEL[community.subscription_status] ?? community.subscription_status}
            </span>
          )}
        </div>
        <p className="master-community-owner">
          por {community.owner_name ?? 'profissional'}
        </p>
        <p className="master-community-activity">{activityLabel(community.last_activity_at)}</p>
        <div className="master-figures">
          <span className="master-figure">
            <strong>{community.members_active}</strong> membros
          </span>
          <span className="master-figure">
            <strong>{community.members_new_30d}</strong> novos (30d)
          </span>
          <span className="master-figure">
            <strong>{community.posts_30d}</strong> posts (30d)
          </span>
          <span className="master-figure">
            <strong>{community.challenge_completions_30d}</strong> conclusões (30d)
          </span>
          <span className="master-figure">
            <strong>{community.points_30d}</strong> pontos (30d)
          </span>
          <span className="master-figure">
            <strong>{community.help_pending}</strong> ajuda pendente
          </span>
        </div>
      </div>
    </article>
  )
}

/**
 * Aba "Comunidades" do Painel Master — visão agregada por comunidade
 * (RPC platform_communities). Mostra identidade da comunidade, a
 * profissional responsável e números agregados. Sem conteúdo, sem lista
 * de membros individuais.
 */
export function MasterCommunitiesPanel() {
  const { communities, loading, error } = usePlatformCommunities()

  if (loading) return <p className="home-muted">Carregando comunidades...</p>
  if (error) return <p className="auth-error">Não foi possível carregar as comunidades agora.</p>
  if (communities.length === 0) {
    return <EmptyState message="Nenhuma comunidade na plataforma ainda." />
  }

  return (
    <div className="master-list">
      {communities.map((community) => (
        <CommunityCard key={community.id} community={community} />
      ))}
    </div>
  )
}
