// Finanças: regras e cálculos (puros, sem tela). Valores SEMPRE em centavos inteiros.
// O módulo só registra e mostra números: nada de recomendar onde investir nem de prometer rendimento.

export type FinTipo = 'receita' | 'gasto' | 'investimento'
export type FinMovimento = 'aplicar' | 'resgatar'

export interface FinLancamento {
  id: string
  tipo: FinTipo
  categoria: string
  valor_centavos: number
  /** AAAA-MM-DD (data completa, nunca só o dia). */
  data: string
  observacao: string | null
  movimento: FinMovimento | null
  parcela_grupo: string | null
  parcela_n: number | null
  parcela_total: number | null
}

export interface FinCategoria {
  id: string
  tipo: FinTipo
  nome: string
  icone: string
  padrao: boolean
}

const padrao = (tipo: FinTipo, slug: string, nome: string, icone: string): FinCategoria => ({ id: `padrao:${slug}`, tipo, nome, icone, padrao: true })

export const CATEGORIAS_PADRAO: FinCategoria[] = [
  padrao('receita', 'salario', 'Salário', 'salario'),
  padrao('receita', 'consultorio', 'Consultório', 'consultorio'),
  padrao('receita', 'vendas', 'Vendas', 'vendas'),
  padrao('receita', 'freelance', 'Freelance', 'freelance'),
  padrao('receita', 'aluguel', 'Aluguel', 'aluguel'),
  padrao('receita', 'r-outros', 'Outros', 'estrela'),
  padrao('gasto', 'mercado', 'Mercado', 'mercado'),
  padrao('gasto', 'casa', 'Casa', 'casa'),
  padrao('gasto', 'transporte', 'Transporte', 'transporte'),
  padrao('gasto', 'saude', 'Saúde', 'saude'),
  padrao('gasto', 'lazer', 'Lazer', 'lazer'),
  padrao('gasto', 'fora', 'Comer fora', 'fora'),
  padrao('gasto', 'edu', 'Estudos', 'edu'),
  padrao('gasto', 'roupas', 'Roupas', 'roupas'),
  padrao('gasto', 'cuidados', 'Cuidados', 'cuidados'),
  padrao('gasto', 'contas', 'Contas', 'contas'),
  padrao('gasto', 'pets', 'Pets', 'pets'),
  padrao('gasto', 'g-outros', 'Outros', 'estrela'),
  padrao('investimento', 'poupanca', 'Poupança', 'poupanca'),
  padrao('investimento', 'cripto', 'Cripto', 'cripto'),
  padrao('investimento', 'cdi', 'CDI', 'cdi'),
  padrao('investimento', 'cdb', 'CDB', 'cdb'),
  padrao('investimento', 'dolar', 'Dólar', 'dolar'),
]

// ---- dinheiro ------------------------------------------------------------

/** "1.234,56" -> 123456. Aceita "12", "12,5" e "1234.56". Devolve null se não for um valor maior que zero. */
export function parseBrl(input: string): number | null {
  let s = input.replace(/[^\d.,]/g, '')
  if (!s) return null
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/\.\d{1,2}$/.test(s) && (s.match(/\./g) ?? []).length === 1) {
    // "1234.56" (ponto como decimal)
  } else {
    s = s.replace(/\./g, '')
  }
  const [inteiro, frac = ''] = s.split('.')
  if (!/^\d+$/.test(inteiro) || frac.length > 2 || (frac && !/^\d+$/.test(frac))) return null
  const centavos = Number(inteiro) * 100 + Number(frac.padEnd(2, '0') || '0')
  return Number.isSafeInteger(centavos) && centavos > 0 ? centavos : null
}

