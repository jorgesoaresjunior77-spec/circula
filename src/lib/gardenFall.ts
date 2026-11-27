// Meu Jardim: pétala que cai. Um dia que passou sem check perde a pétala.
// Na primeira vez que a pessoa abre o jardim depois disso, a pétala CAI
// (animação); a queda fica registrada para não repetir a cada abertura.
// Abrindo depois de muitos dias, só os últimos caem na tela (no máximo
// MAX_FALLS); os mais antigos já aparecem caídos.

export const MAX_FALLS = 4

/** Dias do mês que já passaram sem check (hoje ainda não conta: o dia não fechou). */
export function missedDays(today: number, days: number, checked: Set<number>): number[] {
  const out: number[] = []
  for (let d = 1; d < Math.min(today, days + 1); d++) if (!checked.has(d)) out.push(d)
  return out
}

/** Separa os dias sem check em: os que caem agora e os que já estão caídos. */
export function splitFalls(missed: number[], seen: Set<number>): { falling: Set<number>; gone: Set<number> } {
  const pending = missed.filter((d) => !seen.has(d))
  const falling = new Set(pending.slice(-MAX_FALLS))
  const gone = new Set(missed.filter((d) => !falling.has(d)))
  return { falling, gone }
}

const keyOf = (profileId: string, monthId: string) => `circula:jardim:caiu:${profileId}:${monthId}`

export function readSeenFalls(profileId: string, monthId: string): Set<number> {
  try {
    const raw = localStorage.getItem(keyOf(profileId, monthId))
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return new Set(Array.isArray(arr) ? arr.filter((x): x is number => typeof x === 'number') : [])
  } catch {
    return new Set()
  }
}

export function saveSeenFalls(profileId: string, monthId: string, days: Iterable<number>) {
  try {
    const all = readSeenFalls(profileId, monthId)
    for (const d of days) all.add(d)
    localStorage.setItem(keyOf(profileId, monthId), JSON.stringify([...all].sort((a, b) => a - b)))
  } catch {
    /* sem armazenamento: a queda pode repetir, mas nada quebra */
  }
}
