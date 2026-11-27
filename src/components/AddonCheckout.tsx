import { useState } from 'react'
import { useAddonCheckout } from '../hooks/useAddonCheckout'
import { useSubscription } from '../hooks/useSubscription'
import { useMyAddonSubscription } from '../hooks/useMyAddonSubscription'
import { CYCLE_LABEL, CYCLE_MONTHS, formatBrl, installmentOptions, installmentSplit } from '../lib/plansCatalog'
import type { PlanCycle } from '../lib/plansCatalog'
import { BillingDocumentForm } from './BillingDocumentForm'
import { RoboInsiste, RoboRetencao } from './RoboPlanos'

// Assinar um conteúdo avulso (Respiração, Wellness): pede o CPF/CNPJ uma vez,
// a membro escolhe o ciclo e o Asaas abre a fatura em outra aba. O acesso é
// liberado sozinho quando o pagamento é confirmado.

// O anual vem primeiro (já escolhido) e o semestral é a segunda opção; o mensal continua disponível.
const CYCLES: PlanCycle[] = ['annual', 'semiannual', 'monthly']

const CODE_MESSAGES: Record<string, string> = {
  MISSING_BILLING_DATA: 'Cadastre seu CPF/CNPJ antes de assinar.',
  NOT_ACTIVE_MEMBER: 'Você precisa ter a entrada aprovada na comunidade para assinar.',
  ALREADY_ACTIVE: 'Você já tem este plano ativo.',
  INVALID_INSTALLMENTS: 'Esse número de parcelas não está disponível para este plano.',
}

