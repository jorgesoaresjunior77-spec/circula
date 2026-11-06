import { GARDEN_DEFAULT_TIMEZONE } from './timezone'

// Conversão entre "data e hora de parede" num fuso IANA e o instante UTC.
// A agenda, a água e os hábitos usam sempre o fuso oficial do app
// (America/Sao_Paulo), nunca o do aparelho. Só `Intl` nativo.

function zonedFields(ts: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ts))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/** Diferença (ms) entre a hora de parede do fuso e o UTC, naquele instante. */
function offsetAt(ts: number, timeZone: string): number {
  const second = Math.floor(ts / 1000) * 1000
  const f = zonedFields(second, timeZone)
  return Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second) - second
}

/**
 * `YYYY-MM-DD` + `HH:MM` na hora de parede do fuso -> ISO em UTC.
 * Duas passadas para acertar quando o fuso tem horário de verão.
 */
export function zonedToUtcIso(
  date: string,
  time: string,
  timeZone: string = GARDEN_DEFAULT_TIMEZONE,
): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const wall = Date.UTC(y, m - 1, d, hh, mm)
  let ts = wall - offsetAt(wall, timeZone)
  ts = wall - offsetAt(ts, timeZone)
  return new Date(ts).toISOString()
}

/** Instante UTC -> data (`YYYY-MM-DD`) e hora (`HH:MM`) de parede no fuso. */
export function utcToZoned(
  iso: string,
  timeZone: string = GARDEN_DEFAULT_TIMEZONE,
): { date: string; time: string } {
  const f = zonedFields(new Date(iso).getTime(), timeZone)
  const p = (n: number) => String(n).padStart(2, '0')
  return { date: `${f.year}-${p(f.month)}-${p(f.day)}`, time: `${p(f.hour)}:${p(f.minute)}` }
}
