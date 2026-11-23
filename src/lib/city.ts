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
  foto: string | null
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
  tags: string[]
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

export function groupLabel(key: string): string {
  return CITY_GROUPS.find((g) => g.key === key)?.label ?? key
}

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
  if (m.includes('convite_proprio')) return 'Este convite é seu: as confirmadas aparecem na sua lista.'
  return 'Não foi possível concluir agora. Tente de novo.'
}
