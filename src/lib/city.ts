import { normalizeWhatsAppNumber } from './phone'
// "Na minha cidade": tipos, grupos, tags e regras de texto. As categorias e
// as tags moram no banco (globais, valem para o Brasil todo); aqui ficam só
// os rótulos/ícones dos grupos e as ajudas de busca e validação.

export type CityListingType = 'lugar' | 'profissional' | 'evento' | 'convite'

export interface CityInfo {
  id: string
  estado: string
  nome: string
  ibge_id: number
  mulheres: number
  cadastros: number
}

export interface CityCategory {
  id: string
  nome: string
  nome_normalizado: string
  grupo: string
  status: 'ativa' | 'pendente' | 'unida'
  unida_a: string | null
  descricao?: string | null
  imagem?: string | null
  /** Nome de um grupo novo que a membro sugeriu junto com o pedido da categoria. */
  grupo_sugerido?: string | null
}

/** Grupo de categorias (a profissional cria e edita no Painel). */
export interface CityGroup {
  slug: string
  nome: string
  icone: string | null
  descricao: string | null
  imagem: string | null
  ordem: number
}

export interface CityTag {
  id: string
  nome: string
  tipo: 'perfil' | 'alimentacao' | 'selo' | 'pagamento'
}

export interface CityListing {
  id: string
  city_id: string
  cidade: string
  estado: string
  tipo: CityListingType
  categoria_id: string | null
  titulo: string
  descricao: string | null
  bairro: string | null
  endereco: string | null
  contato: string | null
  instagram: string | null
  faixa_preco: '$' | '$$' | '$$$' | null
  horario: string | null
  /** Horário por dia: { seg: '08:00-18:00' | 'fechado' | '24h', ... }. */
  horarios: Record<string, string> | null
  foto: string | null
  /** Logo do negócio (a "foto" acima é a fachada ou outra imagem). */
  logo?: string | null
  criado_por: string
  autora_nome: string | null
  autora_avatar: string | null
  e_proprio_negocio: boolean
  atende_toda_cidade: boolean
  status: 'ativo' | 'oculto'
  criado_em: string
  starts_at: string | null
  local_nome: string | null
  valor: string | null
  link: string | null
  atividade: string | null
  vagas: number | null
  nivel: 'iniciante' | 'todas' | null
  votos: number
  votei: boolean
  salvei: boolean
  confirmadas: number
  vou: boolean
  /** Média das estrelas (1 a 5), nº de avaliações e a nota da própria participante. */
  media: number | null
  avaliacoes: number
  minha_nota: number | null
  /** Reivindicação do negócio e destaque pago da capa. */
  reivindicado: boolean
  sou_dona: boolean
  minha_reivindicacao: 'pendente' | 'aprovada' | 'recusada' | null
  pedido_em_aberto: boolean
  destaque: boolean
  destaque_meu: 'pending' | 'active' | 'past_due' | null
  destaque_meu_id: string | null
  destaque_ate: string | null
  tags: string[]
}

export interface CityReview {
  user_id: string
  nome: string
  avatar: string | null
  nota: number
  comentario: string | null
  criado_em: string
  minha: boolean
}

export const CITY_GROUPS: { key: string; label: string; icon: string }[] = [
  { key: 'comer', label: 'Comer e beber', icon: '🍽️' },
  { key: 'compras', label: 'Compras', icon: '🛍️' },
  { key: 'beleza', label: 'Beleza e bem-estar', icon: '💅' },
  { key: 'saude', label: 'Saúde', icon: '🩺' },
  { key: 'esporte', label: 'Esporte e movimento', icon: '🏃‍♀️' },
  { key: 'casa', label: 'Casa e obras', icon: '🛠️' },
  { key: 'carros', label: 'Carros e transporte', icon: '🚗' },
  { key: 'servicos', label: 'Serviços profissionais', icon: '💼' },
  { key: 'familia', label: 'Família e educação', icon: '📚' },
  { key: 'pets', label: 'Pets', icon: '🐾' },
  { key: 'lazer', label: 'Lazer e turismo', icon: '🌳' },
  { key: 'eventos', label: 'Eventos e festas', icon: '🎉' },
  { key: 'tecnologia', label: 'Tecnologia e reparos', icon: '📱' },
  { key: 'outros', label: 'Outros', icon: '✨' },
]

export function groupLabel(key: string, groups?: CityGroup[]): string {
  const dyn = groups?.find((g) => g.slug === key)
  if (dyn) return dyn.nome
  return CITY_GROUPS.find((g) => g.key === key)?.label ?? key
}

