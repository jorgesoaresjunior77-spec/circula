/**
 * Fase 12.3 — exibido no lugar do Feed/managers da comunidade quando a
 * própria linha de `community_members` da usuária está `status='pending'`
 * (solicitação de entrada ainda não analisada pela profissional). Não
 * dispara nenhuma chamada nova: o status já vem junto com a comunidade
 * (`community.community_members`), então este componente é só exibição.
 */
export function CommunityMembershipPendingCard() {
  return (
    <section className="community-card">
      <h3>Solicitação enviada</h3>
      <p className="auth-subtitle">Aguardando aprovação da profissional</p>
      <p>
        Sua solicitação para entrar nesta comunidade foi enviada e está aguardando a
        aprovação da profissional responsável. Assim que ela aprovar, você terá acesso
        normal ao conteúdo.
      </p>
    </section>
  )
}