export function AddonCheckout({
  planKey,
  communityId,
  prices,
  owned,
  profileId = null,
  viaPremium = false,
  onCheckoutStarted,
}: {
  planKey: string
  communityId: string | null
  prices: Record<PlanCycle, number>
  /** Já tem este plano (ou o Premium): só avisa. */
  owned: boolean
  /** Quem está vendo (para achar a assinatura dela e permitir cancelar). */
  profileId?: string | null
  /** A membro tem o Premium: este conteúdo já está incluído nele. */
  viaPremium?: boolean
  /** Chamado quando a fatura foi aberta (a página passa a esperar a confirmação do pagamento). */
  onCheckoutStarted?: (cycle: PlanCycle) => void
}) {
  const { hasBillingCustomerData, refresh: refreshBilling, subscription: baseSub, cancelSubscription } = useSubscription({
    subject: 'community',
    communityId: communityId ?? undefined,
  })
  const { subscribe, busy } = useAddonCheckout(communityId)
  const mine = useMyAddonSubscription(communityId, profileId, planKey)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelingAll, setCancelingAll] = useState(false)
  const [cancelAllError, setCancelAllError] = useState<string | null>(null)
  const [cycle, setCycle] = useState<PlanCycle>('annual')
  /** 1 = à vista (Pix, boleto ou cartão, renova sozinho); 2+ = parcelado no cartão (não renova). */
  const [installments, setInstallments] = useState(1)
  const effInstallments = installmentOptions(cycle, prices[cycle]).includes(installments) ? installments : 1
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  /** O servidor disse que falta o CPF (mesmo com a tela achando que tinha). */
  const [needDoc, setNeedDoc] = useState(false)

  if (owned) {
    const canceled = mine.sub?.status === 'canceled'
    // Incluído no Premium e sem assinatura separada: nada a cancelar aqui.
    if (viaPremium && planKey !== 'premium' && !mine.sub) {
      return <p className="auth-success">Incluído no seu Círcula Premium. Não precisa assinar nem cancelar separado.</p>
    }
    return (
      <div className="addon-checkout">
        <p className="auth-success">
          {canceled ? 'Assinatura cancelada. O acesso foi encerrado na hora.' : 'Você já tem este plano. Aproveite!'}
        </p>
        {mine.sub && mine.sub.plan_key === 'cesta' && !canceled && (
          <p className="home-muted">Este conteúdo faz parte da sua cesta. Cancelar tira só ele: os outros continuam e a próxima cobrança já vem com o valor menor.</p>
        )}
        {viaPremium && planKey !== 'premium' && mine.sub && !canceled && (
          <p className="home-muted">Este conteúdo já está incluído no seu Premium. Esta assinatura separada pode ser cancelada para não pagar em dobro.</p>
        )}
        {mine.sub && !canceled && !confirmingCancel && (
          <button type="button" className="water-link" onClick={() => setConfirmingCancel(true)}>
            Cancelar assinatura
          </button>
        )}
        {mine.sub && !canceled && confirmingCancel && planKey === 'premium' && (
          <RoboRetencao
            busy={mine.busy || cancelingAll}
            podeCancelarTudo={!!baseSub && typeof cancelSubscription === 'function'}
            onManter={() => setConfirmingCancel(false)}
            onBasico={() => void mine.cancel().then(() => setConfirmingCancel(false))}
            onTudo={() => {
              setCancelingAll(true)
              void cancelSubscription()
                .then((r) => {
                  if (r.error) setCancelAllError('Não foi possível cancelar agora. Tente novamente em instantes.')
                  else setConfirmingCancel(false)
                })
                .finally(() => setCancelingAll(false))
            }}
          />
        )}
        {cancelAllError && <p className="auth-error">{cancelAllError}</p>}
        {mine.sub && !canceled && confirmingCancel && planKey !== 'premium' && (
          <div className="question-item-actions">
            <p className="home-muted">
              Atenção: ao cancelar, a cobrança para e o seu acesso a este plano é cortado agora, na hora, mesmo que o período já esteja pago.
            </p>
            <button
              type="button"
              className="question-delete-button"
              disabled={mine.busy}
              onClick={() => void mine.cancel().then(() => setConfirmingCancel(false))}
            >
              {mine.busy ? 'Cancelando…' : 'Confirmar cancelamento'}
            </button>
            <button type="button" onClick={() => setConfirmingCancel(false)} disabled={mine.busy}>
              Voltar
            </button>
          </div>
        )}
        {mine.error && <p className="auth-error">{mine.error}</p>}
      </div>
    )
  }
  if (!communityId) return <p className="home-muted">Entre em uma comunidade para assinar.</p>

  async function handleSubscribe() {
    setMessage(null)
    const { error, code, invoiceUrl } = await subscribe(planKey, cycle, effInstallments)
    if (error) {
      if (code === 'MISSING_BILLING_DATA') {
        setNeedDoc(true)
        return
      }
      setMessage({ ok: false, text: (code && CODE_MESSAGES[code]) || error })
      return
    }
    if (invoiceUrl) {
      window.open(invoiceUrl, '_blank')
      setMessage({ ok: true, text: 'Conclua o pagamento na página que abriu em outra aba. O acesso libera quando o pagamento é confirmado.' })
      onCheckoutStarted?.(cycle)
      return
    }
    setMessage({ ok: true, text: 'Assinatura registrada. Aguarde a confirmação do pagamento.' })
    onCheckoutStarted?.(cycle)
  }

  return (
    <div className="addon-checkout">
      {(hasBillingCustomerData === false || needDoc) && (
        <BillingDocumentForm
          idPrefix={`addon-doc-${planKey}`}
          intro="Para emitir a cobrança, o Asaas precisa do seu CPF (ou CNPJ). Você informa uma vez."
          onSaved={() => {
            setNeedDoc(false)
            setMessage({ ok: true, text: 'CPF salvo. Agora escolha o plano e toque em Assinar.' })
            void refreshBilling()
          }}
        />
      )}

      {hasBillingCustomerData && !needDoc && (
        <>
          <div className="addon-cycles" role="radiogroup" aria-label="Ciclo de cobrança">
            {CYCLES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={cycle === c}
                className={`schedule-type${cycle === c ? ' schedule-type--on' : ''}`}
                onClick={() => setCycle(c)}
              >
                {CYCLE_LABEL[c]} · {formatBrl(prices[c])}
                {c === 'annual' && <small className="addon-cycle-best"> · Melhor escolha agora</small>}
              </button>
            ))}
          </div>
          <RoboInsiste cycle={cycle} prices={prices} onPick={setCycle} />
          {cycle !== 'monthly' && (
            <div className="addon-installments">
              <p className="addon-total">
                Total de {CYCLE_MONTHS[cycle]} meses: <strong>{formatBrl(prices[cycle])}</strong>
              </p>
              <label htmlFor="addon-installments">Forma de pagamento</label>
              <select
                id="addon-installments"
                value={effInstallments}
                onChange={(e) => setInstallments(Number(e.target.value))}
              >
                {installmentOptions(cycle, prices[cycle]).map((n) => {
                  const { each, last } = installmentSplit(prices[cycle], n)
                  return (
                    <option key={n} value={n}>
                      {n === 1
                        ? `À vista: ${formatBrl(prices[cycle])} (Pix, boleto ou cartão)`
                        : `${n}x de ${formatBrl(each)}${last !== each ? ` (última ${formatBrl(last)})` : ''} no cartão`}
                    </option>
                  )
                })}
              </select>
              <small className="home-muted">
                {effInstallments > 1
                  ? `Uma contratação de ${CYCLE_MONTHS[cycle]} meses dividida em ${effInstallments} parcelas no cartão. Não renova sozinha.`
                  : `Pago de uma vez; renova a cada ${CYCLE_MONTHS[cycle]} meses até você cancelar.`}
              </small>
            </div>
          )}
          <button type="button" className="water-primary" onClick={() => void handleSubscribe()} disabled={busy}>
            {busy ? 'Abrindo…' : `Assinar ${CYCLE_LABEL[cycle].toLowerCase()}`}
          </button>
        </>
      )}

      {message && <p className={message.ok ? 'auth-success' : 'auth-error'}>{message.text}</p>}
    </div>
  )
}
