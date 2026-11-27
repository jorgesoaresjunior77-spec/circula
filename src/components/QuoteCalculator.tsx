import { useEffect, useState } from 'react'
import { QUOTE_CODES, QUOTE_DECIMALS, QUOTE_NAMES, fetchQuotes, simulatePurchase } from '../lib/quotes'
import type { Quote, QuoteCode } from '../lib/quotes'
import { parsePriceToCents } from '../lib/shopping'

// Calculadora da página Cotações: "com R$ X, quanto de Bitcoin (Dólar, Euro,
// Ethereum) eu compraria?". Usa a cotação real da mesma fonte da página
// (AwesomeAPI), atualiza sozinha a cada minuto e diz a hora da cotação.
// É só uma simulação: não compra nada.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const TIME = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const SYMBOL: Record<QuoteCode, string> = { USD: 'US$', EUR: '€', BTC: 'BTC', ETH: 'ETH' }

function formatAmount(code: QuoteCode, q: number): string {
  const d = QUOTE_DECIMALS[code]
  const n = q.toLocaleString('pt-BR', { minimumFractionDigits: Math.min(2, d), maximumFractionDigits: d })
  return code === 'USD' || code === 'EUR' ? `${SYMBOL[code]} ${n}` : `${n} ${SYMBOL[code]}`
}

export function QuoteCalculator() {
  const [amount, setAmount] = useState('100,00')
  const [code, setCode] = useState<QuoteCode>('BTC')
  const [fee, setFee] = useState('')
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ctrl = new AbortController()
    const load = () => {
      ctrl.abort()
      ctrl = new AbortController()
      fetchQuotes(ctrl.signal)
        .then((q) => {
          setQuotes(q)
          setError(false)
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setError(true)
        })
        .finally(() => setLoading(false))
    }
    load()
    const t = window.setInterval(load, 60_000)
    return () => {
      window.clearInterval(t)
      ctrl.abort()
    }
  }, [])

  const quote = quotes.find((q) => q.code === code) ?? null
  const cents = parsePriceToCents(amount)
  const feePct = fee.trim() ? Number(fee.replace(',', '.')) : 0
  const feeInvalid = !Number.isFinite(feePct) || feePct < 0 || feePct >= 100
  const sim = quote && cents && !feeInvalid ? simulatePurchase(cents / 100, quote, feePct) : null

  return (
    <section className="cot-calc" aria-labelledby="cot-calc-title">
      <h3 id="cot-calc-title">Calculadora: quanto dá para comprar?</h3>
      <div className="cot-calc-fields">
        <label>
          Valor disponível (R$)
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            onFocus={(e) => e.currentTarget.select()}
            aria-invalid={amount.trim() !== '' && !cents}
          />
        </label>
        <label>
          Ativo
          <select value={code} onChange={(e) => setCode(e.target.value as QuoteCode)}>
            {QUOTE_CODES.map((c) => (
              <option key={c} value={c}>
                {QUOTE_NAMES[c]} ({SYMBOL[c]})
              </option>
            ))}
          </select>
        </label>
        <label>
          Taxa da corretora (%) · opcional
          <input inputMode="decimal" value={fee} placeholder="0" onChange={(e) => setFee(e.target.value.replace(/[^\d.,]/g, ''))} aria-invalid={feeInvalid} />
        </label>
      </div>

      {loading && <p className="home-muted">Buscando a cotação…</p>}
      {!loading && error && !quote && <p className="auth-error">Não foi possível buscar a cotação agora. Tente de novo em instantes.</p>}
      {amount.trim() !== '' && !cents && <p className="auth-error">Digite um valor em reais, por exemplo 100,00.</p>}
      {feeInvalid && <p className="auth-error">A taxa precisa ser um número entre 0 e 99.</p>}

      {quote && sim && (
        <div className="cot-calc-result" role="status" aria-live="polite">
          <p className="cot-calc-big">
            {BRL.format(cents! / 100)} em {QUOTE_NAMES[code]} ≈ <strong>{formatAmount(code, sim.quantity)}</strong>
          </p>
          <dl className="cot-calc-detail">
            <div>
              <dt>Cotação usada (preço de venda)</dt>
              <dd>
                1 {SYMBOL[code]} = {BRL.format(sim.price)}
              </dd>
            </div>
            {sim.feeBrl > 0 && (
              <div>
                <dt>Taxa de {String(feePct).replace('.', ',')}%</dt>
                <dd>− {BRL.format(sim.feeBrl)}</dd>
              </div>
            )}
            <div>
              <dt>Atualizada em</dt>
              <dd>{TIME.format(new Date(quote.at))}</dd>
            </div>
          </dl>
          <p className="cot-calc-note">
            Simulação aproximada, não é ordem de compra. O valor real muda a cada minuto e depende da corretora (spread, taxas e IOF no câmbio).
          </p>
        </div>
      )}
    </section>
  )
}
