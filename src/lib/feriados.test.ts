import { describe, it, expect } from 'vitest'
import { easterSunday, holidaysBetween, holidaysForYear } from './feriados'

describe('feriados brasileiros', () => {
  it('calcula a Páscoa', () => {
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 })
    expect(easterSunday(2027)).toEqual({ month: 3, day: 28 })
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 })
  })
  it('datas móveis de 2026 e 2027', () => {
    const y26 = holidaysForYear(2026)
    const find = (list: typeof y26, name: string) => list.filter((h) => h.name === name).map((h) => h.iso)
    expect(find(y26, 'Carnaval')).toEqual(['2026-02-16', '2026-02-17'])
    expect(find(y26, 'Sexta-feira Santa')).toEqual(['2026-04-03'])
    expect(find(y26, 'Corpus Christi')).toEqual(['2026-06-04'])
    const y27 = holidaysForYear(2027)
    expect(find(y27, 'Carnaval')).toEqual(['2027-02-08', '2027-02-09'])
    expect(find(y27, 'Corpus Christi')).toEqual(['2027-05-27'])
  })
  it('classifica Carnaval e Corpus Christi como ponto facultativo e o resto como nacional', () => {
    const y = holidaysForYear(2026)
    expect(y.filter((h) => h.kind === 'ponto_facultativo').map((h) => h.name)).toEqual(['Carnaval', 'Carnaval', 'Corpus Christi'])
    expect(y.filter((h) => h.kind === 'nacional')).toHaveLength(10)
    expect(y.find((h) => h.iso === '2026-11-20')?.name).toBe('Dia Nacional de Zumbi e da Consciência Negra')
  })
  it('sem duplicar e só no intervalo pedido, atravessando o ano', () => {
    const map = holidaysBetween('2026-12-20', '2027-01-05')
    expect([...map.keys()]).toEqual(['2026-12-25', '2027-01-01'])
  })
})
