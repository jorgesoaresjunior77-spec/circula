// Etapa 6 (evolução/experiência/gamificação) — Meu Jardim: desafio
// mensal (pontuação) e progressão anual. Espelha a migration preparada
// (NÃO aplicada ainda): 20261030140000_garden_monthly_annual_evolution.sql.
//
// IMPORTANTE — isto é só para EXIBIÇÃO (explicar a matriz na página do
// Meu Jardim, calcular percentuais a partir de números JÁ vindos do
// banco). Nenhuma pontuação é calculada ou concedida aqui: o servidor
// (gatilhos SECURITY DEFINER) é a única fonte da verdade — ver o
// cabeçalho da migration para a justificativa completa.
//
// Correção pós-auditoria (achado D, fuso horário) — `currentPeriodMonth`/
// `computeAnnualCycle` ANTES usavam a hora LOCAL DO NAVEGADOR
// (`getFullYear`/`getMonth`/`getUTCFullYear`), divergindo do servidor
// (que calcula `period_month` em UTC). Agora os dois usam
// `getLocalDateParts` (src/lib/timezone.ts) com o MESMO fuso padrão do
// servidor (`garden_community_timezone()` — America/Sao_Paulo, ver essa
// migration) — servidor e cliente concordam sempre sobre "qual é o mês
// corrente" e "quando o ano vira", exatamente o pedido da auditoria.

import { GARDEN_DEFAULT_TIMEZONE, getLocalDateParts } from '../lib/timezone'

export type GardenPointSource =
  | 'post'
  | 'comment'
  | 'reaction'
  | 'circle_join'
  | 'event_rsvp'
  | 'garden_day'
  | 'garden_share'
  | 'mood_checkin'

export interface GardenMonthlyActivityMeta {
  source: GardenPointSource
  label: string
  points: number
  /** `null` = sem limite diário (a própria ação já é natural 1x). */
  dailyCap: number | null
  hint: string
}

/** Matriz de pontuação — MESMOS valores da migration (fonte única de
 *  verdade é o banco; esta lista é só para a UI explicar e exibir o
 *  progresso por atividade, nunca para calcular pontos). */
export const GARDEN_MONTHLY_ACTIVITIES: readonly GardenMonthlyActivityMeta[] = [
  { source: 'post', label: 'Publicar um post', points: 5, dailyCap: 1, hint: 'Até 1 por dia.' },
  { source: 'comment', label: 'Comentar em um post', points: 2, dailyCap: 3, hint: 'Até 3 por dia.' },
  { source: 'reaction', label: 'Reagir a um post', points: 1, dailyCap: 5, hint: 'Até 5 por dia.' },
  {
    source: 'circle_join',
    label: 'Participar de um Círculo',
    points: 10,
    dailyCap: null,
    hint: 'Uma vez por Círculo.',
  },
  {
    source: 'event_rsvp',
    label: 'Confirmar presença em um evento',
    points: 8,
    dailyCap: null,
    hint: 'Uma vez por evento.',
  },
  {
    source: 'garden_day',
    label: 'Concluir um dia do Meu Jardim',
    points: 6,
    dailyCap: null,
    hint: 'Uma vez por dia do desafio.',
  },
  {
    source: 'garden_share',
    label: 'Compartilhar uma conquista do Jardim',
    points: 4,
    dailyCap: null,
    hint: 'Uma vez por conclusão compartilhada.',
  },
  {
    source: 'mood_checkin',
    label: 'Registrar o humor do dia',
    points: 3,
    dailyCap: null,
    hint: 'Uma vez por dia.',
  },
]

export const GARDEN_MONTHLY_ACTIVITY_BY_SOURCE: Record<GardenPointSource, GardenMonthlyActivityMeta> =
  Object.fromEntries(GARDEN_MONTHLY_ACTIVITIES.map((a) => [a.source, a])) as Record<
    GardenPointSource,
    GardenMonthlyActivityMeta
  >

/** Mesmo número de garden_monthly_points_goal() no banco — único lugar
 *  que define a meta do lado do cliente (só para exibição/cálculo de
 *  percentual; a CONCLUSÃO real é decidida no servidor). */
