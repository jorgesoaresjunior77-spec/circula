// Diário da Gratidão: regras puras (sem acesso ao banco).
// As orações são cadastradas pela nutricionista; o app só escolhe qual mostrar.

export interface Prayer {
  id: string
  title: string | null
  body: string
  status: 'draft' | 'published'
  position: number
}

/** Número do dia (para o rodízio): conta dias desde 1970 na data local. */
export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/** A oração do dia: rodízio entre as publicadas, a mesma o dia todo. */
export function prayerOfTheDay<T extends { id: string; position: number; status: string }>(prayers: T[], todayIso: string): T | null {
  const list = prayers.filter((p) => p.status === 'published').sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  if (list.length === 0) return null
  return list[dayNumber(todayIso) % list.length]
}

/** Dias seguidos com registro, contando de hoje (ou de ontem, se hoje ainda não tem). */
export function streak(daysIso: string[], todayIso: string): number {
  const set = new Set(daysIso)
  let cur = dayNumber(todayIso)
  const iso = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10)
  if (!set.has(iso(cur))) cur -= 1
  let count = 0
  while (set.has(iso(cur))) {
    count += 1
    cur -= 1
  }
  return count
}

export const AMEN_MESSAGES = [
  'Amém. Que o seu dia seja leve e cheio de paz.',
  'Amém. Você não está sozinha: respire fundo e siga com fé.',
  'Amém. Gratidão por este momento só seu.',
]

export function amenMessage(todayIso: string): string {
  return AMEN_MESSAGES[dayNumber(todayIso) % AMEN_MESSAGES.length]
}
