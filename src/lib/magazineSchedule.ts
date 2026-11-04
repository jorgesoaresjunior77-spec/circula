// A revista sai no dia 01 de cada mês (a cada ~30 dias).

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Próximo dia 01 estritamente depois de `now` (se hoje é dia 01, é o mês seguinte). */
export function nextMagazineRelease(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
}

/** Dias inteiros (calendário) de `now` até a próxima edição. Sempre >= 1. */
export function daysUntilNextMagazine(now: Date = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const next = nextMagazineRelease(now)
  return Math.round((next.getTime() - today.getTime()) / 86_400_000)
}

export function nextMagazineMessage(now: Date = new Date()): string {
  const days = daysUntilNextMagazine(now)
  const next = nextMagazineRelease(now)
  const when = `${pad(next.getDate())}/${pad(next.getMonth() + 1)}`
  return days === 1
    ? `A próxima edição sai amanhã, ${when}.`
    : `Faltam ${days} dias para a próxima edição (${when}).`
}

/** Data de lançamento sugerida para uma edição nova: o próximo dia 01. */
export function suggestedReleaseDate(now: Date = new Date()): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  return toIsoDate(first.getTime() >= today.getTime() ? first : nextMagazineRelease(now))
}