export function formatBrl(centavos: number): string {
  const sinal = centavos < 0 ? '-' : ''
  const abs = Math.abs(Math.round(centavos))
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sinal}R$ ${reais},${String(abs % 100).padStart(2, '0')}`
}

/** Divide em centavos inteiros; a última parcela absorve a diferença (R$ 1.000,00 em 3x = 333,33 + 333,33 + 333,34). */
export function dividirParcelas(totalCentavos: number, n: number): number[] {
  const base = Math.floor(totalCentavos / n)
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? totalCentavos - base * (n - 1) : base))
}

// ---- datas ---------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0')

export function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate()
}

/** Data AAAA-MM-DD; se o dia não existe no mês, usa o último dia (31 em novembro vira 30). */
export function dataComDia(ano: number, mes: number, dia: number): string {
  return `${ano}-${pad(mes)}-${pad(Math.min(Math.max(dia, 1), diasNoMes(ano, mes)))}`
}

export function chaveMes(data: string): string {
  return data.slice(0, 7)
}

export function chaveAtual(hoje = new Date()): string {
  return `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}`
}

export function somarMeses(chave: string, n: number): string {
  const [a, m] = chave.split('-').map(Number)
  const t = a * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export function nomeMes(chave: string): string {
  const [a, m] = chave.split('-').map(Number)
  return `${MESES[m - 1]} ${a}`
}
export function nomeMesCurto(chave: string): string {
  return MESES[Number(chave.split('-')[1]) - 1].slice(0, 3)
}

/** Dia padrão do formulário: hoje, se o mês exibido é o atual; senão, dia 1. */
export function diaPadrao(chave: string, hoje = new Date()): number {
  return chave === chaveAtual(hoje) ? hoje.getDate() : 1
}

/** Datas das parcelas: o dia se repete todo mês, com o mesmo ajuste (31 = 30 em novembro, 28 em fevereiro). */
export function datasDasParcelas(chaveInicial: string, dia: number, n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const [a, m] = somarMeses(chaveInicial, i).split('-').map(Number)
    return dataComDia(a, m, dia)
  })
}

// ---- resumo --------------------------------------------------------------

export interface ResumoMes {
  receitas: number
  gastos: number
  investido: number
  sobrou: number
  /** receitas − gastos < 0 (investir não conta como dívida). */
  devendo: boolean
}

export function resumoDoMes(lancs: FinLancamento[], chave: string): ResumoMes {
  let receitas = 0
  let gastos = 0
  let investido = 0
  for (const l of lancs) {
    if (chaveMes(l.data) !== chave) continue
    if (l.tipo === 'receita') receitas += l.valor_centavos
    else if (l.tipo === 'gasto') gastos += l.valor_centavos
    else investido += l.movimento === 'resgatar' ? -l.valor_centavos : l.valor_centavos
  }
  return { receitas, gastos, investido, sobrou: receitas - gastos - investido, devendo: receitas - gastos < 0 }
}

/** Total do mês por categoria, para o tipo pedido. */
export function totaisPorCategoria(lancs: FinLancamento[], chave: string, tipo: FinTipo): Map<string, number> {
  const map = new Map<string, number>()
  for (const l of lancs) {
    if (l.tipo !== tipo || chaveMes(l.data) !== chave) continue
    map.set(l.categoria, (map.get(l.categoria) ?? 0) + l.valor_centavos)
  }
  return map
}

/** Saldo acumulado de cada categoria de investimento, de TODOS os meses (aplicações − resgates). */
export function acumuladoInvestido(lancs: FinLancamento[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const l of lancs) {
    if (l.tipo !== 'investimento') continue
    map.set(l.categoria, (map.get(l.categoria) ?? 0) + (l.movimento === 'resgatar' ? -l.valor_centavos : l.valor_centavos))
  }
  return map
}

export interface PontoHistorico {
  chave: string
  receitas: number
  gastos: number
  saldo: number
}

/** Os últimos `n` meses terminando em `fim` (inclusive). */
export function historico(lancs: FinLancamento[], fim: string, n: number): PontoHistorico[] {
  return Array.from({ length: n }, (_, i) => {
    const chave = somarMeses(fim, i - (n - 1))
    const r = resumoDoMes(lancs, chave)
    return { chave, receitas: r.receitas, gastos: r.gastos, saldo: r.receitas - r.gastos }
  })
}

/** Dia mais recente primeiro. */
export function ordenarPorDia(lancs: FinLancamento[]): FinLancamento[] {
  return [...lancs].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : a.id < b.id ? 1 : -1))
}

/** "Parcelas nos próximos meses": soma das parcelas já lançadas dos próximos `n` meses. */
export function parcelasFuturas(lancs: FinLancamento[], chave: string, n = 4): number {
  let total = 0
  for (let i = 1; i <= n; i++) {
    const k = somarMeses(chave, i)
    for (const l of lancs) if (l.parcela_grupo && l.tipo === 'gasto' && chaveMes(l.data) === k) total += l.valor_centavos
  }
  return total
}

// ---- robô ----------------------------------------------------------------

export type RoboFinEstado = 'repouso' | 'repouso-devendo' | 'feliz' | 'triste' | 'devendo'

/** Prioridade quando mais de uma regra vale: devendo > triste > feliz. */
export function reacaoDoLancamento(tipo: FinTipo, movimento: FinMovimento | null, devendoDepois: boolean): RoboFinEstado | null {
  if (tipo === 'gasto') return devendoDepois ? 'devendo' : 'triste'
  if (tipo === 'receita') return 'feliz'
  if (tipo === 'investimento' && movimento === 'aplicar') return 'feliz'
  return null // resgatar: sem reação especial
}

export const FALAS: Record<RoboFinEstado, string> = {
  repouso: 'Tudo anotado! Pode lançar mais quando quiser.',
  'repouso-devendo': 'Este mês os gastos passaram das receitas. Vamos olhar com calma, sem pressa.',
  feliz: 'Entrou dinheiro! Que alegria!',
  triste: 'Mais uma conta... tudo bem, a gente organiza.',
  devendo: 'Ops! Agora os gastos passaram das receitas. Vamos dar um jeito juntas?',
}
export const FALA_INVESTIU = 'Investindo no seu futuro. Que orgulho!'
export const FALA_VAZIO = 'Oi! Vamos começar? Toque em Receitas, Gastos ou Investir para anotar o primeiro lançamento.'
