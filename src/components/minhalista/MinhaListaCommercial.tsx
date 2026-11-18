import { PREMIUM_MONTHLY_CENTS, PRODUCTS, formatBrl } from '../../lib/plansCatalog'
import { ListPlanIcon } from '../PlanIcons'

// Página comercial da Minha Lista, para quem ainda não tem o serviço. Os
// preços vêm do catálogo oficial (o mesmo da página de Planos e do checkout).

const PRICE = PRODUCTS.find((p) => p.key === 'minha_lista')?.monthlyCents ?? 490

const BENEFITS = [
  'Crie listas de compras por categoria, com quantidades, unidades e preços.',
  'Gere a lista a partir das receitas da Círcula: os ingredientes repetidos se somam sozinhos.',
  'Modo Supermercado pensado para o celular: marque o que comprou e acompanhe o total.',
  'Compare o que você estimou com o que realmente gastou.',
  'Histórico das compras, duplicar listas e compartilhar com quem divide a casa.',
]

export function MinhaListaCommercial({ onOpenPlans }: { onOpenPlans: () => void }) {
  return (
    <section className="ml-commercial" aria-label="Minha Lista">
      <span className="ml-commercial-icon" aria-hidden="true">
        <ListPlanIcon size={44} />
      </span>
      <h2>Minha Lista</h2>
      <p className="ml-commercial-lead">Organize suas compras, planeje sua alimentação e tenha tudo o que precisa sempre à mão.</p>
      <ul className="ml-benefits">
        {BENEFITS.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <div className="ml-price">
        <strong>{formatBrl(PRICE)}</strong>
        <span>por mês</span>
      </div>
      <p className="home-muted">
        Já está incluída no <strong>Círcula Premium</strong> ({formatBrl(PREMIUM_MONTHLY_CENTS)} por mês), junto com todos os
        conteúdos. Quem é Premium não paga a Minha Lista de novo.
      </p>
      <button type="button" className="water-primary" onClick={onOpenPlans}>
        Ver planos e assinar
      </button>
    </section>
  )
}