/** Os grupos de reserva (os 14 de sempre), usados enquanto o banco não responde. */
export const FALLBACK_GROUPS: CityGroup[] = CITY_GROUPS.map((g, i) => ({ slug: g.key, nome: g.label, icone: g.icon, descricao: null, imagem: null, ordem: i + 1 }))

export const LISTING_TYPE_LABEL: Record<CityListingType, string> = {
  lugar: 'Lugar',
  profissional: 'Profissional',
  evento: 'Evento',
  convite: 'Convite',
}

export const MEETUP_ACTIVITIES: string[] = [
  'Caminhada',
  'Café',
  'Academia',
  'Corrida',
  'Yoga',
  'Pilates',
  'Dança',
  'Trilha',
  'Feira',
  'Passeio',
  'Cinema',
  'Jogo de cartas',
  'Artesanato',
  'Clube de leitura',
  'Passeio com pets',
  'Passeio com crianças',
]

export const PRICE_RANGES = ['$', '$$', '$$$'] as const

export const MEETUP_SAFETY_NOTE = 'Combine sempre em locais públicos e avise alguém de confiança.'
export const RECOMMENDATION_NOTE = 'As indicações são de membros do Círculo e não substituem avaliação profissional.'
export const HEALTH_NOTE = 'Não há promessa de resultado. Procure sempre um profissional habilitado.'

