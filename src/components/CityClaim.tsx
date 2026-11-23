import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  HIGHLIGHT_CYCLE_LABEL,
  HIGHLIGHT_CYCLE_MONTHS,
  HIGHLIGHT_MONTHLY_CENTS,
  formatPhoneBR,
  highlightPriceCents,
  phoneDigits,
} from '../lib/city'
import type { CityListing, HighlightCycle } from '../lib/city'
import { formatBrl } from '../lib/plansCatalog'
import { isValidDocument } from '../lib/brazilianDocument'
import { cancelHighlight, createClaim, hasBillingData, saveBillingData, subscribeHighlight } from '../hooks/useCity'

// Reivindicar um negócio local e contratar o destaque da capa.
//  1) a participante pede (deixa o WhatsApp); a nutricionista fala com ela e aprova;
//  2) aprovada, ela vira a dona do cadastro e pode contratar o destaque:
//     R$ 4,90 por mês (semestral e anual com desconto). Cancelar tira o destaque na hora.

const CYCLES: HighlightCycle[] = ['monthly', 'semiannual', 'annual']

function Highlight({ listing, onChanged }: { listing: CityListing; onChanged: () => void }) {
  const [hasBilling, setHasBilling] = useState<boolean | null>(null)
  const [docType, setDocType] = useState<'CPF' | 'CNPJ'>('CPF')
  const [doc, setDoc] = useState('')
  const [cycle, setCycle] = useState<HighlightCycle>('annual')
  const [busy, setBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    void hasBillingData().then((v) => {
      if (!cancelled) setHasBilling(v)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const until = listing.destaque_ate ? new Date(listing.destaque_ate).toLocaleDateString('pt-BR') : null

  async function saveDoc(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    const digits = doc.replace(/\D/g, '')
    if (!isValidDocument(docType, digits)) return setMsg({ ok: false, text: `${docType} inválido. Confira os números.` })
    setBusy(true)
    const r = await saveBillingData(docType, doc)
    setBusy(false)
    if (r.error) setMsg({ ok: false, text: r.error })
    else setHasBilling(true)
  }

  async function subscribe() {
    setMsg(null)
    setBusy(true)
    const r = await subscribeHighlight(listing.id, cycle)
    setBusy(false)
    if (r.error) return setMsg({ ok: false, text: r.error })
    if (r.invoiceUrl) window.open(r.invoiceUrl, '_blank')
    setMsg({ ok: true, text: 'Conclua o pagamento na página que abriu em outra aba. O destaque entra no ar quando o pagamento é confirmado.' })
    onChanged()
  }

  async function cancel() {
    if (!listing.destaque_meu_id) return
    setBusy(true)
    const r = await cancelHighlight(listing.destaque_meu_id)
    setBusy(false)
    setConfirmCancel(false)
    if (r.error) setMsg({ ok: false, text: r.error })
    else {
      setMsg({ ok: true, text: 'Destaque cancelado. Ele saiu do ar agora, na hora.' })
      onChanged()
    }
  }

  if (listing.destaque_meu === 'active' || listing.destaque_meu === 'past_due') {
    return (
      <div className="cty-claim-box">
        <p>
          <strong>Destaque ativo</strong>
          {until ? ` até ${until}` : ''}. A capa do seu negócio aparece primeiro, na faixa “Em destaque”.
          {listing.destaque_meu === 'past_due' && ' Há um pagamento em aberto: regularize para o destaque não sair do ar.'}
        </p>
        {!confirmCancel ? (
          <button type="button" className="cty-link cty-link--danger" onClick={() => setConfirmCancel(true)}>
            Cancelar o destaque
          </button>
        ) : (
          <div className="cty-actions">
            <p className="cty-note">Atenção: ao cancelar, o destaque sai do ar agora, na hora, mesmo que o período já esteja pago.</p>
            <button type="button" className="cty-btn cty-btn--small cty-btn--primary" disabled={busy} onClick={() => void cancel()}>
              Sim, cancelar
            </button>
            <button type="button" className="cty-btn cty-btn--small" onClick={() => setConfirmCancel(false)}>
              Voltar
            </button>
          </div>
        )}
        {msg && <p className={msg.ok ? 'auth-success' : 'auth-error'}>{msg.text}</p>}
      </div>
    )
  }

  return (
    <div className="cty-claim-box">
      <p>
        <strong>Destaque da capa: {formatBrl(HIGHLIGHT_MONTHLY_CENTS)} por mês.</strong> A capa do seu negócio fica na faixa “Em destaque” no topo da cidade e aparece
        antes de todas.
      </p>
      {listing.destaque_meu === 'pending' && <p className="home-muted">Há uma fatura aguardando pagamento. Conclua o pagamento para o destaque entrar no ar.</p>}
      {hasBilling === false && (
        <form className="cty-row" onSubmit={(e) => void saveDoc(e)}>
          <label className="cty-field">
            <span className="cty-label">Documento para a cobrança</span>
            <select value={docType} onChange={(e) => setDocType(e.target.value as 'CPF' | 'CNPJ')}>
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
            </select>
          </label>
          <label className="cty-field">
            <span className="cty-label">{docType}</span>
            <input type="text" inputMode="numeric" value={doc} onChange={(e) => setDoc(e.target.value)} placeholder={docType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'} />
          </label>
          <button type="submit" className="cty-btn cty-btn--small" disabled={busy || !doc.trim()}>
            Salvar
          </button>
        </form>
      )}
      {hasBilling && (
        <>
          <div className="cty-chips" role="radiogroup" aria-label="Ciclo de cobrança">
            {CYCLES.map((c) => {
              const price = highlightPriceCents(c)
              const full = HIGHLIGHT_MONTHLY_CENTS * HIGHLIGHT_CYCLE_MONTHS[c]
              const off = Math.round((1 - price / full) * 100)
              return (
                <button key={c} type="button" role="radio" aria-checked={cycle === c} className={`cty-chip${cycle === c ? ' cty-chip--on' : ''}`} onClick={() => setCycle(c)}>
                  {HIGHLIGHT_CYCLE_LABEL[c]} · {formatBrl(price)}
                  {off > 0 ? ` (${off}% off)` : ''}
                </button>
              )
            })}
          </div>
          <p className="home-muted">
            {cycle === 'monthly'
              ? 'Cobrança todo mês. Pagando 6 ou 12 meses de uma vez, o valor total é menor.'
              : `Equivale a ${formatBrl(Math.round(highlightPriceCents(cycle) / HIGHLIGHT_CYCLE_MONTHS[cycle]))} por mês.`}
          </p>
          <button type="button" className="cty-btn cty-btn--primary" disabled={busy} onClick={() => void subscribe()}>
            {busy ? 'Abrindo…' : `Contratar destaque ${HIGHLIGHT_CYCLE_LABEL[cycle].toLowerCase()}`}
          </button>
        </>
      )}
      {msg && <p className={msg.ok ? 'auth-success' : 'auth-error'}>{msg.text}</p>}
    </div>
  )
}

export function CityClaim({ listing, readOnly, onChanged }: { listing: CityListing; readOnly: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [whatsapp, setWhatsapp] = useState('( ) ')
  const [mensagem, setMensagem] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  if (listing.tipo !== 'lugar' && listing.tipo !== 'profissional') return null

  if (listing.sou_dona) {
    return (
      <div className="cty-claim">
        <p className="cty-claim-title">Você é a dona deste negócio</p>
        <Highlight listing={listing} onChanged={onChanged} />
      </div>
    )
  }

  if (listing.reivindicado) return null

  if (listing.minha_reivindicacao === 'pendente' || sent) {
    return (
      <p className="cty-note">
        Pedido enviado. A nutricionista vai falar com você pelo WhatsApp que você deixou e, aprovando, você poderá contratar o destaque da capa.
      </p>
    )
  }

  if (listing.pedido_em_aberto || readOnly) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (phoneDigits(whatsapp) < 10) return setError('Informe o WhatsApp com DDD, por exemplo (51) 99999-9999.')
    setBusy(true)
    const r = await createClaim(listing.id, whatsapp, mensagem)
    setBusy(false)
    if (r.error) return setError(r.error)
    setSent(true)
    onChanged()
  }

  return (
    <div className="cty-claim">
      {!open ? (
        <button type="button" className="cty-link" onClick={() => setOpen(true)}>
          Este negócio é meu: reivindicar e pedir destaque
        </button>
      ) : (
        <form className="cty-claim-form" onSubmit={(e) => void submit(e)}>
          <p className="cty-note">
            Deixe o seu WhatsApp: a nutricionista vai falar com você para confirmar que o negócio é seu. Depois de aprovado, você pode contratar o destaque da capa por{' '}
            {formatBrl(HIGHLIGHT_MONTHLY_CENTS)} por mês (6 e 12 meses com desconto).
          </p>
          <label className="cty-field">
            <span className="cty-label">Seu WhatsApp com DDD</span>
            <input type="tel" inputMode="tel" maxLength={16} value={whatsapp} onChange={(e) => setWhatsapp(formatPhoneBR(e.target.value))} />
          </label>
          <label className="cty-field">
            <span className="cty-label">Recado (opcional)</span>
            <textarea rows={2} maxLength={500} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Ex.: sou a proprietária, o Instagram do negócio é…" />
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="cty-actions">
            <button type="submit" className="cty-btn cty-btn--small cty-btn--primary" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar pedido'}
            </button>
            <button type="button" className="cty-btn cty-btn--small" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
