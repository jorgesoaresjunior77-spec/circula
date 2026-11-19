import { describe, it, expect } from 'vitest'
import { EMPTY_ANSWERS, buildMenu, countFor, mentions, shoppingForMenu, splitTerms } from './menuBuilder'
import type { Course, MenuAnswers, MenuRecipe, RecipeMenuMeta } from './menuBuilder'

function recipe(id: string, title: string, course: Course, ingredients: string, meta: Partial<RecipeMenuMeta> = {}, status = 'published'): MenuRecipe {
  return {
    id,
    title,
    summary: null,
    ingredients,
    body: 'Modo de preparo',
    cover_image_url: null,
    status,
    meta: {
      course,
      cuisines: [],
      diets: [],
      allergens: [],
      allergens_verified: false,
      prep_minutes: 30,
      difficulty: 'facil',
      servings: 4,
      est_cost_cents: null,
      ...meta,
    },
  }
}

const answers = (over: Partial<MenuAnswers> = {}): MenuAnswers => ({ ...EMPTY_ANSWERS, ...over })

const LIB: MenuRecipe[] = [
  recipe('m1', 'Risoto de cogumelos', 'prato_principal', '300 g de arroz arbóreo\n200 g de cogumelos\n1 cebola', { cuisines: ['italiana'], diets: ['vegetariano'], allergens: ['leite'], allergens_verified: true }),
  recipe('m2', 'Frango assado', 'prato_principal', '1 kg de frango\n2 cebolas', { cuisines: ['caseira', 'brasileira'] }),
  recipe('a1', 'Salada de rúcula', 'acompanhamento', '200 g de rúcula\n1 tomate', { cuisines: ['italiana'], diets: ['vegano', 'sem_gluten'], allergens_verified: true }),
  recipe('a2', 'Arroz com cenoura', 'acompanhamento', '200 g de arroz\n1 cenoura', { cuisines: ['brasileira'] }),
  recipe('a3', 'Batata rústica', 'acompanhamento', '500 g de batata\n2 colheres de azeite', { cuisines: ['caseira'] }),
  recipe('s1', 'Pudim', 'sobremesa', '1 lata de leite condensado\n3 ovos', { cuisines: ['brasileira'], allergens: ['leite', 'ovo'], allergens_verified: true }),
  recipe('s2', 'Salada de frutas', 'sobremesa', '2 laranjas\n1 mamão', { diets: ['vegano', 'sem_acucar'], allergens_verified: true }),
  recipe('rasc', 'Rascunho de bolo', 'sobremesa', '2 ovos', {}, 'draft'),
  { ...recipe('sem', 'Sem ficha', 'sobremesa', '1 ovo'), meta: null },
]

