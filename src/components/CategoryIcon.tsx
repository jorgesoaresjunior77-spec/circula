// Ícones próprios do Círcula para as categorias de "Na minha cidade": traço fino, cantos arredondados,
// mesma paleta (dourado e chocolate). O app escolhe sozinho pelo grupo e pelo nome: nada a cadastrar.

const P = {
  comida: 'M6 3v8a2 2 0 0 0 2 2v8M10 3v8a2 2 0 0 1-2 2M8 3v6M16 3c-2 1-3 3-3 6s1 4 3 4v8',
  compras: 'M5 8h14l-1 12H6L5 8Zm4 0V6a3 3 0 0 1 6 0v2',
  beleza: 'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Zm6 11 .8 2.2L21 17l-2.200.8L18 20l-.8-2.200L15 17l2.200-.8L18 14Z',
  saude: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.500A4 4 0 0 1 19 10c0 5.600-7 10-7 10Zm0-9v4m-2-2h4',
  esporte: 'M4 10v4m3-6v8m10-8v8m3-6v4M7 12h10',
  casa: 'M4 11l8-7 8 7v9H4v-9Zm6 9v-5h4v5',
  carro: 'M5 16V12l2-5h10l2 5v4M5 16h14M5 16v2h3v-2m8 0v2h3v-2M7 12h10M8 14h.01M16 14h.01',
  servicos: 'M4 8h16v11H4V8Zm5 0V6h6v2M4 13h16',
  familia: 'M4 5h7v14H4V5Zm9 0h7v14h-7V5ZM6.500 9h2M15.500 9h2',
  pets: 'M12 19c-3 0-5-1.700-5-3.500 0-2 2.500-3.500 5-3.500s5 1.500 5 3.500c0 1.800-2 3.500-5 3.500ZM6 9.500h.01M10 6.500h.01M14 6.500h.01M18 9.500h.01',
  lazer: 'M12 4v16M12 8c-3 0-5-2-5-4 3 0 5 1 5 4Zm0 4c3 0 5-2 5-4-3 0-5 1-5 4Zm0 5c-3 0-5-2-5-4 3 0 5 1 5 4Zm0 0c3 0 5-2 5-4-3 0-5 1-5 4Z',
  eventos: 'M5 20l3-10 8 8-11 2Zm9-14 1-2m3 5 2-1m-4 0h.01M11 5v.01',
  tecnologia: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm4 15h.01',
  outros: 'M12 5v14M5 12h14',
  pneu: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  ferramenta: 'M14 6a4 4 0 0 0-5 5L4 16l4 4 5-5a4 4 0 0 0 5-5l-3 2-2-2 2-3-1-1Z',
  bateria: 'M4 9h14v8H4V9Zm14 3h2v2h-2M8 11v4m-2-2h4',
  gota: 'M12 4c4 5 6 7.500 6 10.500a6 6 0 0 1-12 0C6 11.500 8 9 12 4Z',
  guincho: 'M3 15h13v3H3v-3Zm13-5h3l2 3v5h-5M8 15V7l8-3M6 18h.01M18 18h.01',
  doc: 'M7 3h7l4 4v14H7V3Zm7 0v4h4M10 12h5M10 16h5',
  seguro: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Zm-3 8 2 2 4-4',
  chave: 'M14 7a4 4 0 1 1 3 5l-1 1-2 .5-.5 2-2 .5-1 1H8l-.5-1.500 5.500-5.500A4 4 0 0 1 14 7Zm2.500-.5h.01',
} as const
type Chave = keyof typeof P

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const POR_NOME: [RegExp, Chave][] = [
  [/pneu|borracharia/, 'pneu'],
  [/bateria/, 'bateria'],
  [/guincho/, 'guincho'],
  [/despach/, 'doc'],
  [/seguro/, 'seguro'],
  [/lava|estetica automotiva|lavacao/, 'gota'],
  [/troca de oleo|oleo/, 'gota'],
  [/mecanic|auto eletrica|funilaria|centro automotivo|oficina|ar-?condicionado/, 'ferramenta'],
  [/concession|veiculo|aluguel de carro|taxi|motorista/, 'carro'],
  [/peca|acessorio/, 'chave'],
  [/academia|pilates|personal|esporte|yoga|danca|treino/, 'esporte'],
  [/restaurante|lanche|pizza|padaria|cafe|bar|acougue|doceria|sorvete|hamburg|comida|marmita/, 'comida'],
  [/salao|cabelo|unha|estetica|beleza|maquiagem|spa|massagem|sobrancelha|barbear/, 'beleza'],
  [/pet|veterin|adestra|banho e tosa/, 'pets'],
  [/jardin|plantas|paisag|floric/, 'lazer'],
]

function escolher(grupo?: string | null, nome?: string | null): Chave {
  const n = sem(nome ?? '')
  for (const [re, k] of POR_NOME) if (re.test(n)) return k
  const g = (grupo ?? 'outros') as string
  if (g === 'comer') return 'comida'
  if (g in P) return g as Chave
  return 'outros'
}

export function CategoryIcon({ grupo, nome, size = 28, tile = true }: { grupo?: string | null; nome?: string | null; size?: number; tile?: boolean }) {
  const k = escolher(grupo, nome)
  return (
    <span className={`cat-icon${tile ? ' cat-icon--tile' : ''}`} style={{ width: size * (tile ? 1.5 : 1), height: size * (tile ? 1.5 : 1) }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d={P[k]} />
      </svg>
    </span>
  )
}
