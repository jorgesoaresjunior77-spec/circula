import { useState } from 'react'
import { useBillingPlans } from '../hooks/useBillingPlans'
import {
  CIRCULA_MONTHLY_CENTS,
  CYCLE_LABEL,
  PREMIUM_MONTHLY_CENTS,
  PREMIUM_PRICES_CENTS,
  PREMIUM_SEPARATE_MONTHLY_CENTS,
  PRODUCTS,
  cycleBreakdown,
  formatBrl,
  pricesOf,
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

/** Ordem dos conteúdos avulsos na página. */
const ORDER = ['magazine', 'ebooks', 'receitas', 'meu_chef', 'minha_lista', 'help_nutri', 'respiracao', 'playlist', 'wellness', 'leitura', 'lista_inteligente', 'exercicios', 'series_filmes'] as const
const API_CYCLE: Record<string, PlanCycle> = {
  MONTHLY: 'monthly',
  SEMIANNUALLY: 'semiannual',
  YEARLY: 'annual',
}

type PlanKey = 'circula' | 'premium' | (typeof PRODUCTS)[number]['key']

/** Quanto custa em cada ciclo, com o valor sem desconto, o desconto aplicado, o total e a economia.
 *  `reference` é o mensal de partida (sem desconto) e `discountNote` explica de onde vem o desconto. */
function PriceRow({
  prices,
  reference,
  referenceLabel = 'Valor mensal',
  discountNote,
}: {
  prices: Record<PlanCycle, number>
  reference: number
  referenceLabel?: string
  discountNote?: string
}) {
  return (
    <div className="plans-prices-wrap">
      <ul className="plans-prices plans-prices--detail">
        {CYCLES.map((c) => {
          const b = cycleBreakdown(c, prices[c], reference)
          const discounted = b.savedCents > 0
          return (
            <li key={c} className={`plans-cycle${c === 'annual' ? ' plans-cycle--best' : ''}`}>
              {c === 'annual' && <span className="plans-best-tag">Melhor escolha agora</span>}
              <div className="plans-cycle-head">
                <span>
                  {CYCLE_LABEL[c]}
                  {b.months > 1 ? ` · ${b.months} meses` : ''}
                </span>
                {discounted && <em>{b.percent}% de desconto</em>}
              </div>
              <div className="plans-cycle-total">
                {discounted && <s>{formatBrl(b.fullCents)}</s>}
                <strong>{formatBrl(b.totalCents)}</strong>
                <small>total a pagar</small>
              </div>
              <p className="plans-cycle-detail">
                {b.months > 1 ? `Equivale a ${formatBrl(b.perMonthCents)} por mês. ` : ''}
                {discounted ? (
                  <>
                    Você economiza <strong>{formatBrl(b.savedCents)}</strong>.
                  </>
                ) : (
                  'Sem desconto neste ciclo.'
                )}
              </p>
            </li>
          )
        })}
      </ul>
      <p className="plans-note">
        {referenceLabel}: {formatBrl(reference)}. O valor riscado é o total sem desconto no ciclo.
        {discountNote ? ` ${discountNote}` : ''}
      </p>
    </div>
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
      <h2>Planos e assinaturas</h2>

      {!viewOnly && communityId && profileId && <SubscriptionLevelCard communityId={communityId} profileId={profileId} />}

      <button type="button" className="plans-wide plans-wide--circula" onClick={() => setOpen('circula')} aria-label={`Círcula, ${formatBrl(circulaPrices.monthly)} por mês`}>
        <span className="plans-wide-icon">
          <PLAN_ICONS.circula />
        </span>
        <span className="plans-wide-body">
          <strong>Círcula</strong>
          <span>A comunidade, os círculos, os eventos e o acompanhamento do dia a dia.</span>
        </span>
        <span className="plans-wide-price">
          {formatBrl(circulaPrices.monthly)}
          <small>por mês</small>
        </span>
      </button>

      <h3 className="plans-heading">Conteúdos avulsos</h3>
      <p className="plans-note">Escolha só o que você quer. Pagando por 6 ou 12 meses, o valor total é menor, e o plano anual é a melhor escolha.</p>
      <div className="plans-grid">
        {ORDER.map((k) => PRODUCTS.find((p) => p.key === k)).filter((p): p is (typeof PRODUCTS)[number] => !!p).map((p) => (
          <PlanTile key={p.key} planKey={p.key} name={p.name} monthly={p.monthlyCents} onOpen={() => setOpen(p.key)} />
        ))}
      </div>

      <h3 className="plans-heading">Círcula Premium</h3>
      <button type="button" className="plans-wide plans-wide--premium" onClick={() => setOpen('premium')} aria-label={`Círcula Premium, ${formatBrl(PREMIUM_MONTHLY_CENTS)} por mês`}>
        <span className="plans-wide-icon">
          <PLAN_ICONS.premium />
        </span>
        <span className="plans-wide-body">
          <strong>Círcula Premium</strong>
          <span>Tudo do Círcula e de todos os conteúdos, juntos e com desconto.</span>
        </span>
        <span className="plans-wide-price">
          {formatBrl(PREMIUM_MONTHLY_CENTS)}
          <small>por mês · {premiumOff}% off</small>
        </span>
      </button>

      <article className="plans-included">
        <h4>O que você leva no Premium</h4>
        <ul>
          <li>
            <strong>Círcula</strong> <span>comunidade, círculos, eventos e acompanhamento do dia a dia</span> <em>{formatBrl(CIRCULA_MONTHLY_CENTS)}</em>
          </li>
          {ORDER.map((k) => PRODUCTS.find((p) => p.key === k)).filter((p): p is (typeof PRODUCTS)[number] => !!p).map((p) => (
            <li key={p.key}>
              <strong>{p.name}</strong> <span>{p.description}</span> <em>{formatBrl(p.monthlyCents)}</em>
            </li>
          ))}
        </ul>
        <p className="plans-included-total">
          Tudo separado: <s>{formatBrl(PREMIUM_SEPARATE_MONTHLY_CENTS)}</s> por mês · <strong>Premium: {formatBrl(PREMIUM_MONTHLY_CENTS)}</strong> por mês
        </p>
        <p className="plans-included-best">
          Melhor escolha agora: <strong>Premium anual por {formatBrl(PREMIUM_PRICES_CENTS.annual)}</strong>, pagando uma vez só. Separado, o mesmo ano custaria {formatBrl(PREMIUM_SEPARATE_MONTHLY_CENTS * 12)}: você economiza {formatBrl(PREMIUM_SEPARATE_MONTHLY_CENTS * 12 - PREMIUM_PRICES_CENTS.annual)}.
        </p>
      </article>

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
                <PriceRow prices={circulaPrices} reference={circulaPrices.monthly} />
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
                  playlists, o wellness, as dicas de leitura e a Minha Lista, tudo junto e com desconto. Separado, o mensal sairia{' '}
                  {formatBrl(PREMIUM_SEPARATE_MONTHLY_CENTS)}.
                </p>
                <PriceRow
                  prices={PREMIUM_PRICES_CENTS}
                  reference={PREMIUM_SEPARATE_MONTHLY_CENTS}
                  referenceLabel="Tudo separado, por mês"
                  discountNote={`Descontos: o pacote completo custa ${formatBrl(PREMIUM_MONTHLY_CENTS)} por mês em vez de ${formatBrl(PREMIUM_SEPARATE_MONTHLY_CENTS)} (${premiumOff}% a menos), e pagar por 6 ou 12 meses de uma vez dá mais 20% ou 35% sobre o mensal do Premium.`}
                />
                {viewOnly ? (
                  <p className="home-muted">Esta é a página que a membro vê. Você não precisa assinar.</p>
                ) : (
                  <AddonCheckout
                    planKey="premium"
                    communityId={communityId}
                    prices={PREMIUM_PRICES_CENTS}
                    owned={packages.has('premium')}
                    profileId={profileId}
                  />
                )}
              </>
            )}

            {product && (
              <>
                <h3>{product.name}</h3>
                <p className="plans-text">{product.description}</p>
                <PriceRow
                  prices={pricesOf(product)}
                  reference={product.monthlyCents}
                  discountNote="Pagando 6 ou 12 meses de uma vez, o desconto vem sobre o mensal."
                />
                {BUYABLE.includes(product.key) && !viewOnly ? (
                  <AddonCheckout
                    planKey={product.key}
                    communityId={communityId}
                    prices={pricesOf(product)}
                    owned={packages.has(product.key as never) || packages.has('premium')}
                    profileId={profileId}
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