describe('buildMenu', () => {
  it('respeita exatamente as etapas escolhidas', () => {
    const r = buildMenu(answers({ courses: ['prato_principal', 'sobremesa'] }), LIB)
    expect(r.sections.map((s) => s.course)).toEqual(['prato_principal', 'sobremesa'])
  })

  it('só usa receitas publicadas e com ficha', () => {
    const r = buildMenu(answers({ courses: ['sobremesa'] }), LIB)
    const ids = r.sections.flatMap((s) => s.picks.map((p) => p.recipe.id))
    expect(ids).not.toContain('rasc')
    expect(ids).not.toContain('sem')
  })

  it('é determinístico e o variant gira a sugestão', () => {
    const a = buildMenu(answers(), LIB, 0)
    const b = buildMenu(answers(), LIB, 0)
    const c = buildMenu(answers(), LIB, 1)
    const ids = (x: typeof a) => x.sections.flatMap((s) => s.picks.map((p) => p.recipe.id)).join()
    expect(ids(a)).toBe(ids(b))
    expect(ids(c)).not.toBe(ids(a))
  })

  it('vegetariano aceita receita vegana', () => {
    const r = buildMenu(answers({ courses: ['acompanhamento'], diets: ['vegetariano'], guests: 4 }), LIB)
    const ids = r.sections.flatMap((s) => s.picks.map((p) => p.recipe.id))
    expect(ids).toEqual(['a1'])
  })

  it('ingrediente que a pessoa prefere não usar tira a receita', () => {
    const r = buildMenu(answers({ courses: ['prato_principal'], avoid: 'cebola' }), LIB)
    expect(r.sections).toHaveLength(0)
    expect(r.gaps[0].course).toBe('prato_principal')
  })

  it('alergia exige ficha verificada: receita sem verificação nunca entra', () => {
    const r = buildMenu(answers({ courses: ['prato_principal'], allergies: 'amendoim' }), LIB)
    // m2 não tem ficha verificada; m1 tem e não declara amendoim.
    expect(r.sections[0].picks[0].recipe.id).toBe('m1')
    expect(r.warnings.join(' ')).toMatch(/contaminação cruzada/)
  })

  it('alergia declarada na ficha exclui a receita', () => {
    const r = buildMenu(answers({ courses: ['sobremesa'], allergies: 'ovo' }), LIB)
    const ids = r.sections.flatMap((s) => s.picks.map((p) => p.recipe.id))
    expect(ids).toEqual(['s2'])
  })

  it('alergia também vale para o termo no texto dos ingredientes', () => {
    const lib = [recipe('x', 'Torta', 'sobremesa', '2 colheres de pasta de amendoim', { allergens_verified: true })]
    const r = buildMenu(answers({ courses: ['sobremesa'], allergies: 'amendoim' }), lib)
    expect(r.sections).toHaveLength(0)
  })

  it('sem receitas suficientes informa a falta e não inventa', () => {
    const r = buildMenu(answers({ courses: ['entrada'] }), LIB)
    expect(r.sections).toHaveLength(0)
    expect(r.gaps[0].reason).toMatch(/ainda não tem receitas/)
  })

  it('ajusta as quantidades ao número de convidados', () => {
    const r = buildMenu(answers({ courses: ['prato_principal'], guests: 8, cuisines: ['caseira'] }), LIB)
    const pick = r.sections[0].picks[0]
    expect(pick.factor).toBe(2)
    expect(pick.scaled.find((d) => d.name.includes('frango'))?.quantity).toBe(2)
  })

  it('limite de tempo corta receitas longas', () => {
    const lib = [recipe('long', 'Assado lento', 'prato_principal', '1 kg de carne', { prep_minutes: 240 })]
    const r = buildMenu(answers({ courses: ['prato_principal'], timeLimit: '120' }), lib)
    expect(r.sections).toHaveLength(0)
  })

  it('prefere o estilo pedido e avisa quando só há outro', () => {
    const r = buildMenu(answers({ courses: ['prato_principal'], cuisines: ['italiana'] }), LIB)
    expect(r.sections[0].picks[0].recipe.id).toBe('m1')
    const r2 = buildMenu(answers({ courses: ['sobremesa'], cuisines: ['italiana'] }), LIB)
    expect(r2.sections[0].picks[0].notes.join(' ')).toMatch(/mais próxima/)
  })
})

describe('lista de compras do cardápio', () => {
  it('soma ingredientes iguais entre as receitas', () => {
    const r = buildMenu(answers({ courses: ['prato_principal', 'acompanhamento'], guests: 4, cuisines: ['brasileira'] }), LIB)
    const items = shoppingForMenu(r)
    const cebolas = items.filter((i) => i.name.toLowerCase().includes('cebola'))
    expect(cebolas.length).toBeLessThanOrEqual(1)
  })
})

describe('utilidades', () => {
  it('quantidade por etapa cresce com o grupo', () => {
    expect(countFor('acompanhamento', 4)).toBe(2)
    expect(countFor('acompanhamento', 8)).toBe(3)
    expect(countFor('entrada', 10)).toBe(2)
  })
  it('splitTerms e mentions ignoram acento e plural', () => {
    expect(splitTerms('Cebola, ALHO;Amendoim')).toEqual(['cebola', 'alho', 'amendoim'])
    expect(mentions('2 cebolas roxas', 'cebola')).toBe(true)
    expect(mentions('camarão seco', 'camarao')).toBe(true)
    expect(mentions('cebolinha', 'cebola')).toBe(false)
  })
})
