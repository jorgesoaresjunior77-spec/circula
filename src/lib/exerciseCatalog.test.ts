import { describe, expect, it } from 'vitest'
import { BASE_EXERCISES, CATEGORIES, buildQuickWorkout, exerciseSeconds, filterExercises, formatClock } from './exerciseCatalog'
import { POSES, solvePose } from './exercisePoses'

describe('biblioteca base de exercícios', () => {
  it('cada exercício tem desenhos válidos, passos e categorias conhecidas', () => {
    const slugs = new Set<string>()
    for (const e of BASE_EXERCISES) {
      expect(slugs.has(e.slug)).toBe(false)
      slugs.add(e.slug)
      expect(POSES[e.pose_start]).toBeDefined()
      expect(POSES[e.pose_end]).toBeDefined()
      expect(e.steps.length).toBeGreaterThanOrEqual(3)
      expect(e.cautions.length).toBeGreaterThan(10)
      expect(e.mistakes.length).toBeGreaterThanOrEqual(2)
      for (const c of e.categories) expect(CATEGORIES).toContain(c)
    }
  })
  it('as poses ficam com o corpo dentro do quadro e apoiado no chão', () => {
    for (const k of Object.keys(POSES)) {
      const s = solvePose(POSES[k])
      expect(Number.isFinite(s.head[0])).toBe(true)
      const lowest = Math.max(s.legs.near[2][1], s.legs.near[3][1], s.hip[1])
      expect(lowest).toBeLessThanOrEqual(s.floorY)
    }
  })
  it('filtra por nome sem acento, categoria, nível e favoritos', () => {
    const list = BASE_EXERCISES.map((e, i) => ({ ...e, id: String(i) }))
    expect(filterExercises(list, { query: 'elevacao de quadril' }).length).toBe(1)
    expect(filterExercises(list, { category: 'Equilíbrio' }).every((e) => e.categories.includes('Equilíbrio'))).toBe(true)
    expect(filterExercises(list, { level: 'Intermediário' }).every((e) => e.level === 'Intermediário')).toBe(true)
    expect(filterExercises(list, { favoritesOnly: true }, new Set(['2'])).map((e) => e.id)).toEqual(['2'])
  })
  it('treinos rápidos respeitam o tempo e fecham com alongamento', () => {
    for (const m of [5, 10, 15, 20, 30]) {
      const w = buildQuickWorkout(BASE_EXERCISES, m)
      expect(w.length).toBeGreaterThan(0)
      const total = w.reduce((s, e) => s + exerciseSeconds(e), 0)
      expect(total).toBeLessThanOrEqual(m * 60 + 60 + w.length * 25)
    }
    const low = buildQuickWorkout(BASE_EXERCISES, 15, { lowImpactOnly: true, beginner: true })
    expect(low.every((e) => e.categories.includes('Baixo impacto') && e.level === 'Iniciante')).toBe(true)
  })
  it('formata o relógio', () => {
    expect(formatClock(65)).toBe('1:05')
  })
})

const IMAGES = Object.keys(import.meta.glob('/public/exercicios/*.webp'))
describe('ilustrações dos exercícios', () => {
  it('cada exercício da biblioteca base tem a imagem em public/exercicios', () => {
    for (const e of BASE_EXERCISES) expect(IMAGES).toContain(`/public/exercicios/${e.slug}.webp`)
  })
})
