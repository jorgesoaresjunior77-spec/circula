import type { GardenColor } from './profile'

export type GardenChallengeStatus = 'draft' | 'published' | 'archived'

export interface GardenChallenge {
  id: string
  community_id: string
  created_by: string
  title: string
  description: string | null
  status: GardenChallengeStatus
  duration_days: number
  starts_on: string
  enrollment_opens_at: string | null
  enrollment_closes_at: string | null
  allow_late_enrollment: boolean
  cover_image_url: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface GardenChallengeDay {
  id: string
  challenge_id: string
  day_number: number
  activity_date: string
  title: string
  instructions: string | null
  icon: string | null
  encouragement_message: string | null
  created_at: string
  updated_at: string
}

export interface GardenEnrollment {
  id: string
  challenge_id: string
  profile_id: string
  enrolled_at: string
  profile?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export interface GardenCompletion {
  id: string
  challenge_id: string
  challenge_day_id: string
  enrollment_id: string
  profile_id: string
  completed_at: string
}

/**
 * Uma entrada de "Meu histórico" (Member) — um desafio ARQUIVADO no qual
 * a própria pessoa tem pelo menos um compartilhamento. Construída 100%
 * a partir do snapshot congelado em `garden_shares` (nunca de
 * `garden_challenges`/`garden_challenge_days`, que a RLS não deixa um
 * Member comum ler quando o desafio já não está mais `published`) — ver
 * useGardenMember.fetchHistory. Por isso NÃO cobre conclusões que nunca
 * foram compartilhadas em um desafio hoje arquivado: sem uma linha de
 * `garden_shares`, não há título/duração acessível para exibir, e este
 * tipo não inventa esse dado.
 */
export interface GardenHistoryEntry {
  challengeId: string
  challengeTitle: string
  daysCompleted: number
  totalDays: number
  colorOne: GardenColor | null
  colorTwo: GardenColor | null
  lastSharedAt: string
}

/** Formato cru de uma linha de `garden_shares` usada para montar o histórico (ver buildGardenHistory). */
export interface GardenShareHistoryRow {
  challenge_id: string
  challenge_title: string
  days_completed: number
  total_days: number
  color_one: string | null
  color_two: string | null
  created_at: string
}

/**
 * Função pura (sem Supabase, sem React) — separada de
 * useGardenMember.fetchHistory só para poder testar a regra de negócio
 * isoladamente: "um desafio entra no histórico só se NÃO estiver mais
 * publicado, e só com o compartilhamento mais recente dele".
 *
 * Pré-condição do chamador: `shareRows` já vem ordenado por
 * `created_at` DESCENDENTE (mesma ordem que a query em
 * useGardenMember.fetchHistory já pede ao Supabase) — é o que garante
 * que "a primeira ocorrência de cada challenge_id" seja a mais recente.
 */
export function buildGardenHistory(
  shareRows: readonly GardenShareHistoryRow[],
  stillPublishedChallengeIds: ReadonlySet<string>,
): GardenHistoryEntry[] {
  const byChallenge = new Map<string, GardenHistoryEntry>()

  for (const row of shareRows) {
    if (stillPublishedChallengeIds.has(row.challenge_id)) continue // ainda publicado — não é "histórico"
    if (byChallenge.has(row.challenge_id)) continue // já guardamos o compartilhamento mais recente deste desafio

    byChallenge.set(row.challenge_id, {
      challengeId: row.challenge_id,
      challengeTitle: row.challenge_title,
      daysCompleted: row.days_completed,
      totalDays: row.total_days,
      colorOne: row.color_one as GardenColor | null,
      colorTwo: row.color_two as GardenColor | null,
      lastSharedAt: row.created_at,
    })
  }

  return [...byChallenge.values()]
}

/**
 * Jornada acumulada (Etapa N, "Camada 2" da roda) — soma real, sem
 * schema novo, de tudo que o cliente já consegue ler com segurança sob
 * a RLS existente (ver useGardenMember):
 *
 *  - `liveCompletions`: conclusões de desafios AINDA publicados/visíveis
 *    (api.myCompletions) — cada linha é um dia concluído, já deduplicado
 *    por natureza da tabela (um garden_completions por dia/inscrição).
 *  - `liveTotalDaysByChallenge`: total de dias de um desafio ao vivo, mas
 *    SÓ para os desafios que a participante já abriu pelo menos uma vez
 *    (api.daysByChallenge) — um desafio nunca aberto entra na contagem
 *    de dias concluídos (se houver conclusão registrada), mas não pode
 *    ser contado como "concluído" porque não sabemos o total dele ainda.
 *  - `historyEntries`: desafios ARQUIVADOS com compartilhamento (snapshot
 *    de garden_shares via buildGardenHistory) — já trazem completed/total
 *    certos, sem precisar de nova consulta.
 *
 * Limitação conhecida, registrada aqui de propósito (não escondida): um
 * desafio ARQUIVADO que a participante concluiu mas NUNCA compartilhou
 * não entra nesta soma — a RLS de garden_challenge_days não deixa um
 * Member comum reler o total de dias de um desafio que já não está mais
 * 'published', e sem esse total não dá para saber se foi concluído sem
 * inventar o dado. Corrigir isso exigiria uma nova fonte de dado
 * (ex.: persistir o total no momento da conclusão, não só do
 * compartilhamento) — fora deste ciclo, que não altera schema.
 */
export interface GardenJourneyInput {
  liveCompletions: readonly { challenge_id: string }[]
  liveTotalDaysByChallenge: Readonly<Record<string, number>>
  historyEntries: readonly { daysCompleted: number; totalDays: number }[]
}

export interface GardenJourneyStats {
  /** Dias concluídos somados (desafios publicados abertos + arquivados compartilhados). Nunca conta o mesmo dia duas vezes — ver doc de GardenJourneyInput. */
  totalDaysCompleted: number
  /** Desafios concluídos a 100% — só os que dá para confirmar com dado real (ver limitação na doc de GardenJourneyInput). */
  challengesFinished: number
}

/**
 * Função pura (sem Supabase, sem React) — mesmo padrão de
 * buildGardenHistory, para poder testar a regra de contagem isolada da
 * tela e do hook.
 */
export function computeGardenJourneyStats(input: GardenJourneyInput): GardenJourneyStats {
  const liveCompletedByChallenge = new Map<string, number>()
  for (const completion of input.liveCompletions) {
    liveCompletedByChallenge.set(
      completion.challenge_id,
      (liveCompletedByChallenge.get(completion.challenge_id) ?? 0) + 1,
    )
  }

  let totalDaysCompleted = input.liveCompletions.length
  let challengesFinished = 0

  for (const [challengeId, completedCount] of liveCompletedByChallenge) {
    const total = input.liveTotalDaysByChallenge[challengeId]
    if (total !== undefined && total > 0 && completedCount >= total) challengesFinished++
  }

  for (const entry of input.historyEntries) {
    totalDaysCompleted += entry.daysCompleted
    if (entry.totalDays > 0 && entry.daysCompleted >= entry.totalDays) challengesFinished++
  }

  return { totalDaysCompleted, challengesFinished }
}

/**
 * Único lugar que decide o texto da jornada acumulada — usado tanto no
 * rótulo acessível de GardenJourneyRing quanto no resumo visível em
 * GardenMemberView, para as duas versões nunca divergirem.
 */
export function formatGardenJourneySummary(stats: GardenJourneyStats): string {
  if (stats.totalDaysCompleted === 0 && stats.challengesFinished === 0) {
    return 'Sua jornada no Círcula está começando'
  }

  const daysPart = `${stats.totalDaysCompleted} ${stats.totalDaysCompleted === 1 ? 'dia concluído' : 'dias concluídos'}`
  if (stats.challengesFinished === 0) return `Jornada no Círcula: ${daysPart}`

  const challengesPart = `${stats.challengesFinished} ${
    stats.challengesFinished === 1 ? 'desafio concluído' : 'desafios concluídos'
  }`
  return `Jornada no Círcula: ${daysPart} · ${challengesPart}`
}

/**
 * Seis templates de conteúdo/incentivo para participantes (Etapa N,
 * Prioridade 3) — catálogo e tipos aqui (não no componente .tsx) para
 * não disparar o warning `react/only-export-components` do oxlint
 * (Fast Refresh só funciona em arquivo que exporta só componentes). Ver
 * GardenIncentiveTemplates.tsx para o componente que consome isto.
 *
 * NÃO são "os seis templates originais" de uma referência visual
 * perdida — confirmado que não existe nenhuma referência recuperável no
 * projeto (nem em docs/, nem no histórico de commits). São seis
 * categorias de TOM/USO aprovadas nesta etapa.
 */
export type GardenIncentiveTemplateKey =
  | 'motivacao'
  | 'reflexao'
  | 'conquista'
  | 'habito'
  | 'acolhimento'
  | 'celebracao'

export interface GardenIncentiveTemplateMeta {
  key: GardenIncentiveTemplateKey
  /** Nome da categoria, usado num eventual seletor. */
  label: string
  /** Texto curto mostrado no próprio card (eyebrow). */
  eyebrow: string
  emoji: string
  /** Para quem for ESCOLHER um template — quando usar este. */
  hint: string
}

export const GARDEN_INCENTIVE_TEMPLATES: readonly GardenIncentiveTemplateMeta[] = [
  {
    key: 'motivacao',
    label: 'Incentivo e motivação',
    eyebrow: 'Incentivo',
    emoji: '🌱',
    hint: 'Para abrir um novo dia ou desafio — energia de começo.',
  },
  {
    key: 'reflexao',
    label: 'Reflexão e autocuidado',
    eyebrow: 'Reflexão',
    emoji: '🕊️',
    hint: 'Um convite para pausar e sentir, sem cobrança de desempenho.',
  },
  {
    key: 'conquista',
    label: 'Pequena conquista',
    eyebrow: 'Conquista',
    emoji: '✅',
    hint: 'Reconhecer um passo concreto já dado, por menor que seja.',
  },
  {
    key: 'habito',
    label: 'Consistência e hábitos',
    eyebrow: 'Consistência',
    emoji: '🔁',
    hint: 'Valorizar a repetição, não só o resultado final.',
  },
  {
    key: 'acolhimento',
    label: 'Acolhimento e comunidade',
    eyebrow: 'Acolhimento',
    emoji: '💛',
    hint: 'Lembrar que ninguém está sozinha nesse processo.',
  },
  {
    key: 'celebracao',
    label: 'Celebração de progresso',
    eyebrow: 'Celebração',
    emoji: '✨',
    hint: 'Marcar a conclusão de uma etapa maior (um desafio inteiro, por ex.).',
  },
]

export const GARDEN_INCENTIVE_TEMPLATES_BY_KEY: Record<GardenIncentiveTemplateKey, GardenIncentiveTemplateMeta> =
  Object.fromEntries(GARDEN_INCENTIVE_TEMPLATES.map((t) => [t.key, t])) as Record<
    GardenIncentiveTemplateKey,
    GardenIncentiveTemplateMeta
  >

/**
 * Biblioteca de mensagens-modelo por categoria (Etapa Q) — sugestões
 * EDITÁVEIS para ajudar a profissional a compor a mensagem de incentivo,
 * nunca conteúdo obrigatório nem publicado automaticamente. Conteúdo
 * estático, escrito nesta etapa (sem IA/serviço externo), em português,
 * seguindo os critérios editoriais aprovados:
 *   - linguagem humana, acolhedora e natural, sem jargão de performance;
 *   - nunca afirma que uma participante fez algo específico (não há como
 *     saber isso aqui — estas mensagens são gerais, para o grupo/dia,
 *     nunca endereçadas a alguém por nome ou resultado);
 *   - nenhuma promessa de emagrecimento, pressão estética ou alegação
 *     médica; nenhum nome, resultado ou dado pessoal inventado;
 *   - cada mensagem dentro de uma categoria muda de ideia/estrutura, não
 *     só de palavras (evita variações repetitivas da mesma frase).
 * Aplicar uma sugestão só preenche o campo de texto já existente — a
 * mensagem continua 100% editável e a publicação continua exigindo o
 * botão "Publicar no feed" (ver GardenChallengeManager.tsx).
 */
export const GARDEN_INCENTIVE_MESSAGE_LIBRARY: Readonly<Record<GardenIncentiveTemplateKey, readonly string[]>> = {
  motivacao: [
    'Hoje é um novo começo. Um passo de cada vez já é o suficiente — o importante é continuar no seu ritmo. 🌱',
    'Que hoje seja mais leve do que ontem. Cada escolha de cuidado com você mesma conta, mesmo as pequenas.',
    'Respire, se organize e siga em frente. Você não precisa fazer tudo perfeito — só precisa continuar tentando.',
    'Um novo dia, uma nova chance de cuidar de você com gentileza. Vamos juntas?',
  ],
  reflexao: [
    'Antes de seguir o dia, que tal uma pausa? Como você está se sentindo agora, de verdade?',
    'Nem todo progresso aparece numa balança ou numa planilha. Como tem sido cuidar de você nos últimos dias?',
    'Hoje vale mais ouvir o seu corpo do que correr atrás de metas. O que ele está pedindo?',
    'Um momento de pausa também é cuidado. Permita-se respirar antes de continuar.',
  ],
  conquista: [
    'Chegar até aqui já é uma conquista. Reconheça o esforço que você tem colocado nesse processo.',
    'Pequenos passos constroem grandes mudanças. Se você deu um passo hoje, ele já vale a pena.',
    'Toda conquista merece ser celebrada, mesmo as que só você percebe. Continue confiando no seu processo.',
    'Olhe para trás e note o quanto você já caminhou. Isso também é motivo de orgulho.',
  ],
  habito: [
    'Consistência não é perfeição — é voltar a tentar, dia após dia. Você está construindo isso agora.',
    'O hábito se forma na repetição gentil, não na pressa. Siga no seu tempo.',
    'Nem todo dia vai ser igual, e está tudo bem. O que importa é continuar voltando para o cuidado com você.',
    'Cada repetição conta, mesmo quando parece pouco. Confie no processo, não só no resultado.',
  ],
  acolhimento: [
    'Você não está sozinha nessa jornada — toda a comunidade está caminhando junto com você.',
    'Dias difíceis também fazem parte. Se hoje foi assim, seja gentil com você mesma.',
    'Aqui é um espaço de acolhimento, sem julgamento. Vá no seu ritmo, sempre.',
    'Se precisar recomeçar hoje, recomece. Estar aqui já é um ato de cuidado.',
  ],
  celebracao: [
    'Chegamos ao fim dessa etapa! Obrigada por caminhar com tanta dedicação até aqui.',
    'Celebrar o caminho percorrido é tão importante quanto chegar ao final. Parabéns por ter chegado até aqui.',
    'Esse ciclo se encerra, mas o cuidado com você continua. Celebre cada parte dessa jornada.',
    'Que alegria fechar mais uma etapa com você! Guarde esse sentimento para os próximos desafios.',
  ],
}

/** Formulário de criação/edição do desafio (Painel · Meu Jardim). */
export interface GardenChallengeInput {
  title: string
  description: string | null
  duration_days: number
  starts_on: string
  enrollment_opens_at: string | null
  enrollment_closes_at: string | null
  allow_late_enrollment: boolean
  cover_image_url: string | null
}

/** Edição individual de um dia já gerado. */
export interface GardenChallengeDayInput {
  title: string
  instructions: string | null
  icon: string | null
  encouragement_message: string | null
  activity_date: string
}

export const GARDEN_COLORS: GardenColor[] = [
  'sage',
  'rose',
  'peach',
  'lavender',
  'sky',
  'sand',
  'terracotta',
]

export const GARDEN_COLOR_LABEL: Record<GardenColor, string> = {
  sage: 'Sálvia',
  rose: 'Rosé',
  peach: 'Pêssego',
  lavender: 'Lavanda',
  sky: 'Céu',
  sand: 'Areia',
  terracotta: 'Terracota',
}

export const GARDEN_COLOR_HEX: Record<GardenColor, string> = {
  sage: '#93a186',
  rose: '#b98f8f',
  peach: '#e0b198',
  lavender: '#b3a7c7',
  sky: '#9db3bd',
  sand: '#c9b48f',
  terracotta: '#c17b5a',
}

export type GardenResult = { error: string | null }

const GARDEN_ERROR_LABEL: Record<string, string> = {
  challenge_not_found: 'Desafio não encontrado.',
  not_authorized: 'Você não tem permissão para esta ação.',
  challenge_not_draft: 'Só é possível fazer isso enquanto o desafio está em rascunho.',
  challenge_has_no_days: 'Cadastre pelo menos um dia antes de publicar.',
  challenge_not_published: 'Este desafio ainda não foi publicado.',
  challenge_archived_is_final: 'Um desafio arquivado não pode voltar a rascunho/publicado.',
  not_authenticated: 'Sessão expirada. Entre novamente.',
  day_not_found: 'Atividade não encontrada.',
  day_not_released: 'Esta atividade ainda não foi liberada.',
  not_enrolled: 'Participe do desafio para marcar atividades.',
  message_required: 'Escreva uma mensagem antes de publicar.',
  completion_not_found: 'Conclusão não encontrada.',
  already_shared: 'Esta conclusão já foi compartilhada no feed.',
}

const GARDEN_FALLBACK_ERROR = 'Não foi possível concluir a ação agora. Tente novamente.'

/**
 * Traduz o `message` de uma exceção do Postgres (`raise exception
 * 'codigo'`) para um texto amigável. Usa correspondência por SUBSTRING
 * (`.includes`), não igualdade exata — o `message` que chega via
 * PostgREST/supabase-js não é garantido ser o código cru, sem nenhum
 * texto ao redor (mesmo cuidado já tomado por `mapError` em
 * usePostsModeration.ts para os erros de `moderate_post`).
 */
export function gardenErrorMessage(raw: string | null | undefined): string {
  if (!raw) return GARDEN_FALLBACK_ERROR
  for (const code of Object.keys(GARDEN_ERROR_LABEL)) {
    if (raw.includes(code)) return GARDEN_ERROR_LABEL[code]
  }
  return GARDEN_FALLBACK_ERROR
}
