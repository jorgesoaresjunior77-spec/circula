import { useState } from 'react'
import { useBillingPlans } from '../hooks/useBillingPlans'
import {
  CIRCULA_MONTHLY_CENTS,
  CYCLE_LABEL,
  PREMIUM_MONTHLY_CENTS,
  PREMIUM_PRICES_CENTS,
  PREMIUM_SEPARATE_MONTHLY_CENTS,
  PRODUCTS,
  formatBrl,
  pricesOf,
  savingsPercent,
} from '../lib/plansCatalog'
import type { PlanCycle } from '../lib/plansCatalog'
import { AddonCheckout } from './AddonCheckout'
import { PLAN_ICONS } from './PlanIcons'
import { useMyPackages } from '../hooks/usePackageAccess'
import { SubscriptionPanel } from './SubscriptionPanel'
import { SubscriptionLevelCard } from './SubscriptionLevelCard'

// Página de Planos da membro: o plano do Círcula, cada conteúdo avulso e o
// Círcula Premium (tudo junto, com desconto), todos em cartões do mesmo
// tamanho, 3 por fila. Tocar no cartão abre os preços por ciclo e a compra
// (Asaas em Sandbox).

// Todos os planos têm cobrança no Asaas (Sandbox por enquanto).
const BUYABLE: PlanKey[] = [...PRODUCTS.map((p) => p.key), 'premium']

const CYCLES: PlanCycle[] = ['monthly', 'semiannual', 'annual']
const API_CYCLE: Record<string, PlanCycle> = {
  MONTHLY: 'monthly',
  SEMIANNUALLY: 'semiannual',
  YEARLY: 'annual',
}

type PlanKey = 'circula' | 'premium' | (typeof PRODUCTS)[number]['key']

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

function PlanTile({
  planKey,
  name,
  monthly,
  badge,
  onOpen,
}: {
  planKey: PlanKey
  name: string
  monthly: number
  badge?: string
  onOpen: () => void
}) {
  const Icon = PLAN_ICONS[planKey]
  return (
    <button
      type="button"
      className={`plan-tile${planKey === 'premium' ? ' plan-tile--premium' : ''}`}
      onClick={onOpen}
      aria-label={`${name}, ${formatBrl(monthly)} por mês`}
    >
      <span className="plan-tile-icon">
        <Icon />
      </span>
      <span className="plan-tile-name">{name}</span>
      <span className="plan-tile-price">{formatBrl(monthly)}</span>
      <span className="plan-tile-unit">por mês</span>
      {badge && <span className="plan-tile-badge">{badge}</span>}
    </button>
  )
}

export function PlansPage({
  communityId,
  viewOnly = false,
  profileId = null,
}: {
  communityId: string | null
  /** A profissional vê a página como a membro vê, mas não assina (ela é a
   *  responsável pela comunidade e hoje é isenta de pagamento). */
  viewOnly?: boolean
  /** Quem está vendo (para saber quais pacotes já tem). */
  profileId?: string | null
}) {
  const { packages } = useMyPackages(communityId, profileId, !viewOnly)
  const { plans } = useBillingPlans('community')
  const [open, setOpen] = useState<PlanKey | null>(null)

  const circulaPrices: Record<PlanCycle, number> = {
    monthly: CIRCULA_MONTHLY_CENTS,
    semiannual: CIRCULA_MONTHLY_CENTS * 6,
    annual: CIRCULA_MONTHLY_CENTS * 12,
  }
  for (const p of plans) {
    const cycle = API_CYCLE[p.billing_cycle]
    if (cycle) circulaPrices[cycle] = p.price_cents
  }

  const product = PRODUCTS.find((p) => p.key === open) ?? null
  const premiumOff = Math.round(
    (1 - PREMIUM_MONTHLY_CENTS / PREMIUM_SEPARATE_MONTHLY_CENTS) * 100,
  )

  return (
    <section className="plans-page">
      <h2>Planos</h2>

      {!viewOnly && communityId && profileId && <SubscriptionLevelCard communityId={communityId} profileId={profileId} />}

      <div className="plans-grid">
        <PlanTile
          planKey="circula"
          name="Círcula"
          monthly={circulaPrices.monthly}
          onOpen={() => setOpen('circula')}
        />
      </div>

      <h3 className="plans-heading">Conteúdos avulsos</h3>
      <div className="plans-grid">
        {PRODUCTS.map((p) => (
          <PlanTile
            key={p.key}
            planKey={p.key}
            name={p.name}
            monthly={p.monthlyCents}
            onOpen={() => setOpen(p.key)}
          />
        ))}
      </div>

      <h3 className="plans-heading">Superpacotes</h3>
      <div className="plans-grid">
        <PlanTile
          planKey="premium"
          name="Círcula Premium"
          monthly={PREMIUM_MONTHLY_CENTS}
          badge={`${premiumOff}% off`}
          onOpen={() => setOpen('premium')}
        />
      </div>

      <p className="plans-note">
        Valores em reais, cobrados pelo ciclo escolhido. O acesso libera quando o pagamento é confirmado.
      </p>

      {open && (
        <div className="plans-sheet-backdrop" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <article className="plans-card plans-sheet" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="plans-sheet-close" onClick={() => setOpen(null)} aria-label="Fechar">
              ×
            </button>

            {open === 'circula' && (
              <>
                <h3>Círcula</h3>
                <p className="plans-text">A comunidade, os círculos, eventos e o acompanhamento do dia a dia.</p>
                <PriceRow prices={circulaPrices} monthly={circulaPrices.monthly} />
                <p className="plans-note">Hoje a assinatura é mensal. Semestral e anual chegam em breve.</p>
                {viewOnly ? (
                  <p className="home-muted">
                    Esta é a página que a membro vê. Como responsável pela comunidade, você não precisa
                    assinar.
                  </p>
                ) : communityId ? (
                  <SubscriptionPanel subject="community" communityId={communityId} />
                ) : (
                  <p className="home-muted">Entre em uma comunidade para assinar.</p>
                )}
              </>
            )}

            {open === 'premium' && (
              <>
                <h3>Círcula Premium</h3>
                <p className="plans-text">
                  O Círcula mais a revista, as receitas, os e-books, o Help Nutri, a respiração, as
                  playlists e o wellness, tudo junto e com desconto. Separado, o mensal sairia{' '}
                  {formatBrl(PREMIUM_SEPARATE_MONTHLY_CENTS)}.
                </p>
                <PriceRow prices={PREMIUM_PRICES_CENTS} monthly={PREMIUM_MONTHLY_CENTS} />
                {viewOnly ? (
                  <p className="home-muted">Esta é a página que a membro vê. Você não precisa assinar.</p>
                ) : (
                  <AddonCheckout
                    planKey="premium"
                    communityId={communityId}
                    prices={PREMIUM_PRICES_CENTS}
                    owned={packages.has('premium')}
                  />
                )}
              </>
            )}

            {product && (
              <>
                <h3>{product.name}</h3>
                <p className="plans-text">{product.description}</p>
                <PriceRow prices={pricesOf(product)} monthly={product.monthlyCents} />
                {BUYABLE.includes(product.key) && !viewOnly ? (
                  <AddonCheckout
                    planKey={product.key}
                    communityId={communityId}
                    prices={pricesOf(product)}
                    owned={packages.has(product.key as never) || packages.has('premium')}
                  />
                ) : BUYABLE.includes(product.key) ? (
                  <p className="home-muted">Esta é a página que a membro vê. Você não precisa assinar.</p>
                ) : null}
              </>
            )}
          </article>
        </div>
      )}
    </section>
  )
}