/** Mesma regra do banco (city_normalize): sem acento, sem pontuação, sem plural. */
export function cityNormalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/(\w{3,})s(\s|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/** Categoria igual ou parecida (maiúsculas, acentos, plural e erro de 1 letra em nomes longos). */
export function findSimilarCategory(name: string, categories: CityCategory[]): CityCategory | null {
  const n = cityNormalize(name)
  if (n.length < 3) return null
  const live = categories.filter((c) => c.status !== 'unida')
  const exact = live.find((c) => c.nome_normalizado === n)
  if (exact) return exact
  if (n.length >= 6) {
    const near = live.find((c) => Math.abs(c.nome_normalizado.length - n.length) <= 1 && editDistance(c.nome_normalizado, n) <= 1)
    if (near) return near
  }
  return null
}

/** Cadastro parecido na cidade (mesmo título, ignorando acento, plural e maiúsculas). */
export function findSimilarListing(title: string, tipo: CityListingType, listings: CityListing[]): CityListing | null {
  const n = cityNormalize(title)
  if (n.length < 3) return null
  return listings.find((l) => l.tipo === tipo && cityNormalize(l.titulo) === n) ?? null
}

// Em Saúde: nada de promessa de cura, "antes e depois" ou preço de procedimento.
const HEALTH_FORBIDDEN = /\b(cura|curamos|curar|garantimos|garantido|garantida|garantia)\b|antes e depois|r\$/i
export function healthTextProblem(text: string): string | null {
  const t = text.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return HEALTH_FORBIDDEN.test(t)
    ? 'Em Saúde não pode ter promessa de cura, "antes e depois" nem preço de procedimento. Pode reescrever?'
    : null
}

/** Destaque da capa de um negócio: R$ 4,90 por mês; 6 meses com 16% e 12 meses com 33% de desconto (espelha o servidor). */
export const HIGHLIGHT_MONTHLY_CENTS = 490
export type HighlightCycle = 'monthly' | 'semiannual' | 'annual'
export const HIGHLIGHT_CYCLE_LABEL: Record<HighlightCycle, string> = { monthly: 'Mensal', semiannual: 'Semestral', annual: 'Anual' }
export const HIGHLIGHT_CYCLE_MONTHS: Record<HighlightCycle, number> = { monthly: 1, semiannual: 6, annual: 12 }
export function highlightPriceCents(cycle: HighlightCycle): number {
  const dime = (c: number) => Math.round(c / 10) * 10
  if (cycle === 'monthly') return HIGHLIGHT_MONTHLY_CENTS
  return cycle === 'semiannual' ? dime(HIGHLIGHT_MONTHLY_CENTS * 6 * 0.84) : dime(HIGHLIGHT_MONTHLY_CENTS * 12 * 0.67)
}

export const WEEK_DAYS: { key: string; label: string; short: string }[] = [
  { key: 'seg', label: 'Segunda-feira', short: 'Seg' },
  { key: 'ter', label: 'Terça-feira', short: 'Ter' },
  { key: 'qua', label: 'Quarta-feira', short: 'Qua' },
  { key: 'qui', label: 'Quinta-feira', short: 'Qui' },
  { key: 'sex', label: 'Sexta-feira', short: 'Sex' },
  { key: 'sab', label: 'Sábado', short: 'Sáb' },
  { key: 'dom', label: 'Domingo', short: 'Dom' },
]

function dayText(v: string): string {
  return v === 'fechado' ? 'fechado' : v === '24h' ? '24 horas' : v.replace('-', ' às ')
}

/** "Seg a Sex 08:00 às 18:00 · Sáb 08:00 às 12:00 · Dom fechado" (dias seguidos iguais viram um trecho). */
export function hoursSummary(horarios: Record<string, string> | null | undefined): string {
  if (!horarios) return ''
  const parts: string[] = []
  let i = 0
  while (i < WEEK_DAYS.length) {
    const v = horarios[WEEK_DAYS[i].key]
    if (!v) {
      i++
      continue
    }
    let j = i
    while (j + 1 < WEEK_DAYS.length && horarios[WEEK_DAYS[j + 1].key] === v) j++
    const span = j > i ? `${WEEK_DAYS[i].short} a ${WEEK_DAYS[j].short}` : WEEK_DAYS[i].short
    parts.push(`${span} ${dayText(v)}`)
    i = j + 1
  }
  return parts.join(' · ')
}

/** Telefone com DDD: sempre começa em "( )" e vai formatando (11) 91234-5678. */
export function formatPhoneBR(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return '( ) '
  if (d.length <= 2) return `(${d}`
  const ddd = d.slice(0, 2)
  const rest = d.slice(2)
  const cut = rest.length > 8 ? 5 : 4
  return rest.length <= cut ? `(${ddd}) ${rest}` : `(${ddd}) ${rest.slice(0, cut)}-${rest.slice(cut)}`
}

/** Link do WhatsApp para falar com quem reivindicou (aceita (51) 99999-8888, 5551999998888, com espaços e traços). Sem número válido: null. */
export function claimWhatsAppUrl(raw: string): string | null {
  const number = normalizeWhatsAppNumber(raw)
  return number ? `https://wa.me/${number}` : null
}

export function phoneDigits(v: string): number {
  return v.replace(/\D/g, '').length
}

export function firstName(full: string | null | undefined): string {
  return (full ?? '').trim().split(/\s+/)[0] || 'Participante'
}

export function shareListingUrl(l: Pick<CityListing, 'titulo' | 'cidade' | 'estado'>): string {
  const text = `${l.titulo} — indicação de uma amiga do Círcula em ${l.cidade}/${l.estado}.`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function instagramHandle(raw: string | null): string | null {
  const v = (raw ?? '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '')
  return v ? v : null
}

export function formatMeetupDate(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

// ---- Municípios (base oficial do IBGE, servida em /ibge/<UF>.json) ----------
export interface IbgeCity {
  ibge_id: number
  nome: string
}

const ibgeCache = new Map<string, Promise<IbgeCity[]>>()

export function loadStateCities(uf: string): Promise<IbgeCity[]> {
  const key = uf.toUpperCase()
  let p = ibgeCache.get(key)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}ibge/${key}.json`)
      .then((r) => {
        if (!r.ok) throw new Error('ibge')
        return r.json() as Promise<[number, string][]>
      })
      .then((rows) => rows.map(([ibge_id, nome]) => ({ ibge_id, nome })))
    p.catch(() => ibgeCache.delete(key))
    ibgeCache.set(key, p)
  }
  return p
}

/** Mensagem curta para erros do banco nos cadastros. */
export function cityErrorMessage(message: string | undefined): string {
  const m = message ?? ''
  if (m.includes('conteudo_bloqueado')) return 'Este texto tem palavras que não combinam com o nosso espaço de cuidado. Pode reescrever com carinho?'
  if (m.includes('saude_texto_proibido')) return 'Em Saúde não pode ter promessa de cura, "antes e depois" nem preço de procedimento. Pode reescrever?'
  if (m.includes('sem_vagas')) return 'Este convite já está com todas as vagas preenchidas.'
  if (m.includes('ja_reivindicado')) return 'Este negócio já tem um pedido de reivindicação em andamento.'
  if (m.includes('whatsapp_invalido')) return 'Informe o WhatsApp com DDD, por exemplo (51) 99999-9999.'
  if (m.includes('avaliacao_propria')) return 'Você não pode avaliar o seu próprio cadastro.'
  if (m.includes('convite_proprio')) return 'Este convite é seu: as confirmadas aparecem na sua lista.'
  return 'Não foi possível concluir agora. Tente de novo.'
}
