import { CATEGORIAS_PADRAO, dataComDia } from './financas'
import type { FinCategoria, FinTipo } from './financas'

// Entende uma frase falada ("hoje gastei 85 reais no supermercado") e devolve um lançamento PROPOSTO.
// Regras fixas e transparentes, sem inventar nada: a pessoa sempre confere e corrige antes de salvar.

export interface LancamentoFalado {
  tipo: FinTipo | null
  valorCentavos: number | null
  /** id da categoria sugerida (padrão ou própria) ou null. */
  categoria: string | null
  /** AAAA-MM-DD */
  data: string
  descricao: string
}

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const RECEITA = /\b(recebi|ganhei|entrou|entrada|vendi|faturei|caiu)\b/
const INVEST = /\b(invest\w*|apliquei|aplicacao|poupei|guardei|resgatei)\b/
const GASTO = /\b(gastei|paguei|comprei|gasto|despesa|pago|debito|saiu)\b/

const PALAVRAS: Record<string, string[]> = {
  'padrao:mercado': ['mercado', 'supermercado', 'feira', 'padaria', 'hortifruti', 'acougue'],
  'padrao:casa': ['casa', 'condominio', 'reforma', 'moveis'],
  'padrao:transporte': ['gasolina', 'combustivel', 'uber', 'onibus', 'metro', 'estacionamento', 'pedagio', 'transporte', 'taxi'],
  'padrao:saude': ['farmacia', 'remedio', 'medico', 'dentista', 'exame', 'plano de saude', 'saude'],
  'padrao:lazer': ['cinema', 'lazer', 'viagem', 'passeio', 'show', 'festa'],
  'padrao:fora': ['restaurante', 'lanche', 'pizza', 'ifood', 'comer fora', 'cafe', 'almoco', 'jantar', 'bar'],
  'padrao:edu': ['curso', 'faculdade', 'escola', 'livro', 'estudo'],
  'padrao:roupas': ['roupa', 'sapato', 'blusa', 'calca', 'vestido', 'loja'],
  'padrao:cuidados': ['salao', 'cabelo', 'unha', 'manicure', 'estetica', 'massagem', 'cuidados'],
  'padrao:contas': ['conta de luz', 'luz', 'agua', 'internet', 'telefone', 'celular', 'boleto', 'contas'],
  'padrao:pets': ['pet', 'cachorro', 'gato', 'veterinario', 'racao'],
  'padrao:consultorio': ['consulta', 'consultorio', 'paciente', 'atendimento'],
  'padrao:salario': ['salario', 'pagamento do mes'],
  'padrao:vendas': ['venda', 'vendas', 'vendi'],
  'padrao:freelance': ['freela', 'freelance', 'servico', 'trabalho extra'],
  'padrao:aluguel': ['aluguel'],
  'padrao:poupanca': ['poupanca'],
  'padrao:cripto': ['cripto', 'bitcoin'],
  'padrao:cdi': ['cdi'],
  'padrao:cdb': ['cdb'],
  'padrao:dolar': ['dolar'],
}
const OUTROS: Record<FinTipo, string> = { receita: 'padrao:r-outros', gasto: 'padrao:g-outros', investimento: 'padrao:poupanca' }

const NUMEROS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600,
  setecentos: 700, oitocentos: 800, novecentos: 900,
}

/** "cento e vinte", "mil e quinhentos", "dois mil" -> número (inteiros de 1 a 999.999). */
function porExtenso(t: string): number | null {
  const toks = t.split(/\s+/).filter((x) => x && x !== 'e')
  let total = 0
  let atual = 0
  let achou = false
  for (const w of toks) {
    if (w === 'mil') {
      total += (atual || 1) * 1000
      atual = 0
      achou = true
    } else if (w in NUMEROS) {
      atual += NUMEROS[w]
      achou = true
    } else if (achou) break
  }
  total += atual
  return achou && total > 0 ? total : null
}

export function acharValor(texto: string): number | null {
  const t = sem(texto)
  // "R$ 1.234,56", "85 reais", "85,50"
  const m = t.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/)
  if (m) {
    let n = m[1]
    n = n.includes(',') ? n.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(n) ? n.replace(/\./g, '') : n
    const v = Math.round(parseFloat(n) * 100)
    // "250 reais e 50 centavos"
    const c = t.match(/reais?\s+e\s+(\d{1,2})\s+centavos?/)
    const total = v + (c && !m[1].includes(',') ? Number(c[1]) : 0)
    return total > 0 ? total : null
  }
  const ext = porExtenso(t.replace(/reais?|real|gastei|paguei|comprei|recebi|ganhei|investi/g, ' '))
  return ext ? ext * 100 : null
}

export function acharData(texto: string, hoje = new Date()): string {
  const t = sem(texto)
  const d = new Date(hoje)
  if (/\banteontem\b/.test(t)) d.setDate(d.getDate() - 2)
  else if (/\bontem\b/.test(t)) d.setDate(d.getDate() - 1)
  else {
    const m = t.match(/\bdia\s+(\d{1,2})\b/)
    if (m) return dataComDia(d.getFullYear(), d.getMonth() + 1, Number(m[1]))
  }
  return dataComDia(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function interpretarFala(texto: string, proprias: FinCategoria[] = [], hoje = new Date()): LancamentoFalado {
  const t = sem(texto)
  const tipo: FinTipo | null = INVEST.test(t) ? 'investimento' : RECEITA.test(t) ? 'receita' : GASTO.test(t) ? 'gasto' : null

  let categoria: string | null = null
  for (const c of proprias) {
    if (t.includes(sem(c.nome)) && (!tipo || c.tipo === tipo)) {
      categoria = c.id
      break
    }
  }
  if (!categoria) {
    for (const c of CATEGORIAS_PADRAO) {
      if (tipo && c.tipo !== tipo) continue
      const ws = PALAVRAS[c.id]
      if (ws?.some((w) => new RegExp(`\\b${w}\\b`).test(t))) {
        categoria = c.id
        break
      }
    }
  }
  if (!categoria && tipo) categoria = OUTROS[tipo]

  const descricao = texto
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
    .slice(0, 200)
  return { tipo, valorCentavos: acharValor(texto), categoria, data: acharData(texto, hoje), descricao }
}
