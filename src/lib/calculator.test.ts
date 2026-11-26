import { describe, it, expect } from 'vitest'
import { CALC_START, pressBackspace, pressDigit, pressDot, pressEquals, pressOp, pressPercent, pressSign, showDisplay } from './calculator'
import type { CalcState } from './calculator'

const seq = (s: CalcState, steps: ((x: CalcState) => CalcState)[]) => steps.reduce((a, f) => f(a), s)
const d = (n: string) => (s: CalcState) => pressDigit(s, n)

describe('calculadora', () => {
  it('soma, subtrai, multiplica e divide', () => {
    expect(seq(CALC_START, [d('1'), d('2'), (s) => pressOp(s, '+'), d('3'), pressEquals]).display).toBe('15')
    expect(seq(CALC_START, [d('9'), (s) => pressOp(s, '-'), d('4'), pressEquals]).display).toBe('5')
    expect(seq(CALC_START, [d('6'), (s) => pressOp(s, '×'), d('7'), pressEquals]).display).toBe('42')
    expect(seq(CALC_START, [d('8'), (s) => pressOp(s, '÷'), d('4'), pressEquals]).display).toBe('2')
  })
  it('encadeia operações e evita lixo de ponto flutuante', () => {
    expect(seq(CALC_START, [d('1'), (s) => pressOp(s, '+'), d('2'), (s) => pressOp(s, '×'), d('3'), pressEquals]).display).toBe('9')
    const s = seq(CALC_START, [d('0'), pressDot, d('1'), (x) => pressOp(x, '+'), d('0'), pressDot, d('2'), pressEquals])
    expect(s.display).toBe('0.3')
    expect(showDisplay(s.display)).toBe('0,3')
  })
  it('divisão por zero dá erro e o próximo dígito recomeça', () => {
    const e = seq(CALC_START, [d('5'), (s) => pressOp(s, '÷'), d('0'), pressEquals])
    expect(e.display).toBe('Erro')
    expect(pressDigit(e, '7').display).toBe('7')
  })
  it('porcentagem, sinal e apagar', () => {
    expect(seq(CALC_START, [d('2'), d('0'), d('0'), (s) => pressOp(s, '+'), d('1'), d('0'), pressPercent, pressEquals]).display).toBe('220')
    expect(pressPercent(seq(CALC_START, [d('5'), d('0')])).display).toBe('0.5')
    expect(pressSign(seq(CALC_START, [d('5')])).display).toBe('-5')
    expect(pressBackspace(seq(CALC_START, [d('1'), d('2')])).display).toBe('1')
    expect(pressBackspace(seq(CALC_START, [d('1')])).display).toBe('0')
  })
  it('agrupa milhares no visor', () => {
    expect(showDisplay('1234567.5')).toBe('1.234.567,5')
    expect(showDisplay('-1000')).toBe('-1.000')
  })
})
