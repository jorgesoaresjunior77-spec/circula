import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CALC_START, pressBackspace, pressDigit, pressDot, pressEquals, pressOp, pressPercent, pressSign, showDisplay } from '../lib/calculator'
import type { CalcOp, CalcState } from '../lib/calculator'

// Calculadora em pop-up, em vidro líquido com teclas em relevo. Abre por cima da própria tela; fechar volta
// exatamente onde a pessoa estava.

type Key = { label: string; kind: 'num' | 'op' | 'fn' | 'eq'; run: (s: CalcState) => CalcState; aria?: string; op?: CalcOp }

const op = (o: CalcOp): Key['run'] => (s) => pressOp(s, o)
const num = (d: string): Key => ({ label: d, kind: 'num', run: (s) => pressDigit(s, d) })

const KEYS: Key[] = [
  { label: 'C', kind: 'fn', run: () => CALC_START, aria: 'Limpar tudo' },
  { label: '±', kind: 'fn', run: pressSign, aria: 'Trocar o sinal' },
  { label: '%', kind: 'fn', run: pressPercent, aria: 'Porcentagem' },
  { label: '÷', kind: 'op', op: '÷', run: op('÷'), aria: 'Dividir' },
  num('7'), num('8'), num('9'),
  { label: '×', kind: 'op', op: '×', run: op('×'), aria: 'Multiplicar' },
  num('4'), num('5'), num('6'),
  { label: '−', kind: 'op', op: '-', run: op('-'), aria: 'Subtrair' },
  num('1'), num('2'), num('3'),
  { label: '+', kind: 'op', op: '+', run: op('+'), aria: 'Somar' },
  { label: '⌫', kind: 'fn', run: pressBackspace, aria: 'Apagar' },
  num('0'),
  { label: ',', kind: 'num', run: pressDot, aria: 'Vírgula' },
  { label: '=', kind: 'eq', run: pressEquals, aria: 'Resultado' },
]

export function CalculatorPopup({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<CalcState>(CALC_START)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (/^[0-9]$/.test(e.key)) setState((s) => pressDigit(s, e.key))
      else if (e.key === ',' || e.key === '.') setState(pressDot)
      else if (e.key === '+' || e.key === '-') setState((s) => pressOp(s, e.key as CalcOp))
      else if (e.key === '*') setState((s) => pressOp(s, '×'))
      else if (e.key === '/') setState((s) => pressOp(s, '÷'))
      else if (e.key === 'Enter' || e.key === '=') setState(pressEquals)
      else if (e.key === 'Backspace') setState(pressBackspace)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const shown = showDisplay(state.display)

  return createPortal(
    <div className="calc-overlay" role="presentation" onClick={onClose}>
      <div className="calc" role="dialog" aria-modal="true" aria-label="Calculadora" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="calc-close" onClick={onClose} aria-label="Fechar a calculadora">
          ×
        </button>
        <div className="calc-screen" aria-live="polite">
          <span className="calc-op" aria-hidden="true">
            {state.op ? `${showDisplay(String(state.acc))} ${state.op === '-' ? '−' : state.op}` : ' '}
          </span>
          <output className={`calc-display${shown.length > 11 ? ' calc-display--long' : ''}`}>{shown}</output>
        </div>
        <div className="calc-keys">
          {KEYS.map((k) => (
            <button
              key={k.label}
              type="button"
              className={`calc-key calc-key--${k.kind}${k.op && state.op === k.op && state.fresh ? ' calc-key--on' : ''}`}
              aria-label={k.aria ?? k.label}
              onClick={() => setState((s) => k.run(s))}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
