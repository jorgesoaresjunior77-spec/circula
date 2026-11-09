import { describe, it, expect } from 'vitest'
import { HELP_CATEGORIES } from './helpContent'
import { normalize, searchHelp } from './helpSearch'

describe('conteúdo da ajuda', () => {
  it('tem as 11 categorias pedidas e toda pergunta tem resposta de verdade', () => {
    expect(HELP_CATEGORIES).toHaveLength(11)
    const ids = new Set<string>()
    for (const c of HELP_CATEGORIES) {
      expect(c.items.length).toBeGreaterThan(0)
      for (const i of c.items) {
        expect(ids.has(i.id)).toBe(false)
        ids.add(i.id)
        expect(i.q.trim().length).toBeGreaterThan(8)
        expect(i.a.trim().length).toBeGreaterThan(60)
      }
    }
  })
})

describe('searchHelp', () => {
  it('ignora maiúsculas e acentos', () => {
    expect(normalize('  SÉNHA  ')).toBe('senha')
    const a = searchHelp('SENHA').map((h) => h.item.id)
    const b = searchHelp('senha').map((h) => h.item.id)
    expect(a).toEqual(b)
  })

  it('"senha" traz recuperação, troca e segurança da conta', () => {
    const ids = searchHelp('senha').map((h) => h.item.id)
    expect(ids).toEqual(expect.arrayContaining(['ca-1', 'ca-2', 'ca-7']))
  })

  it('aceita palavra incompleta', () => {
    const ids = searchHelp('assinat').map((h) => h.item.id)
    expect(ids).toEqual(expect.arrayContaining(['ap-3', 'ap-11']))
  })

  it('exige todas as palavras digitadas', () => {
    const ids = searchHelp('cancelar assinatura').map((h) => h.item.id)
    expect(ids).toContain('ap-11')
    expect(searchHelp('cancelar xyzinexistente')).toEqual([])
  })

  it('título pesa mais que o corpo na ordem dos resultados', () => {
    const first = searchHelp('esqueci minha senha')[0]
    expect(first.item.id).toBe('ca-1')
  })

  it('consulta vazia não devolve nada', () => {
    expect(searchHelp('   ')).toEqual([])
  })
})
