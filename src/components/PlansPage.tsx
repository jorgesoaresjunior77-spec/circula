import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBillingPlans } from '../hooks/useBillingPlans'
import {
  CIRCULA_MONTHLY_CENTS,
  CYCLE_LABEL,
  PREMIUM_MONTHLY_CENTS,
  PREMIUM_PRICES_CENTS,
  PREMIUM_SEPARATE_MONTHLY_CENTS,
  PRODUCTS,
  REFERRAL_DISCOUNT_PERCENT,
  applyReferralDiscount,
  cycleBreakdown,
  formatBrl,
  pricesOf,
} from '../lib/plansCatalog'
import type { PlanCycle } from '../lib/plansCatalog'
import { AddonCheckout } from './AddonCheckout'
import { useReferralDiscount } from '../hooks/useReferralDiscount'
import { PLAN_ICONS } from './PlanIcons'
import { useMyPackages } from '../hooks/usePackageAccess'
import { SubscriptionPanel } from './SubscriptionPanel'
import { SubscriptionLevelCard } from './SubscriptionLevelCard'
import { TrialNotice } from './TrialNotice'
import { CartCheckout } from './CartCheckout'
import { RoboCelebracao, RoboConsultor, jaCelebrou, marcarCelebrou } from './RoboPlanos'
import { useConfirmacaoAssinatura } from '../hooks/useConfirmacaoAssinatura'
import type { Confirmacao } from '../hooks/useConfirmacaoAssinatura'

// Página de Planos da membro: o plano do Círcula, cada conteúdo avulso e o
// Círcula Premium (tudo junto, com desconto), todos em cartões do mesmo
// tamanho, 3 por fila. Tocar no cartão abre os preços por ciclo e a compra
// (Asaas em Sandbox).

// Todos os planos têm cobrança no Asaas (Sandbox por enquanto).
const BUYABLE: PlanKey[] = [...PRODUCTS.map((p) => p.key), 'premium']

const CYCLES: PlanCycle[] = ['monthly', 'semiannual', 'annual']

/** Ordem dos conteúdos avulsos na página. */
const ORDER = ['magazine', 'ebooks', 'receitas', 'meu_chef', 'minha_lista', 'help_nutri', 'respiracao', 'playlist', 'wellness', 'leitura', 'lista_inteligente', 'exercicios', 'series_filmes', 'viagens'] as const
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

/** Convite ao Premium: sempre que a membro tem só parte dos conteúdos (ou nenhum), mostra quanto
 *  ela leva a mais no Premium, com o destaque para os planos de 6 meses e de 1 ano. */
function PremiumPitch({ ownedKeys, onOpenPremium }: { ownedKeys: string[]; onOpenPremium?: () => void }) {
  const owned = PRODUCTS.filter((p) => ownedKeys.includes(p.key))
  const ownedMonthly = owned.reduce((sum, p) => sum + p.monthlyCents, 0)
  const total = PRODUCTS.length
  const missing = total - owned.length
  const savedYear = PREMIUM_SEPARATE_MONTHLY_CENTS * 12 - PREMIUM_PRICES_CENTS.annual
  return (
    <aside className="plans-pitch" aria-label="Círcula Premium">
      <strong className="plans-pitch-title">Leve tudo com o Círcula Premium</strong>
      <p>
        {owned.length === 0
          ? `Com o Premium você leva o Círcula e os ${total} conteúdos por ${formatBrl(PREMIUM_MONTHLY_CENTS)} por mês, em vez de ${formatBrl(PREMIUM_SEPARATE_MONTHLY_CENTS)} separado.`
          : `Você assina ${owned.length} ${owned.length === 1 ? 'conteúdo' : 'conteúdos'} (${formatBrl(ownedMonthly)} por mês). Com o Premium você leva também os outros ${missing}, ${total} conteúdos ao todo, por ${formatBrl(PREMIUM_MONTHLY_CENTS)} por mês.`}{' '}
        Escolhendo <strong>6 meses</strong> ou <strong>1 ano</strong> sai ainda mais em conta: o anual custa {formatBrl(PREMIUM_PRICES_CENTS.annual)} e você economiza {formatBrl(savedYear)} no ano.
      </p>
      {onOpenPremium && (
        <button type="button" className="water-primary" onClick={onOpenPremium}>
          Ver o Premium
        </button>
      )}
    </aside>
  )
}

