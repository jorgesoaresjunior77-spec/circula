import { describe, expect, it } from 'vitest'
import { BASE_EXERCISES, CATEGORIES, MATERIALS, buildWorkout, exerciseSeconds, formatClock, usable } from './exerciseCatalog'

const IMAGES = Object.keys(import.meta.glob('/public/exercicios/*.webp'))
const REQ = { minutes: 20, categories: [] as string[], goals: [] as string[], level: 'Iniciante' as const, lowImpactOnly: false, materials: [] as string[], seed: 1 }

describe('biblioteca de exercícios para fazer em casa', () => {
  it('tem muitos exercícios, cada um com texto completo, categorias conhecidas e imagem', () => {
    expect(BASE_EXERCISES.length).toBeGreaterThanOrEqual(50)
    const slugs = new Set<string>()
    for (const e of BASE_EXERCISES) {
      expect(slugs.has(e.slug)).toBe(false)
      slugs.add(e.slug)
      expect(e.steps.length).toBeGreaterThanOrEqual(3)
      expect(e.cautions.length).toBeGreaterThan(10)
      expect(e.mistakes.length).toBeGreaterThanOrEqual(2)
      for (const c of e.categories) expect(CATEGORIES).toContain(c)
      for (const p of e.props ?? []) expect(MATERIALS.map((m) => m.key)).toContain(p)
      expect(IMAGES).toContain(`/public/exercicios/${e.slug}.webp`)
    }
  })

  it('sem material em casa, só entram exercícios com o peso do corpo', () => {
    const list = usable(BASE_EXERCISES, REQ)
    expect(list.length).toBeGreaterThan(15)
    expect(list.every((e) => (e.props ?? []).length === 0)).toBe(true)
  })

  it('o nível iniciante não traz exercícios intermediários', () => {
    expect(usable(BASE_EXERCISES, REQ).every((e) => e.level === 'Iniciante')).toBe(true)
    expect(usable(BASE_EXERCISES, { ...REQ, level: 'Intermediário' }).some((e) => e.level === 'Intermediário')).toBe(true)
  })

  it('o treino respeita o tempo pedido, tem alongamento no fim e não repete exercício', () => {
    for (const minutes of [10, 15, 20, 30, 45, 60]) {
      const { items, seconds } = buildWorkout(BASE_EXERCISES, { ...REQ, minutes })
      expect(items.length).toBeGreaterThan(0)
      expect(new Set(items.map((e) => e.slug)).size).toBe(items.length)
      expect(items.at(-1)?.categories).toContain('Alongamento')
      expect(seconds).toBeLessThanOrEqual(minutes * 60 + 90)
      expect(seconds).toBeGreaterThanOrEqual(minutes * 60 * 0.45)
      expect(items.reduce((t, e) => t + exerciseSeconds(e) + 15, 0)).toBe(seconds)
    }
  })

  it('treinos mais longos têm mais exercícios', () => {
    const a = buildWorkout(BASE_EXERCISES, { ...REQ, minutes: 10 }).items.length
    const b = buildWorkout(BASE_EXERCISES, { ...REQ, minutes: 45 }).items.length
    expect(b).toBeGreaterThan(a)
  })

  it('respeita as regiões escolhidas, o baixo impacto e o material de casa', () => {
    const legs = buildWorkout(BASE_EXERCISES, { ...REQ, categories: ['Pernas'] }).items.filter((e) => !e.categories.includes('Alongamento') && !e.goals.includes('Mobilidade'))
    expect(legs.length).toBeGreaterThan(0)
    expect(legs.every((e) => e.categories.includes('Pernas'))).toBe(true)
    const low = buildWorkout(BASE_EXERCISES, { ...REQ, lowImpactOnly: true }).items
    expect(low.every((e) => e.categories.includes('Baixo impacto'))).toBe(true)
    const withChair = buildWorkout(BASE_EXERCISES, { ...REQ, minutes: 60, materials: ['cadeira', 'parede', 'garrafas', 'degrau'], level: 'Intermediário' }).items
    expect(withChair.some((e) => (e.props ?? []).length > 0)).toBe(true)
  })

  it('o sorteio muda com outro número e é estável com o mesmo', () => {
    const a = buildWorkout(BASE_EXERCISES, { ...REQ, seed: 1 }).items.map((e) => e.slug)
    expect(buildWorkout(BASE_EXERCISES, { ...REQ, seed: 1 }).items.map((e) => e.slug)).toEqual(a)
    const others = [2, 3, 4, 5].map((seed) => buildWorkout(BASE_EXERCISES, { ...REQ, seed }).items.map((e) => e.slug).join())
    expect(others.some((o) => o !== a.join())).toBe(true)
  })

  it('formata o relógio', () => {
    expect(formatClock(65)).toBe('1:05')
  })
})
