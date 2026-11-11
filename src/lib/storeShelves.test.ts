import { describe, it, expect } from 'vitest'
import { shelfRows } from './storeShelves'

describe('shelfRows', () => {
  it('sem produto, mostra 3 prateleiras vazias', () => {
    const rows = shelfRows([])
    expect(rows).toHaveLength(3)
    expect(rows.every((row) => row.length === 3 && row.every((item) => item === null))).toBe(true)
  })

  it('distribui em fileiras de 3 e completa a última com vazios', () => {
    const rows = shelfRows(['a', 'b', 'c', 'd'])
    expect(rows[0]).toEqual(['a', 'b', 'c'])
    expect(rows[1]).toEqual(['d', null, null])
    expect(rows).toHaveLength(3)
  })

  it('cria mais prateleiras quando há muitos produtos', () => {
    const rows = shelfRows(Array.from({ length: 10 }, (_, i) => i))
    expect(rows).toHaveLength(4)
    expect(rows[3]).toEqual([9, null, null])
  })
})
