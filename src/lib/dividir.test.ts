import { describe, expect, it } from 'vitest'
import { calcularSaldos, partesIguais, sugerirTransferencias } from './dividir'

const P = (id: string) => ({ id, nome: id, ativo: true })

describe('dividir', () => {
  it('partes iguais não perdem centavos', () => {
    const m = partesIguais(1000, ['a', 'b', 'c'])
    expect([...m.values()].reduce((x, y) => x + y, 0)).toBe(1000)
  })

  it('exemplo da viagem: os saldos fecham em zero e as transferências os zeram', () => {
    const ps = [P('joao'), P('maria'), P('jose'), P('pedro')]
    const todos = ps.map((p) => p.id)
    const despesas = [
      { id: '1', descricao: 'a', valor_centavos: 50000, pagador_id: 'joao', participantes: todos, data: '2026-01-01' },
      { id: '2', descricao: 'b', valor_centavos: 30000, pagador_id: 'maria', participantes: todos, data: '2026-01-01' },
      { id: '3', descricao: 'c', valor_centavos: 80000, pagador_id: 'jose', participantes: todos, data: '2026-01-01' },
      { id: '4', descricao: 'd', valor_centavos: 20000, pagador_id: 'pedro', participantes: todos, data: '2026-01-01' },
    ]
    const saldos = calcularSaldos(ps, despesas, [])
    expect(saldos.reduce((s, x) => s + x.saldo, 0)).toBe(0)
    // total 1800, cada um deve 450: joao +50, maria -150, jose +350, pedro -250
    expect(saldos.find((s) => s.id === 'joao')?.saldo).toBe(5000)
    expect(saldos.find((s) => s.id === 'maria')?.saldo).toBe(-15000)
    const t = sugerirTransferencias(saldos)
    expect(t.length).toBeLessThanOrEqual(3)
    const final = new Map(saldos.map((s) => [s.id, s.saldo]))
    for (const x of t) {
      final.set(x.de, (final.get(x.de) ?? 0) + x.valor)
      final.set(x.para, (final.get(x.para) ?? 0) - x.valor)
    }
    expect([...final.values()].every((v) => v === 0)).toBe(true)
  })

  it('um pagamento marcado como feito atualiza os saldos', () => {
    const ps = [P('a'), P('b')]
    const d = [{ id: '1', descricao: 'x', valor_centavos: 1000, pagador_id: 'a', participantes: ['a', 'b'], data: '2026-01-01' }]
    expect(sugerirTransferencias(calcularSaldos(ps, d, []))).toEqual([{ de: 'b', para: 'a', valor: 500 }])
    const acerto = [{ id: 'z', de_id: 'b', para_id: 'a', valor_centavos: 500, feito_em: '' }]
    expect(sugerirTransferencias(calcularSaldos(ps, d, acerto))).toEqual([])
  })

  it('quem não participou da despesa não deve nada', () => {
    const ps = [P('a'), P('b'), P('c')]
    const d = [{ id: '1', descricao: 'x', valor_centavos: 900, pagador_id: 'a', participantes: ['a', 'b'], data: '2026-01-01' }]
    expect(calcularSaldos(ps, d, []).find((s) => s.id === 'c')?.saldo).toBe(0)
  })
})