export const GARDEN_MONTHLY_GOAL = 100

export interface GardenMonthlyPointsRow {
  id: string
  profile_id: string
  community_id: string
  period_month: string // date 'YYYY-MM-01'
  source: GardenPointSource
  source_id: string
  points: number
  created_at: string
}

export interface GardenMonthlyCompletionRow {
  id: string
  profile_id: string
  community_id: string
  period_month: string
  total_points: number
  completed_at: string
}

export interface GardenMonthlyProgress {
  points: number
  goal: number
  percent: number
  remaining: number
  complete: boolean
}

export function computeMonthlyProgress(
  points: number,
  goal: number = GARDEN_MONTHLY_GOAL,
): GardenMonthlyProgress {
  const safePoints = Math.max(0, points)
  const percent = goal > 0 ? Math.min(100, Math.round((safePoints / goal) * 100)) : 0
  return {
    points: safePoints,
    goal,
    percent,
    remaining: Math.max(0, goal - safePoints),
    complete: safePoints >= goal,
  }
}

/** `YYYY-MM-01` (formato de `period_month` no banco), calculado no fuso
 *  informado (padrão: o mesmo da comunidade quando ela não tem um
 *  próprio — ver GARDEN_DEFAULT_TIMEZONE) — NUNCA na hora local do
 *  navegador. Mesma regra do servidor (`_garden_award_points`,
 *  `date_trunc('month', now() at time zone tz)`), então "o mês
 *  corrente" aqui e lá são sempre o mesmo mês, até na última hora do
 *  dia 31. */
export function currentPeriodMonth(
  now: Date = new Date(),
  timeZone: string = GARDEN_DEFAULT_TIMEZONE,
): string {
  const { year, month } = getLocalDateParts(now, timeZone)
  return `${year}-${String(month).padStart(2, '0')}-01`
}

export interface AnnualCycleBounds {
  /** `YYYY-MM-DD` — 1o de janeiro do ciclo, no fuso usado para calcular. */
  cycleStart: string
  /** `YYYY-MM-DD` — 31 de dezembro do ciclo. */
  cycleEnd: string
  /** Ano do ciclo (2027, 2028, ...) — label amigável. */
  year: number
}

/** Espelho em TS de garden_annual_cycle_bounds(timestamptz, text) — mesma
 *  regra especial de início: `null` para qualquer `at` anterior a
 *  2027-01-01 00:00 LOCAL (no fuso informado) — nenhum progresso anual
 *  retroativo em 2026. Calculado no mesmo fuso que o servidor (ver
 *  `currentPeriodMonth`) — nunca na hora local do navegador. Só para
 *  EXIBIÇÃO (decidir o que mostrar/pedir no cliente) — a contagem real
 *  de meses concluídos sempre vem do banco. */
export function computeAnnualCycle(
  at: Date = new Date(),
  timeZone: string = GARDEN_DEFAULT_TIMEZONE,
): AnnualCycleBounds | null {
  const { year } = getLocalDateParts(at, timeZone)
  if (year < 2027) return null

  return {
    cycleStart: `${year}-01-01`,
    cycleEnd: `${year}-12-31`,
    year,
  }
}

export const ANNUAL_CYCLE_MONTH_COUNT = 12

/** Dado o ciclo anual corrente e as linhas de garden_monthly_completions
 *  já carregadas (qualquer período — o filtro é feito aqui), devolve um
 *  array de 12 booleans (jan..dez) dizendo quais meses do ciclo já
 *  foram concluídos. Pura — sem Supabase, sem React, testável isolada. */
export function computeAnnualMonthsLit(
  cycle: AnnualCycleBounds,
  completions: readonly { period_month: string }[],
): boolean[] {
  const litMonths = new Set(
    completions
      .filter((c) => {
        const d = new Date(`${c.period_month}T00:00:00Z`)
        return d.getUTCFullYear() === cycle.year
      })
      .map((c) => new Date(`${c.period_month}T00:00:00Z`).getUTCMonth()),
  )
  return Array.from({ length: ANNUAL_CYCLE_MONTH_COUNT }, (_, month) => litMonths.has(month))
}
