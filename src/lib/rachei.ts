// Rachei $: calculadora de racha (puro, sem tela). Valores SEMPRE em centavos inteiros.
import { partesIguais } from './dividir'

export interface RachaPessoa {
  id: string
  nome: string
}
export interface RachaParte {
  id: string
  nome: string
  valor: number
}
export interface RachaTransferencia {
  de: string
  para: string
  valor: number
}
export interface RachaResultado {
  /** Conta + gorjeta, em centavos. */
  total: number
  partes: RachaParte[]
  /** Só quando alguém pagou a conta toda: quanto cada outra pessoa passa a ela. */
  transferencias: RachaTransferencia[]
}

/** Soma a gorjeta (ou taxa de serviço, em %) ao valor, arredondando ao centavo. */
export function comGorjeta(centavos: number, pct: number): number {
  if (!Number.isFinite(centavos) || centavos <= 0) return 0
  const p = Number.isFinite(pct) && pct > 0 ? pct : 0
  return Math.round(centavos * (1 + p / 100))
}

/** Divide a conta em partes iguais; os centavos que sobram vão um a um para as primeiras pessoas. */
export function calcularRacha(contaCentavos: number, gorjetaPct: number, pessoas: RachaPessoa[], pagadorId: string | null = null): RachaResultado {
  const total = comGorjeta(contaCentavos, gorjetaPct)
  if (total <= 0 || pessoas.length === 0) return { total, partes: pessoas.map((p) => ({ ...p, valor: 0 })), transferencias: [] }
  const divisao = partesIguais(total, pessoas.map((p) => p.id))
  const partes = pessoas.map((p) => ({ id: p.id, nome: p.nome, valor: divisao.get(p.id) ?? 0 }))
  const transferencias: RachaTransferencia[] =
    pagadorId && pessoas.some((p) => p.id === pagadorId)
      ? partes.filter((p) => p.id !== pagadorId && p.valor > 0).map((p) => ({ de: p.id, para: pagadorId, valor: p.valor }))
      : []
  return { total, partes, transferencias }
}
