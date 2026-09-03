import { usePlatformProfessionals } from '../hooks/usePlatformProfessionals'
import type { PlatformProfessional } from '../types/platform'
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

function ProfessionalCard({ professional }: { professional: PlatformProfessional }) {
  const name = professional.full_name ?? 'Profissional'
  const status = professional.platform_subscription_status
  return (
    <article className="master-pro-card">
      <div className="master-pro-avatar" aria-hidden="true">
        {professional.avatar_url ? (
          <img src={professional.avatar_url} alt="" />
        ) : (
          <span>{name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="master-pro-body">
        <div className="master-community-head">
          <p className="master-community-name">{name}</p>
          <span
            className={`master-status-pill${professional.platform_active ? '' : ' master-status-pill--off'}`}
          >
            {status ? (STATUS_LABEL[status] ?? status) : professional.platform_active ? 'Ativa' : 'Inativa'}
          </span>
        </div>
        <p className="master-community-activity">{activityLabel(professional.last_activity_at)}</p>
        <div className="master-figures">
          <span className="master-figure">
            <strong>{professional.communities_count}</strong> comunidade(s)
          </span>
          <span className="master-figure">
            <strong>{professional.members_total}</strong> membros
          </span>
          <span className="master-figure">
            <strong>{professional.posts_30d}</strong> posts (30d)
          </span>
        </div>
      </div>
    </article>
  )
}

/**
 * Aba "Profissionais" do Painel Master — visão agregada por profissional
 * (RPC platform_professionals). Quem administra o quê, status de
 * assinatura de plataforma e atividade agregada. Sem dados individuais
 * de membros.
 */
export function MasterProfessionalsPanel() {
  const { professionals, loading, error } = usePlatformProfessionals()

  if (loading) return <p className="home-muted">Carregando profissionais...</p>
  if (error) return <p className="auth-error">Não foi possível carregar as profissionais agora.</p>
  if (professionals.length === 0) {
    return <EmptyState message="Nenhuma profissional na plataforma ainda." />
  }

  return (
    <div className="master-list">
      {professionals.map((professional) => (
        <ProfessionalCard key={professional.id} professional={professional} />
      ))}
    </div>
  )
}
