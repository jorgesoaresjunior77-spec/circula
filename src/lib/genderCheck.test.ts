import { describe, expect, it } from 'vitest'
import { genderHint } from './genderCheck'
import { memberTrialDays } from './trialRule'
import { formatPct, growthPct, parseDaily, parseLast } from './quotes'

describe('genderHint (Círcula só para mulheres)', () => {
  it('nome masculino é recusado, com ou sem acento', () => {
    expect(genderHint('João Silva')).toBe('male')
    expect(genderHint('  josé')).toBe('male')
  })
  it('nome feminino passa', () => {
    expect(genderHint('Maria Clara', 'maria@x.com')).toBeNull()
    expect(genderHint('Andréa', 'a@x.com')).toBeNull()
    expect(genderHint('Luana')).toBeNull()
  })
  it('nome dos dois vai para revisão', () => {
    expect(genderHint('Ariel Souza')).toBe('ambiguous')
  })
  it('nome fora da lista com e-mail masculino vai para revisão (não recusa)', () => {
    expect(genderHint('Ana', 'carlos.souza@x.com')).toBe('ambiguous')
  })
})

describe('memberTrialDays', () => {
  it('21 dias até 31/12/2026 23:59:59 (Brasília) e 7 dias depois', () => {
    expect(memberTrialDays(new Date('2026-12-31T23:59:59-03:00'))).toBe(21)
    expect(memberTrialDays(new Date('2027-01-01T00:00:00-03:00'))).toBe(7)
  })
})

describe('cotações', () => {
  it('lê a resposta de /last e ignora o que falta', () => {
    const q = parseLast({ USDBRL: { bid: '5.65', pctChange: '0.02', timestamp: '1795767303' }, BTCBRL: { bid: 'x' } })
    expect(q).toEqual([{ code: 'USD', bid: 5.65, pctChange: 0.02, at: 1795767303000 }])
  })
  it('ordena o histórico do mais antigo ao mais novo e calcula o crescimento', () => {
    const pts = parseDaily([
      { bid: '11', timestamp: '200' },
      { bid: '10', timestamp: '100' },
    ])
    expect(pts.map((p) => p.bid)).toEqual([10, 11])
    expect(growthPct(pts)).toBeCloseTo(10)
    expect(formatPct(-2.426)).toBe('−2,43%')
  })
})
