import { describe, expect, it } from 'vitest'
import { cityNormalize, findSimilarCategory, findSimilarListing, healthTextProblem, instagramHandle } from './city'
import type { CityCategory, CityListing } from './city'
import { countByGroup, filterGuide, splitUpcoming } from './cityFilter'

const cat = (id: string, nome: string, grupo = 'casa'): CityCategory => ({
  id,
  nome,
  nome_normalizado: cityNormalize(nome),
  grupo,
  status: 'ativa',
  unida_a: null,
})

const listing = (over: Partial<CityListing>): CityListing => ({
  id: 'l',
  city_id: 'c',
  cidade: 'Lajeado',
  estado: 'RS',
  tipo: 'lugar',
  categoria_id: null,
  titulo: 'Café da Praça',
  descricao: null,
  bairro: null,
  endereco: null,
  contato: null,
  instagram: null,
  faixa_preco: null,
  horario: null,
  horarios: null,
  foto: null,
  criado_por: 'u',
  autora_nome: 'Ana',
  autora_avatar: null,
  e_proprio_negocio: false,
  atende_toda_cidade: false,
  status: 'ativo',
  criado_em: '2026-11-01T10:00:00Z',
  starts_at: null,
  local_nome: null,
  valor: null,
  link: null,
  atividade: null,
  vagas: null,
  nivel: null,
  votos: 0,
  votei: false,
  salvei: false,
  confirmadas: 0,
  vou: false,
  media: null,
  avaliacoes: 0,
  minha_nota: null,
  reivindicado: false,
  sou_dona: false,
  minha_reivindicacao: null,
  pedido_em_aberto: false,
  destaque: false,
  destaque_meu: null,
  destaque_meu_id: null,
  destaque_ate: null,
  tags: [],
  ...over,
})

describe('cityNormalize', () => {
  it('ignora maiúsculas, acentos e plural', () => {
    expect(cityNormalize('Eletricistas')).toBe(cityNormalize('eletricista'))
    expect(cityNormalize('Médicas')).toBe(cityNormalize('MEDICA'))
    expect(cityNormalize('Pubs e cervejarias')).toBe('pub e cervejaria')
  })
})

describe('findSimilarCategory', () => {
  const cats = [cat('1', 'Eletricista'), cat('2', 'Encanador')]
  it('sugere a existente para "eletricista" digitado de novo', () => {
    expect(findSimilarCategory('eletricista', cats)?.id).toBe('1')
    expect(findSimilarCategory('Eletricistas', cats)?.id).toBe('1')
  })
  it('pega erro de uma letra em nomes longos', () => {
    expect(findSimilarCategory('eletricsta', cats)?.id).toBe('1')
  })
  it('não confunde nomes diferentes', () => {
    expect(findSimilarCategory('Pintor', cats)).toBeNull()
  })
  it('ignora categorias unidas', () => {
    expect(findSimilarCategory('Eletricista', [{ ...cat('1', 'Eletricista'), status: 'unida' }])).toBeNull()
  })
})

describe('findSimilarListing', () => {
  it('acha cadastro parecido do mesmo tipo', () => {
    expect(findSimilarListing('cafe da praca', 'lugar', [listing({})])?.id).toBe('l')
    expect(findSimilarListing('cafe da praca', 'profissional', [listing({})])).toBeNull()
  })
})

describe('healthTextProblem', () => {
  it('barra cura, antes e depois e preço', () => {
    expect(healthTextProblem('Resultado garantido')).not.toBeNull()
    expect(healthTextProblem('Veja o antes e depois')).not.toBeNull()
    expect(healthTextProblem('Consulta por R$ 200')).not.toBeNull()
    expect(healthTextProblem('Atendimento acolhedor e atencioso')).toBeNull()
    expect(healthTextProblem('Ela me ajudou muito, procuro sempre')).toBeNull()
  })
})

describe('instagramHandle', () => {
  it('limpa @ e link', () => {
    expect(instagramHandle('@circula')).toBe('circula')
    expect(instagramHandle('https://instagram.com/circula/')).toBe('circula')
    expect(instagramHandle('')).toBeNull()
  })
})

describe('filterGuide', () => {
  const cats = [cat('a', 'Eletricista', 'casa'), cat('b', 'Cafés', 'comer')]
  const items = [
    listing({ id: '1', titulo: 'João Elétrica', categoria_id: 'a', votos: 5, tags: ['t1'], faixa_preco: '$' }),
    listing({ id: '2', titulo: 'Café A', categoria_id: 'b', votos: 1, criado_em: '2026-11-10T10:00:00Z' }),
    listing({ id: '3', titulo: 'Café B', categoria_id: 'b', votos: 9 }),
  ]
  const base = { group: null, categoryId: null, query: '', tagIds: [], price: null, sort: 'indicados' as const }
  it('filtra por grupo e ordena por mais indicados', () => {
    expect(filterGuide(items, cats, { ...base, group: 'comer' }).map((l) => l.id)).toEqual(['3', '2'])
  })
  it('ordena por mais recentes', () => {
    expect(filterGuide(items, cats, { ...base, group: 'comer', sort: 'recentes' }).map((l) => l.id)).toEqual(['2', '3'])
  })
  it('busca por nome ou categoria, tag e preço', () => {
    expect(filterGuide(items, cats, { ...base, query: 'eletricistas' }).map((l) => l.id)).toEqual(['1'])
    expect(filterGuide(items, cats, { ...base, tagIds: ['t1'] }).map((l) => l.id)).toEqual(['1'])
    expect(filterGuide(items, cats, { ...base, price: '$' }).map((l) => l.id)).toEqual(['1'])
  })
  it('conta por grupo', () => {
    const m = countByGroup(items, cats)
    expect(m.get('comer')).toBe(2)
    expect(m.get('casa')).toBe(1)
  })
})

describe('splitUpcoming', () => {
  it('separa próximos e passados', () => {
    const now = Date.parse('2026-12-01T12:00:00Z')
    const r = splitUpcoming(
      [listing({ id: 'p', starts_at: '2026-11-01T10:00:00Z' }), listing({ id: 'f', starts_at: '2026-12-05T10:00:00Z' }), listing({ id: 'g', starts_at: '2026-12-02T10:00:00Z' })],
      now,
    )
    expect(r.upcoming.map((l) => l.id)).toEqual(['g', 'f'])
    expect(r.past.map((l) => l.id)).toEqual(['p'])
  })
})

import { formatPhoneBR, hoursSummary } from './city'

describe('telefone e horários', () => {
  it('o telefone começa em "( )" e vai formatando com DDD', () => {
    expect(formatPhoneBR('')).toBe('( ) ')
    expect(formatPhoneBR('5')).toBe('(5')
    expect(formatPhoneBR('51')).toBe('(51')
    expect(formatPhoneBR('519')).toBe('(51) 9')
    expect(formatPhoneBR('51999998888')).toBe('(51) 99999-8888')
    expect(formatPhoneBR('5133334444')).toBe('(51) 3333-4444')
  })
  it('junta dias seguidos iguais', () => {
    expect(hoursSummary({ seg: '08:00-18:00', ter: '08:00-18:00', qua: '08:00-18:00', sab: '24h', dom: 'fechado' })).toBe(
      'Seg a Qua 08:00 às 18:00 · Sáb 24 horas · Dom fechado',
    )
    expect(hoursSummary(null)).toBe('')
  })
})
