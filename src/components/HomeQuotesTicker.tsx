import { useEffect, useState } from 'react'
import { QUOTE_NAMES, fetchQuotes, formatPct, formatQuote } from '../lib/quotes'
import type { Quote } from '../lib/quotes'

// Fim da página: Dólar, Euro, Bitcoin e Ethereum correndo numa faixa, no estilo painel da bolsa
// (valor de agora e a variação do dia, com seta). Atualiza a cada 5 minutos com a página aberta.
// Tocar abre a página Cotações (o crescimento com gráfico é um avulso de R$ 4,90).

const REFRESH_MS = 5 * 60 * 1000

export function HomeQuotesTicker({ onOpen }: { onOpen: () => void }) {
  const [quotes, setQuotes] = useState<Quote[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    const load = () =>
      fetchQuotes(ctrl.signal)
        .then((q) => {
          setQuotes(q)
          setFailed(false)
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setFailed(true)
        })
    void load()
    const t = window.setInterval(() => {
      if (!document.hidden) void load()
    }, REFRESH_MS)
    return () => {
      ctrl.abort()
      window.clearInterval(t)
    }
  }, [])

  const items = quotes ?? []
  const row = (copy: boolean) =>
    items.map((q) => {
      const dir = q.pctChange > 0 ? 'up' : q.pctChange < 0 ? 'down' : 'flat'
      return (
        <span key={`${q.code}${copy ? '-c' : ''}`} className={`quotes-item quotes-item--${dir}`} aria-hidden={copy || undefined}>
          <span className="quotes-code">{q.code}</span>
          <span className="quotes-name">{QUOTE_NAMES[q.code]}</span>
          <span className="quotes-value">{formatQuote(q.code, q.bid)}</span>
          <span className="quotes-change">
            <span aria-hidden="true">{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■'}</span> {formatPct(q.pctChange)}
          </span>
        </span>
      )
    })

  return (
    <section className="home-quotes" aria-label="Cotações de hoje">
      <button type="button" className="quotes-board" onClick={onOpen} aria-label="Cotações: abrir o crescimento das moedas">
        <span className="quotes-head">
          <span className="quotes-live" aria-hidden="true" />
          Cotações
          <span className="quotes-head-hint">em reais · ver crescimento ›</span>
        </span>
        {failed && !quotes ? (
          <span className="quotes-empty">Cotações indisponíveis agora. Tente de novo em instantes.</span>
        ) : !quotes ? (
          <span className="quotes-empty">Carregando cotações…</span>
        ) : (
          <span className="quotes-viewport">
            <span className="quotes-track">
              {row(false)}
              {row(true)}
            </span>
          </span>
        )}
      </button>
    </section>
  )
}