function PlanTile({
  planKey,
  name,
  monthly,
  badge,
  state,
  onOpen,
}: {
  planKey: PlanKey
  name: string
  monthly: number
  badge?: string
  /** 'own' = assinado; 'premium' = já incluído no Premium da membro. */
  state?: 'own' | 'premium' | null
  onOpen: () => void
}) {
  const Icon = PLAN_ICONS[planKey]
  return (
    <button
      type="button"
      className={`plan-tile${planKey === 'premium' ? ' plan-tile--premium' : ''}${state ? ' plan-tile--owned' : ''}`}
      onClick={onOpen}
      aria-label={`${name}, ${formatBrl(monthly)} por mês`}
    >
      <span className="plan-tile-icon">
        <Icon />
      </span>
      <span className="plan-tile-name">{name}</span>
      <span className="plan-tile-price">{formatBrl(monthly)}</span>
      <span className="plan-tile-unit">por mês</span>
      {badge && !state && <span className="plan-tile-badge">{badge}</span>}
      {state && <span className="plan-tile-owned">{state === 'premium' ? 'No Premium' : 'Assinado'}</span>}
    </button>
  )
}

export function PlansPage({
  communityId,
  viewOnly = false,
  profileId = null,
  onOpenCarro,
}: {
  communityId: string | null
  /** Abre o Carro em Dia (avulso à parte, de R$ 5,10; o Premium não o inclui). */
  onOpenCarro?: () => void
  /** A profissional vê a página como a membro vê, mas não assina (ela é a
   *  responsável pela comunidade e hoje é isenta de pagamento). */
  viewOnly?: boolean
  /** Quem está vendo (para saber quais pacotes já tem). */
  profileId?: string | null
}) {
  const { packages, refresh: refreshPackages } = useMyPackages(communityId, profileId, !viewOnly)
  const { plans } = useBillingPlans('community')
  const [open, setOpen] = useState<PlanKey | 'cesta' | null>(null)
  // Robô: espera a confirmação do pagamento depois que uma fatura é aberta, e comemora UMA vez por assinatura.
  const [aguardando, setAguardando] = useState(false)
  const [ciclo, setCiclo] = useState<PlanCycle | null>(null)
  const [celebrando, setCelebrando] = useState<Confirmacao | null>(null)
  const aoConfirmar = useCallback(
    (c: Confirmacao) => {
      if (jaCelebrou(c.chave)) return
      marcarCelebrou(c.chave)
      setAguardando(false)
      refreshPackages()
      setCelebrando(c)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useConfirmacaoAssinatura({ communityId, profileId, aguardando: aguardando && !viewOnly, onConfirmada: aoConfirmar })
  const comecouPagamento = (c: PlanCycle | null) => {
    setCiclo(c)
    setAguardando(true)
  }
  const referralDiscount = useReferralDiscount(communityId, !viewOnly)
  const premiumPrices: Record<PlanCycle, number> = referralDiscount
    ? {
        monthly: applyReferralDiscount(PREMIUM_PRICES_CENTS.monthly),
        semiannual: applyReferralDiscount(PREMIUM_PRICES_CENTS.semiannual),
        annual: applyReferralDiscount(PREMIUM_PRICES_CENTS.annual),
      }
    : PREMIUM_PRICES_CENTS

  const circulaPrices: Record<PlanCycle, number> = {
    monthly: CIRCULA_MONTHLY_CENTS,
    semiannual: CIRCULA_MONTHLY_CENTS * 6,
    annual: CIRCULA_MONTHLY_CENTS * 12,
  }
  for (const p of plans) {
    const cycle = API_CYCLE[p.billing_cycle]
    if (cycle) circulaPrices[cycle] = p.price_cents
  }

  // A janela de explicação fica sobre a tela inteira (portal no body), sempre à vista e com a página parada.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const ownedKeys = PRODUCTS.filter((p) => packages.has(p.key as never)).map((p) => p.key as string)
  const showPitch = !viewOnly && !packages.has('premium')
  const product = PRODUCTS.find((p) => p.key === open) ?? null
  const premiumOff = Math.round(
    (1 - PREMIUM_MONTHLY_CENTS / PREMIUM_SEPARATE_MONTHLY_CENTS) * 100,
  )

  return (
    <section className="plans-page">
      <header className="plans-hero">
        <p className="plans-eyebrow">Cuidar de você, do seu jeito</p>
        <h2>Planos e assinaturas</h2>
        <p className="plans-lead">
          Comece pelo Círcula e some só o que faz sentido para a sua rotina. Quem quer tudo junto encontra no Premium o melhor valor.
        </p>
        {viewOnly && (
          <p className="plans-viewonly" role="note">
            Visão da profissional: é assim que a membro vê esta página. Como responsável pela comunidade, não há assinatura para você aqui.
          </p>
        )}
      </header>

      {!viewOnly && !packages.has('premium') && (
        <RoboConsultor
          nome="Círcula Premium"
          economiaAnualCents={PREMIUM_SEPARATE_MONTHLY_CENTS * 12 - PREMIUM_PRICES_CENTS.annual}
          economiaSemestralCents={PREMIUM_SEPARATE_MONTHLY_CENTS * 6 - PREMIUM_PRICES_CENTS.semiannual}
        />
      )}

      {!viewOnly && communityId && profileId && <SubscriptionLevelCard communityId={communityId} profileId={profileId} />}

      {showPitch && <PremiumPitch ownedKeys={ownedKeys} onOpenPremium={() => setOpen('premium')} />}

      <button type="button" className="plans-wide plans-wide--circula" onClick={() => setOpen('circula')} aria-label={`Círcula, ${formatBrl(circulaPrices.monthly)} por mês`}>
        <span className="plans-wide-icon">
          <PLAN_ICONS.circula />
        </span>
        <span className="plans-wide-body">
          <strong>Círcula</strong>
          <span>Comunidade, círculos e eventos, mais Finanças, Água, IMC, Calculadora, Agenda e Minha cidade.</span>
        </span>
        <span className="plans-wide-price">
          {formatBrl(circulaPrices.monthly)}
          <small>por mês</small>
        </span>
      </button>

      <article className="plans-base" aria-label="Já incluído no Círcula">
        <h4>Já está no seu Círcula</h4>
        <ul>
          <li>Finanças e Dividir</li>
          <li>Água e IMC</li>
          <li>Calculadora</li>
          <li>Agenda</li>
          <li>Minha cidade</li>
          <li>Livi, a sua guia</li>
        </ul>
        <p>Tudo isso vem com a assinatura do Círcula, sem custo extra.</p>
      </article>

      <h3 className="plans-heading">Conteúdos avulsos</h3>
      <p className="plans-note">Escolha só o que você quer. Pagando por 6 ou 12 meses, o valor total é menor, e o plano anual é a melhor escolha.</p>
      <div className="plans-grid">
        {ORDER.map((k) => PRODUCTS.find((p) => p.key === k)).filter((p): p is (typeof PRODUCTS)[number] => !!p).map((p) => (
          <PlanTile
            key={p.key}
            planKey={p.key}
            name={p.name}
            monthly={p.monthlyCents}
            state={!viewOnly && packages.has(p.key as never) ? 'own' : !viewOnly && packages.has('premium') ? 'premium' : null}
            onOpen={() => setOpen(p.key)}
          />
        ))}
      </div>

      {!viewOnly && onOpenCarro && (
        <button type="button" className="plans-wide plans-wide--cart" onClick={onOpenCarro} aria-label="Carro em Dia, R$ 5,10 por mês">
          <span className="plans-wide-body">
            <strong>Carro em Dia</strong>
            <span>Perguntas e respostas para cuidar do seu carro. Avulso à parte, não faz parte do Premium.</span>
          </span>
          <span className="plans-wide-price">
            R$ 5,10
            <small>por mês</small>
          </span>
        </button>
      )}

      {!viewOnly && !packages.has('premium') && (
        <button type="button" className="plans-wide plans-wide--cart" onClick={() => setOpen('cesta')}>
          <span className="plans-wide-body">
            <strong>Montar minha cesta</strong>
            <span>Escolha vários conteúdos e assine todos juntos, numa cobrança só.</span>
          </span>
          <span className="plans-wide-price">
            <small>assinar junto</small>
          </span>
        </button>
      )}

      <h3 className="plans-heading">Círcula Premium</h3>
      <button type="button" className={`plans-wide plans-wide--premium${!viewOnly && packages.has('premium') ? ' plans-wide--owned' : ''}`} onClick={() => setOpen('premium')} aria-label={`Círcula Premium, ${formatBrl(PREMIUM_MONTHLY_CENTS)} por mês`}>
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
        {!viewOnly && packages.has('premium') && <span className="plans-wide-owned">Assinado</span>}
      </button>

      <article className="plans-included">
        <h4>O que você leva no Premium</h4>
        <ul>
          <li>
            <strong>Círcula</strong> <span>comunidade, círculos, eventos, Finanças, Água, IMC, Calculadora, Agenda e Minha cidade</span> <em>{formatBrl(CIRCULA_MONTHLY_CENTS)}</em>
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
        Valores em reais, cobrados pelo ciclo escolhido. O acesso libera assim que o pagamento é confirmado. Quanto mais longo o ciclo, menor o valor por mês.
      </p>

      {open && createPortal(
        <div className="plans-sheet-backdrop" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <article className="plans-card plans-sheet" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="plans-sheet-close" onClick={() => setOpen(null)} aria-label="Fechar">
              ×
            </button>

            {open === 'circula' && (
              <>
                <h3>Círcula</h3>
                <p className="plans-text">A comunidade, os círculos e os eventos, e as ferramentas do dia a dia: Finanças com divisão de despesas, Água, IMC, Calculadora, Agenda e Minha cidade.</p>
                {!viewOnly && <TrialNotice />}
                <PriceRow prices={circulaPrices} reference={circulaPrices.monthly} />
                {showPitch && <PremiumPitch ownedKeys={ownedKeys} onOpenPremium={() => setOpen('premium')} />}
                <p className="plans-note">Hoje a assinatura é mensal. Semestral e anual chegam em breve.</p>
                {viewOnly ? (
                  <p className="home-muted">
                    Esta é a página que a membro vê. Como responsável pela comunidade, você não precisa
                    assinar.
                  </p>
                ) : communityId ? (
                  <SubscriptionPanel subject="community" communityId={communityId} onCheckoutStarted={() => comecouPagamento(null)} />
                ) : (
                  <p className="home-muted">Entre em uma comunidade para assinar.</p>
                )}
              </>
            )}

            {open === 'cesta' && (
              <>
                <h3>Minha cesta</h3>
                <CartCheckout
                  communityId={communityId}
                  ownedKeys={ownedKeys}
                  onCheckoutStarted={comecouPagamento}
                  onOpenPremium={() => setOpen('premium')}
                />
              </>
            )}

            {open === 'premium' && (
              <>
                <h3>Círcula Premium</h3>
                <p className="plans-text">
                  O Círcula mais todos os conteúdos, tudo junto e com desconto: {ORDER.map((k) => PRODUCTS.find((p) => p.key === k)?.name).filter(Boolean).join(', ')}. Separado, o mensal sairia{' '}
                  {formatBrl(PREMIUM_SEPARATE_MONTHLY_CENTS)}.
                </p>
                {referralDiscount && (
                  <p className="plans-text">
                    <strong>Você chegou por convite de quem tem o Premium:</strong> ganhou mais {REFERRAL_DISCOUNT_PERCENT}% de desconto no Premium, já aplicado nos valores abaixo.
                  </p>
                )}
                <PriceRow
                  prices={premiumPrices}
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
                    prices={premiumPrices}
                    owned={packages.has('premium')}
                    profileId={profileId}
                    onCheckoutStarted={comecouPagamento}
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
                    viaPremium={packages.has('premium')}
                    onCheckoutStarted={comecouPagamento}
                  />
                ) : BUYABLE.includes(product.key) ? (
                  <p className="home-muted">Esta é a página que a membro vê. Você não precisa assinar.</p>
                ) : null}
                {showPitch && <PremiumPitch ownedKeys={ownedKeys} onOpenPremium={() => setOpen('premium')} />}
              </>
            )}
          </article>
        </div>,
        document.body,
      )}
      {celebrando && <RoboCelebracao ciclo={ciclo} onFechar={() => setCelebrando(null)} />}
    </section>
  )
}
