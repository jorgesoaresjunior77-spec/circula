// Regras fixas da agenda de conteúdos (ditadas pela Marluce em 2026-11-18).
// Valem a partir de 01/12/2026. O calendário do Painel e os avisos do sino
// são calculados daqui: não há o que cadastrar à mão.
//
//   Evento ........ sempre no 1º domingo do mês
//   Loja .......... 1 vez por mês, dia 10
//   Receitas ...... 1 vez por semana, aos domingos
//   Revista ....... 1 vez por mês, dia 01
//   Respiração .... a cada 30 dias, no dia 15 (todo mês)
//   Playlist ...... a cada 45 dias (contando de 01/12/2026)
//   Dicas de leitura  a cada 15 dias, em segundas (de 14 em 14 dias, 1ª em 07/12/2026)
//   Wellness ...... 1 vez por mês, dia 25
//   Séries e filmes  1 vez por semana, às sextas
//   Dicas de Viagem  a cada 30 dias (contando de 01/12/2026)
//   Desafio do mês   último dia de cada mês (interage com as flores do Meu Jardim)
//
// Aviso no sino: 1 dia antes de cada publicação.

import type { ContentType, ScheduleItem } from './contentSchedule'

export const RULES_START = '2026-12-01'

type Cadence =
  | { kind: 'monthlyDay'; day: number }
  | { kind: 'firstWeekdayOfMonth'; weekday: number } // 0 = domingo
  | { kind: 'weekly'; weekday: number }
  | { kind: 'everyNDays'; n: number; anchor: string }
  | { kind: 'lastDayOfMonth' }

export interface ContentRule {
  type: ContentType
  title: string
  /** Texto curto da regra, para mostrar no Painel. */
  summary: string
  cadence: Cadence
}

export const CONTENT_RULES: ContentRule[] = [
  { type: 'evento', title: 'Publicar o evento do mês', summary: 'Todo 1º domingo do mês', cadence: { kind: 'firstWeekdayOfMonth', weekday: 0 } },
  { type: 'loja', title: 'Publicar na Loja', summary: 'Uma vez por mês, dia 10', cadence: { kind: 'monthlyDay', day: 10 } },
  { type: 'receitas', title: 'Publicar a receita da semana', summary: 'Uma vez por semana, aos domingos', cadence: { kind: 'weekly', weekday: 0 } },
  { type: 'revista', title: 'Publicar a revista do mês', summary: 'Uma vez por mês, dia 01', cadence: { kind: 'monthlyDay', day: 1 } },
  { type: 'respiracao', title: 'Publicar Respiração', summary: 'A cada 30 dias, no dia 15', cadence: { kind: 'monthlyDay', day: 15 } },
  { type: 'playlist', title: 'Publicar Playlist', summary: 'A cada 45 dias', cadence: { kind: 'everyNDays', n: 45, anchor: RULES_START } },
  { type: 'leitura', title: 'Publicar Dicas de leitura', summary: 'A cada 15 dias, às segundas', cadence: { kind: 'everyNDays', n: 14, anchor: '2026-12-07' } },
  { type: 'wellness', title: 'Publicar Wellness', summary: 'Uma vez por mês, dia 25', cadence: { kind: 'monthlyDay', day: 25 } },
  { type: 'series', title: 'Publicar dicas de séries e filmes', summary: 'Uma vez por semana, às sextas', cadence: { kind: 'weekly', weekday: 5 } },
  { type: 'viagens', title: 'Publicar Dicas de Viagem', summary: 'A cada 30 dias', cadence: { kind: 'everyNDays', n: 30, anchor: RULES_START } },
  { type: 'desafio', title: 'Lançar o desafio do mês (Meu Jardim)', summary: 'Último dia de cada mês', cadence: { kind: 'lastDayOfMonth' } },
]

// ---- datas em yyyy-mm-dd, sem fuso (contas em UTC) --------------------------------------

function toUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUtc(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

const DAY = 86_400_000

export function addDays(iso: string, n: number): string {
  return fromUtc(toUtc(iso) + n * DAY)
}

function weekdayOf(iso: string): number {
  return new Date(toUtc(iso)).getUTCDay()
}

function occursOn(rule: ContentRule, iso: string): boolean {
  if (iso < RULES_START) return false
  const c = rule.cadence
  const day = Number(iso.slice(8, 10))
  switch (c.kind) {
    case 'monthlyDay':
      return day === c.day
    case 'weekly':
      return weekdayOf(iso) === c.weekday
    case 'firstWeekdayOfMonth':
      return weekdayOf(iso) === c.weekday && day <= 7
    case 'lastDayOfMonth':
      return addDays(iso, 1).slice(8, 10) === '01'
    case 'everyNDays': {
      const diff = Math.round((toUtc(iso) - toUtc(c.anchor)) / DAY)
      return diff >= 0 && diff % c.n === 0
    }
  }
}

/** Publicações previstas pelas regras entre duas datas (inclusive), no formato dos itens da agenda. */
export function ruleItems(from: string, to: string, communityId = ''): ScheduleItem[] {
  const out: ScheduleItem[] = []
  const start = from < RULES_START ? RULES_START : from
  for (let iso = start; iso <= to; iso = addDays(iso, 1)) {
    for (const rule of CONTENT_RULES) {
      if (occursOn(rule, iso)) {
        out.push({
          id: `rule:${rule.type}:${iso}`,
          community_id: communityId,
          content_type: rule.type,
          phase: 'publicacao',
          title: rule.title,
          notes: null,
          scheduled_on: iso,
          done: false,
        })
      }
    }
  }
  return out
}

/** O que precisa ser publicado em `day` (yyyy-mm-dd). */
export function publicationsOn(day: string): ContentRule[] {
  return CONTENT_RULES.filter((r) => occursOn(r, day))
}

/** Avisos do sino de hoje: tudo o que será publicado amanhã. */
export function remindersForToday(today: string): { key: string; title: string; text: string }[] {
  const tomorrow = addDays(today, 1)
  return publicationsOn(tomorrow).map((r) => ({
    key: `${r.type}:${tomorrow}`,
    title: `Amanhã: ${r.title}`,
    text: `Regra: ${r.summary.toLowerCase()}.`,
  }))
}
