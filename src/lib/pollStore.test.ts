import { describe, it, expect, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))

import { cleanPollOptions, tallyPoll } from './pollStore'

describe('pollStore', () => {
  it('limpa as opções: tira vazias e repetidas e limita a 8', () => {
    expect(cleanPollOptions([' Sábado ', '', 'sábado', 'Domingo'])).toEqual(['Sábado', 'Domingo'])
    expect(cleanPollOptions(Array.from({ length: 12 }, (_, i) => 'Opção ' + i))).toHaveLength(8)
  })

  it('conta votos por opção e pessoas que votaram', () => {
    const tally = tallyPoll({
      post_id: 'p',
      options: ['A', 'B', 'C'],
      allow_multiple: true,
      votes: [
        { profile_id: 'u1', option_index: 0 },
        { profile_id: 'u1', option_index: 1 },
        { profile_id: 'u2', option_index: 0 },
      ],
    })
    expect(tally.counts).toEqual([2, 1, 0])
    expect(tally.voters).toBe(2)
  })
})
