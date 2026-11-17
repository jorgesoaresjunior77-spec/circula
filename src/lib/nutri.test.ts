import { describe, expect, it } from 'vitest'
import {
  ageFrom,
  bmi,
  daysBetween,
  derive,
  diff,
  heightAt,
  needsReturn,
  percentVariation,
  waistHeightRatio,
  waistHipRatio,
} from './nutri'
import type { Assessment, Consultation } from './nutri'

const base = (over: Partial<Assessment>): Assessment => ({
  id: 'a',
  patient_id: 'p',
  assessed_on: '2026-01-01',
  weight_kg: null,
  height_cm: null,
  abdomen_cm: null,
  waist_cm: null,
  hip_cm: null,
  arm_cm: null,
  thigh_cm: null,
  calf_cm: null,
  body_fat_pct: null,
  muscle_mass_kg: null,
  fat_mass_kg: null,
  body_water_pct: null,
  bone_mass_kg: null,
  skinfolds: {},
  custom: [],
  source: null,
  notes: null,
  ...over,
})

describe('contas de medidas', () => {
  it('calcula IMC e razões; sem dado devolve null', () => {
    expect(bmi(70, 170)).toBe(24.2)
    expect(bmi(null, 170)).toBeNull()
    expect(waistHipRatio(80, 100)).toBe(0.8)
    expect(waistHeightRatio(80, 160)).toBe(0.5)
    expect(waistHipRatio(80, null)).toBeNull()
  })

  it('diferença e variação percentual entre avaliações', () => {
    expect(diff(68.5, 70)).toBe(-1.5)
    expect(percentVariation(63, 70)).toBe(-10)
    expect(diff(null, 70)).toBeNull()
    expect(percentVariation(60, 0)).toBeNull()
  })

  it('usa a última altura informada e nunca inventa composição corporal', () => {
    const list = [base({ height_cm: 170 }), base({ assessed_on: '2026-02-01', weight_kg: 70 })]
    expect(heightAt(list, 1)).toBe(170)
    const d = derive(list[1], heightAt(list, 1))
    expect(d.bmi).toBe(24.2)
    expect(list[1].body_fat_pct).toBeNull()
  })
})

describe('datas', () => {
  it('idade em anos completos', () => {
    expect(ageFrom('1990-06-15', new Date(2026, 5, 14))).toBe(35)
    expect(ageFrom('1990-06-15', new Date(2026, 5, 15))).toBe(36)
    expect(ageFrom(null)).toBeNull()
  })
  it('dias entre datas', () => {
    expect(daysBetween('2026-11-01', '2026-11-18')).toBe(17)
  })
})

describe('retornos', () => {
  const c = (over: Partial<Consultation>): Consultation => ({
    id: 'c',
    patient_id: 'p',
    kind: 'consulta',
    status: 'realizada',
    scheduled_on: '2026-09-01',
    scheduled_time: null,
    evolution: null,
    next_return_on: null,
    ...over,
  })
  it('retorno marcado vencido ou última consulta antiga pedem retorno', () => {
    expect(needsReturn([c({ next_return_on: '2026-10-01' })], '2026-11-18')).toBe(true)
    expect(needsReturn([c({ next_return_on: '2026-12-01' })], '2026-11-18')).toBe(false)
    expect(needsReturn([c({})], '2026-11-18')).toBe(true)
  })
  it('consulta já agendada à frente não pede retorno; sem consulta feita também não', () => {
    expect(needsReturn([c({}), c({ status: 'agendada', scheduled_on: '2026-11-25' })], '2026-11-18')).toBe(false)
    expect(needsReturn([], '2026-11-18')).toBe(false)
  })
})
