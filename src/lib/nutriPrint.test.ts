import { describe, expect, it } from 'vitest'
import { assessmentHtml, esc, evolutionHtml, planHtml } from './nutriPrint'
import type { Assessment } from './nutri'
import type { Plan } from './nutriPlan'

const plan: Plan = {
  id: 'p',
  patient_id: 'x',
  name: 'Plano <b>1</b>',
  objective: 'Reeducação',
  start_date: '2026-11-01',
  review_date: null,
  kcal_target: 1800,
  protein_g_target: null,
  carb_g_target: null,
  fat_g_target: null,
  fiber_g_target: null,
  water_ml_target: 2000,
  goals: null,
  energy_estimate: null,
  notes: 'NOTA INTERNA SECRETA',
  guidance: 'Beber água',
  meals: [
    {
      id: 'm2',
      name: 'Jantar',
      time: '19:30',
      notes: '',
      items: [],
    },
    {
      id: 'm1',
      name: 'Almoço',
      time: '12:30',
      notes: '',
      items: [
        {
          id: 'i',
          kind: 'food',
          refId: null,
          name: 'Arroz',
          grams: 100,
          household: '4 colheres',
          portions: '',
          prep: '',
          note: '',
          nutrients: { kcal: 130, protein: 2.5, carb: 28, fat: 0.2, fiber: 0.4 },
          substitutions: [{ id: 's', name: 'Batata', grams: 150, household: '', note: '' }],
        },
      ],
    },
  ],
  status: 'ativo',
  shared_with_patient: true,
  created_at: '2026-11-01',
}

describe('PDF do plano', () => {
  it('escapa o que foi digitado e não vaza observações internas', () => {
    const html = planHtml(plan, 'Ana <script>', 'Marluce', '18/11/2026')
    expect(html).not.toContain('<script>')
    expect(html).toContain('Plano &lt;b&gt;1&lt;/b&gt;')
    expect(html).not.toContain('NOTA INTERNA SECRETA')
  })
  it('ordena as refeições por horário e mostra substituições', () => {
    const html = planHtml(plan, 'Ana', 'Marluce')
    expect(html.indexOf('Almoço')).toBeLessThan(html.indexOf('Jantar'))
    expect(html).toContain('Substituições: Batata')
    expect(html).toContain('Círcula')
  })
  it('esc trata nulos', () => {
    expect(esc(null)).toBe('')
    expect(esc('a&b')).toBe('a&amp;b')
  })
})

describe('PDF da avaliação e da evolução', () => {
  const base: Assessment = {
    id: 'a1', patient_id: 'p', assessed_on: '2026-10-01', weight_kg: 70, height_cm: 170, abdomen_cm: null, waist_cm: 80, hip_cm: 100,
    arm_cm: null, thigh_cm: null, calf_cm: null, body_fat_pct: null, muscle_mass_kg: null, fat_mass_kg: null, body_water_pct: null,
    bone_mass_kg: null, skinfolds: {}, custom: [], source: null, notes: null,
  }
  const second: Assessment = { ...base, id: 'a2', assessed_on: '2026-11-01', weight_kg: 68.5 }
  it('avaliação compara com a anterior', () => {
    const html = assessmentHtml(second, [base, second], 'Ana', 'Marluce')
    expect(html).toContain('-1,5')
    expect(html).toContain('Avaliação de 01/11/2026')
  })
  it('evolução lista as avaliações e as evoluções registradas', () => {
    const html = evolutionHtml([base, second], [{ id: 'c', patient_id: 'p', kind: 'consulta', status: 'realizada', scheduled_on: '2026-11-01', scheduled_time: null, evolution: 'Foi bem', next_return_on: null }], 'Ana', 'Marluce')
    expect(html).toContain('Foi bem')
    expect(html).toContain('01/10/2026')
  })
})
