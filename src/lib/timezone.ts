// Etapa 6 (correção pós-auditoria — achado D) — fuso horário oficial dos
// ciclos do Meu Jardim. Espelha exatamente o lado servidor
// (garden_community_timezone() + _garden_award_points, migration
// 20261030140000 v2): mesma constante padrão, mesmo conceito de "data
// local calculada explicitamente num fuso IANA", NUNCA a hora local do
// dispositivo da participante (`new Date().getMonth()` etc. — o bug
// relatado na auditoria).
//
// Zero dependência nova (o projeto não usa nenhuma lib de datas) — só
// `Intl.DateTimeFormat` nativo, suportado em todo navegador atual.

/** Mesma constante do servidor (garden_community_timezone — padrão
 *  quando a comunidade não configurou um fuso próprio em
 *  `communities.timezone`). Hoje nenhuma tela escreve nessa coluna,
 *  então cliente e servidor SEMPRE concordam — ver nota na migration. */
export const GARDEN_DEFAULT_TIMEZONE = 'America/Sao_Paulo'

export interface LocalDateParts {
  year: number
  month: number // 1-12
  day: number
}

/** Ano/mês/dia de `at`, como visto no fuso `timeZone` — nunca no fuso
 *  do navegador. `en-CA` formata como `YYYY-MM-DD` de forma estável em
 *  qualquer motor JS moderno; é só um truque de formatação, não altera
 *  o fuso usado (vem do `timeZone` passado). */
export function getLocalDateParts(at: Date, timeZone: string = GARDEN_DEFAULT_TIMEZONE): LocalDateParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [year, month, day] = formatter.format(at).split('-').map(Number)
  return { year, month, day }
}

/** `YYYY-MM-01`, no fuso informado — mesmo formato de `period_month` no
 *  banco (calculado lá com a mesma regra, em SQL, via
 *  `garden_community_timezone`/`date_trunc(... at time zone tz)`). */
export function localPeriodMonth(at: Date = new Date(), timeZone: string = GARDEN_DEFAULT_TIMEZONE): string {
  const { year, month } = getLocalDateParts(at, timeZone)
  return `${year}-${String(month).padStart(2, '0')}-01`
}
