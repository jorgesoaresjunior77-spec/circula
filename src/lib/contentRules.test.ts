import { describe, expect, it } from 'vitest'
import { addDays, publicationsOn, remindersForToday, ruleItems } from './contentRules'

const types = (day: string) => publicationsOn(day).map((r) => r.type).sort()

describe('regras fixas da agenda de conteúdos', () => {
  it('nada vale antes de 01/12/2026', () => {
    expect(ruleItems('2026-11-01', '2026-11-30')).toEqual([])
    expect(types('2026-11-29')).toEqual([]) // domingo, mas ainda sem regra
  })

  it('01/12/2026: revista (dia 01), playlist e Dicas de Viagem (início das contagens)', () => {
    expect(types('2026-12-01')).toEqual(['playlist', 'revista', 'viagens'])
  })

  it('desafio do mês: último dia de cada mês', () => {
    expect(types('2026-12-31')).toContain('desafio')
    expect(types('2027-02-28')).toContain('desafio')
    expect(types('2027-02-27')).not.toContain('desafio')
    expect(types('2027-04-30')).toContain('desafio')
  })

  it('Dicas de Viagem: a cada 30 dias (01/12, 31/12, 30/01)', () => {
    const days = ruleItems('2026-12-01', '2027-02-15')
      .filter((i) => i.content_type === 'viagens')
      .map((i) => i.scheduled_on)
    expect(days).toEqual(['2026-12-01', '2026-12-31', '2027-01-30'])
  })

  it('dezembro/2026: evento no 1º domingo (06), receitas todo domingo', () => {
    expect(types('2026-12-06')).toEqual(['evento', 'receitas'])
    expect(types('2026-12-13')).toEqual(['receitas'])
    expect(types('2026-12-20')).toEqual(['receitas'])
    expect(types('2026-12-27')).toEqual(['receitas'])
  })

  it('loja dia 10, respiração dia 15, wellness dia 25', () => {
    expect(types('2026-12-10')).toContain('loja')
    expect(types('2026-12-15')).toContain('respiracao')
    expect(types('2026-12-25')).toContain('wellness')
    expect(types('2027-01-10')).toContain('loja')
  })

  it('dicas de leitura: segundas de 14 em 14 dias (07/12, 21/12, 04/01)', () => {
    const days = ruleItems('2026-12-01', '2027-01-31')
      .filter((i) => i.content_type === 'leitura')
      .map((i) => i.scheduled_on)
    expect(days).toEqual(['2026-12-07', '2026-12-21', '2027-01-04', '2027-01-18'])
  })

  it('playlist: a cada 45 dias (01/12, 15/01, 01/03)', () => {
    const days = ruleItems('2026-12-01', '2027-03-31')
      .filter((i) => i.content_type === 'playlist')
      .map((i) => i.scheduled_on)
    expect(days).toEqual(['2026-12-01', '2027-01-15', '2027-03-01'])
  })

  it('aviso do sino: um dia antes', () => {
    const r = remindersForToday('2026-12-09') // amanhã é dia 10 -> loja
    expect(r.map((x) => x.key)).toEqual(['loja:2026-12-10'])
    expect(remindersForToday('2026-11-30').map((x) => x.key).sort()).toEqual(['playlist:2026-12-01', 'revista:2026-12-01', 'viagens:2026-12-01'])
    expect(remindersForToday('2026-12-02')).toEqual([])
  })

  it('addDays atravessa mês e ano', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28')
  })
})
