import { describe, expect, it } from 'vitest'
import {
  acumuladoInvestido,
  datasDasParcelas,
  dataComDia,
  dividirParcelas,
  formatBrl,
  historico,
  parcelasFuturas,
  parseBrl,
  reacaoDoLancamento,
  resumoDoMes,
  somarMeses,
} from './financas'
import type { FinLancamento } from './financas'

const l = (p: Partial<FinLancamento>): FinLancamento => ({
  id: Math.random().toString(),
  tipo: 'gasto',
  categoria: 'padrao:mercado',
  valor_centavos: 1000,
  data: '2026-11-10',
  observacao: null,
  movimento: null,
  parcela_grupo: null,
  parcela_n: null,
  parcela_total: null,
  ...p,
})

describe('dinheiro', () => {
  it('lê valores em reais e guarda em centavos', () => {
    expect(parseBrl('1.234,56')).toBe(123456)
    expect(parseBrl('12')).toBe(1200)
    expect(parseBrl('12,5')).toBe(1250)
    expect(parseBrl('1234.56')).toBe(123456)
    expect(parseBrl('0')).toBeNull()
    expect(parseBrl('abc')).toBeNull()
    expect(parseBrl('1,234')).toBeNull()
  })
  it('mostra em pt-BR', () => {
    expect(formatBrl(123456)).toBe('R$ 1.234,56')
    expect(formatBrl(-5)).toBe('-R$ 0,05')
  })
  it('a última parcela absorve a diferença', () => {
    expect(dividirParcelas(100000, 3)).toEqual([33333, 33333, 33334])
    expect(dividirParcelas(100000, 3).reduce((a, b) => a + b, 0)).toBe(100000)
  })
})

describe('datas', () => {
  it('dia que não existe usa o último dia do mês', () => {
    expect(dataComDia(2026, 11, 31)).toBe('2026-11-30')
    expect(dataComDia(2027, 2, 31)).toBe('2027-02-28')
    expect(dataComDia(2028, 2, 31)).toBe('2028-02-29')
  })
  it('as parcelas repetem o dia com o mesmo ajuste', () => {
    expect(datasDasParcelas('2026-11', 31, 4)).toEqual(['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28'])
  })
  it('soma meses atravessando o ano', () => {
    expect(somarMeses('2026-11', 3)).toBe('2027-02')
    expect(somarMeses('2026-01', -1)).toBe('2025-12')
  })
})

describe('resumo e regras', () => {
  const lancs = [
    l({ tipo: 'receita', categoria: 'padrao:salario', valor_centavos: 500000 }),
    l({ valor_centavos: 200000 }),
    l({ tipo: 'investimento', categoria: 'padrao:cdb', movimento: 'aplicar', valor_centavos: 100000 }),
    l({ tipo: 'investimento', categoria: 'padrao:cdb', movimento: 'resgatar', valor_centavos: 30000, data: '2026-12-02' }),
  ]
  it('sobrou = receitas − gastos − investido', () => {
    const r = resumoDoMes(lancs, '2026-11')
    expect(r).toMatchObject({ receitas: 500000, gastos: 200000, investido: 100000, sobrou: 200000, devendo: false })
  })
  it('devendo só olha receitas − gastos (investir não é dívida)', () => {
    expect(resumoDoMes([l({ tipo: 'receita', valor_centavos: 1000 }), l({ tipo: 'investimento', movimento: 'aplicar', valor_centavos: 5000 })], '2026-11').devendo).toBe(false)
    expect(resumoDoMes([l({ tipo: 'receita', valor_centavos: 1000 }), l({ valor_centavos: 1001 })], '2026-11').devendo).toBe(true)
  })
  it('o acumulado soma todos os meses (aplicações − resgates)', () => {
    expect(acumuladoInvestido(lancs).get('padrao:cdb')).toBe(70000)
  })
  it('histórico traz os últimos meses', () => {
    const h = historico(lancs, '2026-12', 6)
    expect(h).toHaveLength(6)
    expect(h[4]).toMatchObject({ chave: '2026-11', receitas: 500000, gastos: 200000, saldo: 300000 })
  })
  it('soma as parcelas dos próximos meses', () => {
    const g = 'g1'
    const p = [l({ parcela_grupo: g, data: '2026-12-10', valor_centavos: 3000 }), l({ parcela_grupo: g, data: '2027-01-10', valor_centavos: 3000 }), l({ parcela_grupo: g, data: '2027-06-10', valor_centavos: 3000 })]
    expect(parcelasFuturas(p, '2026-11', 4)).toBe(6000)
  })
})

describe('reação do robô', () => {
  it('devendo vence triste, que vence feliz; resgatar não reage', () => {
    expect(reacaoDoLancamento('gasto', null, true)).toBe('devendo')
    expect(reacaoDoLancamento('gasto', null, false)).toBe('triste')
    expect(reacaoDoLancamento('receita', null, false)).toBe('feliz')
    expect(reacaoDoLancamento('investimento', 'aplicar', false)).toBe('feliz')
    expect(reacaoDoLancamento('investimento', 'resgatar', false)).toBeNull()
  })
})
