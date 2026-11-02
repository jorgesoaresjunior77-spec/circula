import { describe, it, expect } from 'vitest'
import {
  computeMonthlyProgress,
  computeAnnualCycle,
  computeAnnualMonthsLit,
  currentPeriodMonth,
  GARDEN_MONTHLY_GOAL,
} from './gardenEvolution'

// Todos os testes abaixo usam instantes em UTC explícito (`...Z`) e
// comparam contra o resultado esperado NO FUSO OFICIAL
// (America/Sao_Paulo, UTC-3, sem horário de verão desde 2019) — nunca
// dependem do fuso do computador que roda o teste. Isso é o próprio
// propósito da correção pós-auditoria (achado D): antes,
// `currentPeriodMonth`/`computeAnnualCycle` liam a hora LOCAL DO
// NAVEGADOR; agora leem sempre o mesmo fuso que o servidor usa.

describe('computeMonthlyProgress', () => {
  it('calcula percentual, faltante e conclusão corretamente', () => {
    expect(computeMonthlyProgress(0, 100)).toEqual({
      points: 0,
      goal: 100,
      percent: 0,
      remaining: 100,
      complete: false,
    })
    expect(computeMonthlyProgress(37, 100)).toEqual({
      points: 37,
      goal: 100,
      percent: 37,
      remaining: 63,
      complete: false,
    })
    expect(computeMonthlyProgress(100, 100)).toEqual({
      points: 100,
      goal: 100,
      percent: 100,
      remaining: 0,
      complete: true,
    })
  })

  it('nunca ultrapassa 100% mesmo com pontos acima da meta', () => {
    const result = computeMonthlyProgress(250, 100)
    expect(result.percent).toBe(100)
    expect(result.remaining).toBe(0)
    expect(result.complete).toBe(true)
  })

  it('nunca fica negativo com pontos negativos (defensivo)', () => {
    const result = computeMonthlyProgress(-5, 100)
    expect(result.points).toBe(0)
    expect(result.percent).toBe(0)
  })

  it('usa GARDEN_MONTHLY_GOAL (100) como meta padrão', () => {
    expect(computeMonthlyProgress(50).goal).toBe(GARDEN_MONTHLY_GOAL)
  })
})

