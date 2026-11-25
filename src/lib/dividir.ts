// Dividir despesas em grupo (viagem, churrasco, festa). Puro e sem tela. Valores SEMPRE em centavos inteiros.

export interface DivParticipante {
  id: string
  nome: string
  ativo: boolean
}
export interface DivDespesa {
  id: string
  descricao: string
  valor_centavos: number
  pagador_id: string
  participantes: string[]
  data: string
}
export interface DivAcerto {
  id: string
  de_id: string
  para_id: string
  valor_centavos: number
  feito_em: string
}
export interface Transferencia {
  de: string
  para: string
  valor: number
}

/** Divide em partes iguais; os centavos que sobram vão um a um para as primeiras pessoas (ordem estável). */
export function partesIguais(total: number, ids: string[]): Map<string, number> {
  const ordem = [...ids].sort()
  const base = Math.floor(total / ordem.length)
  let resto = total - base * ordem.length
  const m = new Map<string, number>()
  for (const id of ordem) {
    m.set(id, base + (resto > 0 ? 1 : 0))
    if (resto > 0) resto--
  }
  return m
}

export interface SaldoPessoa {
  id: string
  pagou: number
  devia: number
  /** pagou − devia, já considerando acertos feitos. Positivo: tem a receber. Negativo: tem a pagar. */
  saldo: number
}

/** Saldo de cada pessoa: quanto pagou, quanto deveria ter pago, e o que falta acertar (descontando pagamentos já feitos). */
export function calcularSaldos(participantes: DivParticipante[], despesas: DivDespesa[], acertos: DivAcerto[]): SaldoPessoa[] {
  const pagou = new Map<string, number>()
  const devia = new Map<string, number>()
  for (const d of despesas) {
    pagou.set(d.pagador_id, (pagou.get(d.pagador_id) ?? 0) + d.valor_centavos)
    for (const [id, v] of partesIguais(d.valor_centavos, d.participantes)) devia.set(id, (devia.get(id) ?? 0) + v)
  }
  const ajuste = new Map<string, number>()
  for (const a of acertos) {
    ajuste.set(a.de_id, (ajuste.get(a.de_id) ?? 0) + a.valor_centavos) // quem pagou a dívida fica mais perto de zero
    ajuste.set(a.para_id, (ajuste.get(a.para_id) ?? 0) - a.valor_centavos)
  }
  return participantes.map((p) => {
    const pg = pagou.get(p.id) ?? 0
    const dv = devia.get(p.id) ?? 0
    return { id: p.id, pagou: pg, devia: dv, saldo: pg - dv + (ajuste.get(p.id) ?? 0) }
  })
}

/** Menor número de transferências que zera os saldos: quem mais deve paga a quem mais tem a receber, repetidamente. */
export function sugerirTransferencias(saldos: { id: string; saldo: number }[]): Transferencia[] {
  const dev = saldos.filter((s) => s.saldo < 0).map((s) => ({ id: s.id, v: -s.saldo })).sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1))
  const cre = saldos.filter((s) => s.saldo > 0).map((s) => ({ id: s.id, v: s.saldo })).sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1))
  const out: Transferencia[] = []
  let i = 0
  let j = 0
  while (i < dev.length && j < cre.length) {
    const v = Math.min(dev[i].v, cre[j].v)
    if (v > 0) out.push({ de: dev[i].id, para: cre[j].id, valor: v })
    dev[i].v -= v
    cre[j].v -= v
    if (dev[i].v === 0) i++
    if (cre[j].v === 0) j++
  }
  return out
}

export function totalDoGrupo(despesas: DivDespesa[]): number {
  return despesas.reduce((s, d) => s + d.valor_centavos, 0)
}
