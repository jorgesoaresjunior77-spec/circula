import { useBillingPlans } from '../hooks/useBillingPlans'
import {
  CIRCULA_MONTHLY_CENTS,
  CYCLE_LABEL,
  PACK_MONTHLY_CENTS,
  PACK_PRICES_CENTS,
  PRODUCTS,
  PRODUCT_MONTHLY_CENTS,
  PRODUCT_PRICES_CENTS,
  formatBrl,
  savingsPercent,
} from '../lib/plansCatalog'
import type { PlanCycle } from '../lib/plansCatalog'
import { SubscriptionPanel } from './SubscriptionPanel'

// Página de Planos da membro: o plano do Círcula, os conteúdos avulsos e os
// superpacotes. Hoje só a assinatura mensal do Círcula tem cobrança ligada
// (Asaas em Sandbox); o resto aparece como "em breve", sem compra.

const CYCLES: PlanCycle[] = ['monthly', 'semiannual', 'annual']
const API_CYCLE: Record<string, PlanCycle> = {
  MONTHLY: 'monthly',
  SEMIANNUALLY: 'semiannual',
  YEARLY: 'annual',
}

function PriceRow({ prices, monthly }: { prices: Record<PlanCycle, number>; monthly: number }) {
  return (
    <ul className="plans-prices">
      {CYCLES.map((c) => {
        const off = savingsPercent(c, prices[c], monthly)
        return (
          <li key={c}>
            <span>{CYCLE_LABEL[c]}</span>
            <strong>{formatBrl(prices[c])}</strong>
            {off > 0 && <em>{off}% de economia</em>}
          </li>
        )
      })}
    </ul>
  )
}

export function PlansPage({ communityId }: { communityId: string | null }) {
  const { plans } = useBillingPlans('community')
  const circulaPrices: Record<PlanCycle, number> = {
    monthly: CIRCULA_MONTHLY_CENTS,
    semiannual: CIRCULA_MONTHLY_CENTS * 6,
    annual: CIRCULA_MONTHLY_CENTS * 12,
  }
  for (const p of plans) {
    const cycle = API_CYCLE[p.billing_cycle]
    if (cycle) circulaPrices[cycle] = p.price_cents
  }

  return (
    <section className="plans-page">
      <h2>Planos</h2>

      <article className="plans-card">
        <h3>Círcula</h3>
        <p className="plans-text">A comunidade, os círculos, eventos e o acompanhamento do dia a dia.</p>
        <PriceRow prices={circulaPrices} monthly={circulaPrices.monthly} />
        <p className="plans-note">Hoje a assinatura é mensal. Semestral e anual chegam em breve.</p>
        {communityId ? (
          <SubscriptionPanel subject="community" communityId={communityId} />
        ) : (
          <p className="home-muted">Entre em uma comunidade para assinar.</p>
        )}
      </article>

      <h3 className="plans-heading">Conteúdos avulsos</h3>
      {PRODUCTS.map((p) => (
        <article key={p.key} className="plans-card">
          <h3>{p.name}</h3>
          <p className="plans-text">{p.description}</p>
          <PriceRow prices={PRODUCT_PRICES_CENTS} monthly={PRODUCT_MONTHLY_CENTS} />
          <button type="button" className="plans-soon" disabled>
            Em breve
          </button>
        </article>
      ))}

      <h3 className="plans-heading">Superpacotes</h3>
      <article className="plans-card plans-card--pack">
        <h3>Círcula completo</h3>
        <p className="plans-text">O Círcula mais a revista, as receitas e os e-books.</p>
        <PriceRow prices={PACK_PRICES_CENTS} monthly={PACK_MONTHLY_CENTS} />
        <button type="button" className="plans-soon" disabled>
          Em breve
        </button>
      </article>

      <p className="plans-note">
        Valores em reais, cobrados pelo ciclo escolhido. Conteúdos avulsos e pacotes serão liberados
        em breve.
      </p>
    </section>
  )
}
