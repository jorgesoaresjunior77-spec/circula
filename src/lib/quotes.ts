// Cotações do Dólar, Euro, Bitcoin e Ethereum em reais (API pública AwesomeAPI, sem chave e sem dado da pessoa).
// A faixa do Início mostra o valor de agora e a variação do dia; a página Cotações (avulso) mostra o
// crescimento nos últimos dias, com gráfico.

export type QuoteCode = 'USD' | 'EUR' | 'BTC' | 'ETH'

export const QUOTE_CODES: QuoteCode[] = ['USD', 'EUR', 'BTC', 'ETH']

export const QUOTE_NAMES: Record<QuoteCode, string> = {
  USD: 'Dólar',
  EUR: 'Euro',
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
}

export interface Quote {
  code: QuoteCode
  /** Valor de compra em reais. */
  bid: number
  /** Variação do dia, em %. */
  pctChange: number
  /** Quando a cotação foi registrada (ms). */
  at: number
}

export interface QuotePoint {
  at: number
  bid: number
}

const BASE = 'https://economia.awesomeapi.com.br/json'

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : NaN
}

/** Converte a resposta de /last em cotações; ignora o que vier incompleto. */
export function parseLast(json: unknown): Quote[] {
  if (!json || typeof json !== 'object') return []
  const out: Quote[] = []
  for (const code of QUOTE_CODES) {
    const row = (json as Record<string, Record<string, unknown> | undefined>)[`${code}BRL`]
    if (!row) continue
    const bid = num(row.bid)
    const pct = num(row.pctChange)
    const ts = num(row.timestamp)
    if (!Number.isFinite(bid)) continue
    out.push({ code, bid, pctChange: Number.isFinite(pct) ? pct : 0, at: Number.isFinite(ts) ? ts * 1000 : Date.now() })
  }
  return out
}

/** Converte a resposta de /daily (mais novo primeiro) em pontos do mais antigo ao mais novo. */
export function parseDaily(json: unknown): QuotePoint[] {
  if (!Array.isArray(json)) return []
  const pts: QuotePoint[] = []
  for (const row of json as Record<string, unknown>[]) {
    const bid = num(row?.bid)
    const ts = num(row?.timestamp)
    if (Number.isFinite(bid) && Number.isFinite(ts)) pts.push({ at: ts * 1000, bid })
  }
  return pts.sort((a, b) => a.at - b.at)
}

export async function fetchQuotes(signal?: AbortSignal): Promise<Quote[]> {
  const res = await fetch(`${BASE}/last/${QUOTE_CODES.map((c) => `${c}-BRL`).join(',')}`, { signal })
  if (!res.ok) throw new Error(`cotações: ${res.status}`)
  return parseLast(await res.json())
}

export async function fetchHistory(code: QuoteCode, days: number, signal?: AbortSignal): Promise<QuotePoint[]> {
  const res = await fetch(`${BASE}/daily/${code}-BRL/${days}`, { signal })
  if (!res.ok) throw new Error(`histórico ${code}: ${res.status}`)
  return parseDaily(await res.json())
}

/** Crescimento entre o primeiro e o último ponto, em %. */
export function growthPct(points: QuotePoint[]): number | null {
  if (points.length < 2 || points[0].bid <= 0) return null
  return ((points[points.length - 1].bid - points[0].bid) / points[0].bid) * 100
}

const BRL2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const BRL4 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 })

/** Moedas com 4 casas (como no câmbio); cripto sem centavos quando passa de mil reais. */
export function formatQuote(code: QuoteCode, bid: number): string {
  if (code === 'USD' || code === 'EUR') return BRL4.format(bid)
  return bid >= 1000 ? BRL0.format(bid) : BRL2.format(bid)
}

export function formatPct(pct: number): string {
  const s = Math.abs(pct).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${s}%`
}
