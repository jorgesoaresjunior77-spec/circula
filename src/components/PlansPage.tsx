import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBillingPlans } from '../hooks/useBillingPlans'
import {
  CIRCULA_MONTHLY_CENTS,
  CYCLE_LABEL,
  PREMIUM_MONTHLY_CENTS,
  PREMIUM_PRICES_CENTS,
  PREMIUM_REGULAR_PRICES_CENTS,
  PREMIUM_SEPARATE_MONTHLY_CENTS,
  PRODUCTS,
  REFERRAL_DISCOUNT_PERCENT,
  applyReferralDiscount,
  cycleBreakdown,
  formatBrl,
  isPremiumPromo,
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
import { LiviPorQue, RoboCelebracao, RoboConsultor, jaCelebrou, marcarCelebrou } from './RoboPlanos'
import { useConfirmacaoAssinatura } from '../hooks/useConfirmacaoAssinatura'
import type { Confirmacao } from '../hooks/useConfirmacaoAssinatura'

// Página de Planos da membro: o plano do Círcula, cada conteúdo avulso e o
// Círcula Premium (tudo junto, com desconto), todos em cartões do mesmo
// tamanho, 3 por fila. Tocar no cartão abre os preços por ciclo e a compra
// (Asaas em Sandbox).

// Todos os planos têm cobrança no Asaas (Sandbox por enquanto).
const BUYABLE: PlanKey[] = [...PRODUCTS.map((p) => p.key), 'premium']

const CYCLES: PlanCycle[] = ['monthly', 'semiannual', 'annual']

/** Produtos avulsos organizados por assunto. A ordem aqui é a ordem na página e na lista do Premium. */
const GROUPS = [
  { title: 'Serviços', keys: ['carro', 'financas', 'rachei', 'help_nutri'] },
  { title: 'Conteúdos', keys: ['magazine', 'ebooks', 'receitas', 'leitura', 'series_filmes', 'viagens'] },
  { title: 'Bem-estar', keys: ['respiracao', 'playlist', 'wellness', 'exercicios'] },
  { title: 'Cozinha e compras', keys: ['meu_chef', 'minha_lista', 'lista_inteligente'] },
  {
    title: 'Ferramentas do dia a dia',
    keys: ['antes_de_tudo', 'agua', 'imc', 'calculadora', 'agenda', 'relogio', 'previsao', 'diario', 'jardim', 'cidade', 'cotacoes'],
  },
] as const
const ORDER = GROUPS.flatMap((g) => g.keys)
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
  onOpenFinancas,
  onOpenRachei,
}: {
  communityId: string | null
  /** Abre o Carro em Dia (avulso de R$ 4,50, também no Premium). */
  onOpenCarro?: () => void
  /** Abre as Finanças (avulso de R$ 9,90, também no Premium). */
  onOpenFinancas?: () => void
  /** Abre o Rachei $ (avulso de R$ 4,90, também no Premium). */
  onOpenRachei?: () => void
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

      <LiviPorQue premium={PREMIUM_PRICES_CENTS} separadoMensalCents={PREMIUM_SEPARATE_MONTHLY_CENTS} totalItens={PRODUCTS.length} promo={isPremiumPromo()} />

      {!viewOnly && communityId && profileId && <SubscriptionLevelCard communityId={communityId} profileId={profileId} />}

      {showPitch && <PremiumPitch ownedKeys={ownedKeys} onOpenPremium={() => setOpen('premium')} />}

      <section className="plans-checkout" aria-label="Como assinar">
        <h3 className="plans-heading">Escolha como assinar</h3>
        <div className="plans-options">
          <button type="button" className="plans-option" onClick={() => setOpen('circula')} aria-label={`Círcula, ${formatBrl(circulaPrices.monthly)} por mês`}>
            <span className="plans-option-step">1 · A base</span>
            <span className="plans-option-icon">
              <PLAN_ICONS.circula />
            </span>
            <strong>Círcula</strong>
            <span className="plans-option-price">
              {formatBrl(circulaPrices.monthly)}
              <small>por mês</small>
            </span>
            <span className="plans-option-text">Para ficar no Círcula: comunidade, círculos, eventos, perfil e convite. Ferramentas e conteúdos são avulsos ou vêm no Premium.</span>
          </button>

          <button
            type="button"
            className={`plans-option plans-option--premium${!viewOnly && packages.has('premium') ? ' plans-option--owned' : ''}`}
            onClick={() => setOpen('premium')}
            aria-label={`Círcula Premium, ${formatBrl(PREMIUM_MONTHLY_CENTS)} por mês`}
          >
            <span className="plans-option-step">2 · Tudo liberado</span>
            <span className="plans-option-icon">
              <PLAN_ICONS.premium />
            </span>
            <strong>Círcula Premium</strong>
            <span className="plans-option-price">
              {formatBrl(PREMIUM_MONTHLY_CENTS)}
              <small>por mês · {premiumOff}% off</small>
            </span>
            <span className="plans-option-text">O Círcula e todos os conteúdos e serviços, juntos e com desconto.</span>
            {!viewOnly && packages.has('premium') && <span className="plans-wide-owned">Assinado</span>}
          </button>

          {!viewOnly && !packages.has('premium') && (
            <button type="button" className="plans-option" onClick={() => setOpen('cesta')}>
              <span className="plans-option-step">3 · Do seu jeito</span>
              <span className="plans-option-icon">
                <PLAN_ICONS.ebooks />
              </span>
              <strong>Montar minha cesta</strong>
              <span className="plans-option-price">
                {formatBrl(circulaPrices.monthly)} +<small>os avulsos que quiser</small>
              </span>
              <span className="plans-option-text">Assine o Círcula e escolha quantos produtos avulsos quiser. Coloque no carrinho e é só pagar.</span>
            </button>
          )}
        </div>
        {isPremiumPromo() && (
          <p className="plans-promo" role="note">
            <strong>Preço de lançamento:</strong> o Premium custa {formatBrl(PREMIUM_PRICES_CENTS.monthly)} por mês para quem assinar até 31/12/2026. A partir de 01/01/2027, passa a {formatBrl(PREMIUM_REGULAR_PRICES_CENTS.monthly)}.
          </p>
        )}
      </section>

      {showPitch && <PremiumPitch ownedKeys={ownedKeys} onOpenPremium={() => setOpen('premium')} />}

      <article className="plans-base" aria-label="Já incluído no Círcula">
        <h4>Já está no seu Círcula</h4>
        <ul>
          <li>Comunidade (feed)</li>
          <li>Círculos</li>
          <li>Eventos</li>
          <li>Perfil e convite</li>
          <li>Livi, a sua guia</li>
        </ul>
        <p>Isso vem com a assinatura do Círcula. As ferramentas (Água, IMC, Calculadora, Agenda, Relógio, Previsão, Diário, Jardim, Minha cidade, Cotações e Antes de Tudo) são avulsas de R$ 4,90 cada, ou vêm todas no Premium.</p>
      </article>

      <h3 className="plans-heading">Produtos avulsos</h3>
      <p className="plans-note">Escolha só o que você quer. Pagando por 6 ou 12 meses, o valor total é menor, e o plano anual é a melhor escolha. Todos fazem parte do Premium.</p>
      {GROUPS.map((g) => (
        <div key={g.title} className="plans-group">
          <h4 className="plans-group-title">{g.title}</h4>
          <div className="plans-grid">
            {g.keys.map((k) => PRODUCTS.find((p) => p.key === k)).filter((p): p is (typeof PRODUCTS)[number] => !!p).map((p) => (
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
        </div>
      ))}

      <article className="plans-included">
        <h4>O que você leva no Premium</h4>
        <ul>
          <li>
            <strong>Círcula</strong> <span>comunidade, círculos, eventos, perfil e convite</span> <em>{formatBrl(CIRCULA_MONTHLY_CENTS)}</em>
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
                <p className="plans-text">O plano para ficar no Círcula: a comunidade, os círculos, os eventos, o seu perfil e o convite. As ferramentas e os conteúdos são avulsos ou vêm todos juntos no Premium.</p>
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
                {isPremiumPromo() && (
                  <p className="plans-text">
                    <strong>Preço de lançamento:</strong> {formatBrl(PREMIUM_PRICES_CENTS.monthly)} por mês para quem assinar até 31/12/2026. A partir de 01/01/2027, o Premium passa a {formatBrl(PREMIUM_REGULAR_PRICES_CENTS.monthly)} por mês.
                  </p>
                )}
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
                {(product.key === 'carro' || product.key === 'financas' || product.key === 'rachei') && !viewOnly && (packages.has(product.key as never) || packages.has('premium')) && (
                  <button
                    type="button"
                    className="water-primary"
                    onClick={() => {
                      setOpen(null)
                      if (product.key === 'carro') onOpenCarro?.()
                      else if (product.key === 'rachei') onOpenRachei?.()
                      else onOpenFinancas?.()
                    }}
                  >
                    Abrir {product.name}
                  </button>
                )}
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
