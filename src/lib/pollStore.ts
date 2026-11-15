import { supabase } from './supabase'

// Enquetes das publicações. Vários cartões na mesma tela pedem a enquete do seu
// post; os pedidos feitos no mesmo instante viram UMA consulta (e uma de votos),
// em vez de uma por cartão. Quem não tem enquete fica marcado como `null`.

export interface PollVote {
  profile_id: string
  option_index: number
}

export interface Poll {
  post_id: string
  options: string[]
  allow_multiple: boolean
  votes: PollVote[]
}

export interface PollDraft {
  options: string[]
  allowMultiple: boolean
}

const cache = new Map<string, Poll | null>()
const waiting = new Map<string, ((poll: Poll | null) => void)[]>()
let scheduled = false

async function flush() {
  scheduled = false
  const ids = Array.from(waiting.keys())
  if (ids.length === 0) return
  const resolvers = new Map(waiting)
  waiting.clear()

  const found = new Map<string, Poll>()
  try {
    const { data: polls } = await supabase.from('post_polls').select('post_id,options,allow_multiple').in('post_id', ids)
    for (const row of (polls as { post_id: string; options: string[]; allow_multiple: boolean }[] | null) ?? []) {
      found.set(row.post_id, { ...row, votes: [] })
    }
    if (found.size > 0) {
      const { data: votes } = await supabase
        .from('post_poll_votes')
        .select('post_id,profile_id,option_index')
        .in('post_id', Array.from(found.keys()))
      for (const v of (votes as ({ post_id: string } & PollVote)[] | null) ?? []) {
        found.get(v.post_id)?.votes.push({ profile_id: v.profile_id, option_index: v.option_index })
      }
    }
  } catch {
    /* sem rede: trata como sem enquete nesta vez */
  }

  for (const id of ids) {
    const poll = found.get(id) ?? null
    cache.set(id, poll)
    resolvers.get(id)?.forEach((resolve) => resolve(poll))
  }
}

/** Enquete do post (ou `null`). Pedidos simultâneos dividem a mesma consulta. */
export function loadPoll(postId: string, force = false): Promise<Poll | null> {
  if (!force && cache.has(postId)) return Promise.resolve(cache.get(postId) ?? null)
  return new Promise((resolve) => {
    const list = waiting.get(postId) ?? []
    list.push(resolve)
    waiting.set(postId, list)
    if (!scheduled) {
      scheduled = true
      setTimeout(() => void flush(), 0)
    }
  })
}

export function peekPoll(postId: string): Poll | null | undefined {
  return cache.get(postId)
}

/** Contagem de votos por opção e total de pessoas que votaram. */
export function tallyPoll(poll: Poll): { counts: number[]; voters: number } {
  const counts = poll.options.map(() => 0)
  const people = new Set<string>()
  for (const v of poll.votes) {
    if (v.option_index >= 0 && v.option_index < counts.length) counts[v.option_index] += 1
    people.add(v.profile_id)
  }
  return { counts, voters: people.size }
}

/**
 * Vota (ou tira o voto) numa opção. Escolha única: trocar de opção apaga o voto
 * anterior. Devolve a enquete atualizada.
 */
export async function toggleVote(
  poll: Poll,
  viewerId: string,
  optionIndex: number,
): Promise<{ poll: Poll; error: string | null }> {
  const mine = poll.votes.filter((v) => v.profile_id === viewerId)
  const already = mine.some((v) => v.option_index === optionIndex)

  if (already) {
    const { error } = await supabase
      .from('post_poll_votes')
      .delete()
      .eq('post_id', poll.post_id)
      .eq('profile_id', viewerId)
      .eq('option_index', optionIndex)
    if (error) return { poll, error: 'Não foi possível tirar o voto agora.' }
  } else {
    if (!poll.allow_multiple && mine.length > 0) {
      const { error } = await supabase
        .from('post_poll_votes')
        .delete()
        .eq('post_id', poll.post_id)
        .eq('profile_id', viewerId)
      if (error) return { poll, error: 'Não foi possível trocar o voto agora.' }
    }
    const { error } = await supabase.from('post_poll_votes').insert({ post_id: poll.post_id, option_index: optionIndex })
    if (error) return { poll, error: 'Não foi possível votar agora.' }
  }

  const fresh = await loadPoll(poll.post_id, true)
  return { poll: fresh ?? poll, error: null }
}

/** Limpa e valida as opções digitadas (até 8, sem vazias nem repetidas). */
export function cleanPollOptions(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const text = item.trim().slice(0, 80)
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out.slice(0, 8)
}

/** Só para testes. */
export function clearPollCache() {
  cache.clear()
  waiting.clear()
  scheduled = false
}