describe('currentPeriodMonth — fuso oficial (America/Sao_Paulo), nunca a hora local do navegador', () => {
  it('formata como YYYY-MM-01, no meio do mês (sem risco de virada)', () => {
    // 2026-11-15T18:00:00Z = 2026-11-15T15:00:00-03:00 — mesmo dia dos dois lados.
    expect(currentPeriodMonth(new Date('2026-11-15T18:00:00Z'))).toBe('2026-11-01')
  })

  it('correção pós-auditoria — virada de mês acontece no horário OFICIAL, não em UTC', () => {
    // 2026-11-01T01:30:00Z = 2026-10-31T22:30:00-03:00 — em UTC já é
    // novembro, mas no fuso oficial AINDA é outubro. A versão antiga
    // (hora local do navegador OU UTC cru) poderia errar esse caso
    // dependendo de onde o navegador estivesse.
    expect(currentPeriodMonth(new Date('2026-11-01T01:30:00Z'))).toBe('2026-10-01')
    // 20 minutos depois, 2026-11-01T03:00:00Z = 2026-11-01T00:00:00-03:00
    // — aí sim é novembro no fuso oficial.
    expect(currentPeriodMonth(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11-01')
  })

  it('aceita um fuso explícito diferente do padrão (arquitetura pronta para fuso por comunidade)', () => {
    // Mesmo instante do teste anterior, mas em UTC puro: já é novembro.
    expect(currentPeriodMonth(new Date('2026-11-01T01:30:00Z'), 'UTC')).toBe('2026-11-01')
  })
})

describe('computeAnnualCycle — regra especial de início em 01/01/2027, no fuso oficial', () => {
  it('retorna null para qualquer data em 2026 — nenhum progresso anual retroativo', () => {
    expect(computeAnnualCycle(new Date('2026-01-01T00:00:00Z'))).toBeNull()
    expect(computeAnnualCycle(new Date('2026-12-31T23:59:59Z'))).toBeNull()
    expect(computeAnnualCycle(new Date('2026-10-30T12:00:00Z'))).toBeNull()
  })

  it('correção pós-auditoria — a virada do ano respeita o fuso oficial, não UTC cru', () => {
    // 2027-01-01T01:00:00Z = 2026-12-31T22:00:00-03:00 — em UTC já é
    // 2027, mas no fuso oficial ainda é 31/12/2026: o ciclo NÃO pode
    // começar aqui (era exatamente o bug relatado na auditoria).
    expect(computeAnnualCycle(new Date('2027-01-01T01:00:00Z'))).toBeNull()

    // 2027-01-01T03:00:00Z = 2027-01-01T00:00:00-03:00 — meia-noite
    // oficial de 1o de janeiro: o primeiro ciclo começa exatamente aqui.
    const atOfficialMidnight = computeAnnualCycle(new Date('2027-01-01T03:00:00Z'))
    expect(atOfficialMidnight).not.toBeNull()
    expect(atOfficialMidnight!.year).toBe(2027)

    // Um segundo antes da meia-noite oficial: ainda não começou.
    const oneSecondBefore = computeAnnualCycle(new Date('2027-01-01T02:59:59Z'))
    expect(oneSecondBefore).toBeNull()
  })

  it('o primeiro ciclo cobre o ano civil inteiro (01/01 a 31/12) no fuso oficial', () => {
    const cycle = computeAnnualCycle(new Date('2027-06-15T12:00:00Z'))
    expect(cycle).not.toBeNull()
    expect(cycle!.cycleStart).toBe('2027-01-01')
    expect(cycle!.cycleEnd).toBe('2027-12-31')
  })

  it('o segundo ciclo (2028) é um ano civil inteiro, sem depender de ajuste manual', () => {
    const cycle = computeAnnualCycle(new Date('2028-03-01T12:00:00Z'))
    expect(cycle).not.toBeNull()
    expect(cycle!.year).toBe(2028)
    expect(cycle!.cycleStart).toBe('2028-01-01')
    expect(cycle!.cycleEnd).toBe('2028-12-31')
  })

  it('aceita um fuso explícito diferente do padrão (arquitetura pronta para fuso por comunidade)', () => {
    // Mesmo instante do teste de virada acima, mas em UTC puro: o ciclo
    // já teria começado (ilustra por que a escolha de fuso importa).
    const cycle = computeAnnualCycle(new Date('2027-01-01T01:00:00Z'), 'UTC')
    expect(cycle).not.toBeNull()
    expect(cycle!.year).toBe(2027)
  })
})

describe('computeAnnualMonthsLit', () => {
  it('acende só os meses do ciclo com uma conclusão real, nunca inventa progresso', () => {
    const cycle = computeAnnualCycle(new Date('2027-06-15T12:00:00Z'))!
    const lit = computeAnnualMonthsLit(cycle, [
      { period_month: '2027-01-01' },
      { period_month: '2027-03-01' },
    ])
    expect(lit).toEqual([
      true, false, true, false, false, false,
      false, false, false, false, false, false,
    ])
  })

  it('ignora conclusões de fora do ciclo (ano diferente)', () => {
    const cycle = computeAnnualCycle(new Date('2027-06-15T12:00:00Z'))!
    const lit = computeAnnualMonthsLit(cycle, [{ period_month: '2028-01-01' }])
    expect(lit.every((month) => month === false)).toBe(true)
  })

  it('sem nenhuma conclusão, todos os 12 meses ficam apagados', () => {
    const cycle = computeAnnualCycle(new Date('2027-06-15T12:00:00Z'))!
    const lit = computeAnnualMonthsLit(cycle, [])
    expect(lit).toHaveLength(12)
    expect(lit.every((month) => month === false)).toBe(true)
  })
})
