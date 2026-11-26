// Calculadora simples (4 operações, %, ±, vírgula). Sem eval: um pequeno estado de máquina.

export type CalcOp = '+' | '-' | '×' | '÷'

export interface CalcState {
  /** O que aparece no visor (texto, com ponto decimal interno). */
  display: string
  /** Valor guardado antes do operador. */
  acc: number | null
  op: CalcOp | null
  /** O próximo dígito começa um número novo. */
  fresh: boolean
  error: boolean
}

export const CALC_START: CalcState = { display: '0', acc: null, op: null, fresh: true, error: false }

function apply(a: number, b: number, op: CalcOp): number | null {
  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '×':
      return a * b
    case '÷':
      return b === 0 ? null : a / b
  }
}

/** Evita lixo de ponto flutuante (0,1 + 0,2) e números enormes no visor. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return 'Erro'
  const rounded = Number(n.toPrecision(12))
  const text = String(rounded)
  return text.length > 14 ? rounded.toExponential(6) : text
}

export function showDisplay(display: string): string {
  if (display === 'Erro') return display
  const [int, dec] = display.split('.')
  const neg = int.startsWith('-')
  const digits = neg ? int.slice(1) : int
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${neg ? '-' : ''}${grouped}${dec !== undefined ? `,${dec}` : display.endsWith('.') ? ',' : ''}`
}

export function pressDigit(s: CalcState, d: string): CalcState {
  if (s.error) s = CALC_START
  const base = s.fresh ? '' : s.display
  if (base.replace(/[-.]/g, '').length >= 12) return s
  const next = base === '0' || base === '' ? d : base + d
  return { ...s, display: next, fresh: false }
}

export function pressDot(s: CalcState): CalcState {
  if (s.error) s = CALC_START
  if (s.fresh) return { ...s, display: '0.', fresh: false }
  if (s.display.includes('.')) return s
  return { ...s, display: `${s.display}.` }
}

export function pressOp(s: CalcState, op: CalcOp): CalcState {
  if (s.error) return s
  const cur = Number(s.display)
  if (s.acc !== null && s.op && !s.fresh) {
    const r = apply(s.acc, cur, s.op)
    if (r === null) return { ...CALC_START, display: 'Erro', error: true }
    return { display: formatNumber(r), acc: r, op, fresh: true, error: false }
  }
  return { ...s, acc: cur, op, fresh: true }
}

export function pressEquals(s: CalcState): CalcState {
  if (s.error || s.acc === null || !s.op) return s
  const r = apply(s.acc, Number(s.display), s.op)
  if (r === null) return { ...CALC_START, display: 'Erro', error: true }
  return { display: formatNumber(r), acc: null, op: null, fresh: true, error: false }
}

export function pressPercent(s: CalcState): CalcState {
  if (s.error) return s
  const cur = Number(s.display)
  // "200 + 10 %" = 10% de 200; sozinho, divide por 100.
  const v = s.acc !== null && s.op && (s.op === '+' || s.op === '-') ? (s.acc * cur) / 100 : cur / 100
  return { ...s, display: formatNumber(v), fresh: true }
}

export function pressSign(s: CalcState): CalcState {
  if (s.error || s.display === '0') return s
  return { ...s, display: s.display.startsWith('-') ? s.display.slice(1) : `-${s.display}` }
}

export function pressBackspace(s: CalcState): CalcState {
  if (s.error) return CALC_START
  if (s.fresh) return s
  const next = s.display.length <= 1 || (s.display.length === 2 && s.display.startsWith('-')) ? '0' : s.display.slice(0, -1)
  return { ...s, display: next }
}
