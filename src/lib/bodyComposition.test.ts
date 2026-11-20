import { describe, it, expect } from 'vitest'
import {
  classifyBmi,
  classifyBodyFat,
  classifyWaist,
  classifyWhr,
  computeBodyComposition,
  navyBodyFat,
  siriBodyFat,
} from './bodyComposition'

describe('Siri (1961)', () => {
  it('densidade 1,05 g/cm³ dá cerca de 21,4% de gordura', () => {
    expect(siriBodyFat(1.05)).toBeCloseTo(21.43, 1)
  })
})

describe('computeBodyComposition', () => {
  it('Jackson-Pollock-Ward 3 dobras (mulher, 30 anos, soma 60 mm) ≈ 24,1%', () => {
    const r = computeBodyComposition({
      protocol: 'jp3',
      sex: 'F',
      age: 30,
      weightKg: 65,
      heightCm: 165,
      skinfolds: { triceps: 20, suprailiaca: 15, coxa: 25 },
      circumferences: {},
    })
    expect(r?.density).toBeCloseTo(1.044, 3)
    expect(r?.bodyFatPct).toBeCloseTo(24.1, 1)
    expect(r?.fatMassKg).toBeCloseTo(15.7, 1)
    expect(r?.leanMassKg).toBeCloseTo(49.3, 1)
  })

  it('Jackson-Pollock 3 dobras (homem, 30 anos, soma 60 mm) ≈ 17,9%', () => {
    const r = computeBodyComposition({
      protocol: 'jp3',
      sex: 'M',
      age: 30,
      weightKg: 80,
      heightCm: 178,
      skinfolds: { peitoral: 15, abdominal: 25, coxa: 20 },
      circumferences: {},
    })
    expect(r?.bodyFatPct).toBeCloseTo(17.9, 1)
  })

  it('Jackson-Pollock-Ward 7 dobras (mulher, 30 anos, soma 120 mm) ≈ 23,8%', () => {
    const r = computeBodyComposition({
      protocol: 'jp7',
      sex: 'F',
      age: 30,
      weightKg: null,
      heightCm: null,
      skinfolds: { peitoral: 10, axilar: 12, triceps: 20, subescapular: 18, abdominal: 25, suprailiaca: 15, coxa: 20 },
      circumferences: {},
    })
    expect(r?.bodyFatPct).toBeCloseTo(23.8, 1)
    expect(r?.fatMassKg).toBeNull()
  })

  it('Durnin-Womersley (mulher, 25 anos, soma 60 mm) ≈ 29,5%', () => {
    const r = computeBodyComposition({
      protocol: 'dw4',
      sex: 'F',
      age: 25,
      weightKg: null,
      heightCm: null,
      skinfolds: { biceps: 10, triceps: 18, subescapular: 17, suprailiaca: 15 },
      circumferences: {},
    })
    expect(r?.bodyFatPct).toBeCloseTo(29.5, 1)
  })

  it('Marinha dos EUA (mulher 165 cm, pescoço 33, cintura 75, quadril 98) ≈ 28,4%', () => {
    expect(navyBodyFat('F', 165, 33, 75, 98)).toBeCloseTo(28.4, 1)
    const r = computeBodyComposition({
      protocol: 'navy',
      sex: 'F',
      age: 35,
      weightKg: 60,
      heightCm: 165,
      skinfolds: {},
      circumferences: { pescoco: 33, cintura: 75, quadril: 98 },
    })
    expect(r?.bodyFatPct).toBeCloseTo(28.4, 1)
  })

  it('devolve null quando falta alguma dobra do protocolo', () => {
    expect(
      computeBodyComposition({ protocol: 'jp3', sex: 'F', age: 30, weightKg: 60, heightCm: 160, skinfolds: { triceps: 20, suprailiaca: 15 }, circumferences: {} }),
    ).toBeNull()
  })

  it('avisa quando a idade está fora da faixa validada', () => {
    const r = computeBodyComposition({
      protocol: 'jp3',
      sex: 'F',
      age: 70,
      weightKg: 60,
      heightCm: 160,
      skinfolds: { triceps: 20, suprailiaca: 15, coxa: 25 },
      circumferences: {},
    })
    expect(r?.warnings.join(' ')).toMatch(/18 a 55/)
  })
})

describe('classificações de referência', () => {
  it('% de gordura feminino (ACE)', () => {
    expect(classifyBodyFat('F', 12)).toBe('Gordura essencial')
    expect(classifyBodyFat('F', 18)).toBe('Atlética')
    expect(classifyBodyFat('F', 23)).toBe('Em forma')
    expect(classifyBodyFat('F', 28)).toBe('Média')
    expect(classifyBodyFat('F', 35)).toBe('Elevada (obesidade)')
  })
  it('cintura (OMS) e relação cintura/quadril', () => {
    expect(classifyWaist('F', 79)).toBe('Sem aumento de risco')
    expect(classifyWaist('F', 80)).toBe('Risco aumentado')
    expect(classifyWaist('F', 88)).toBe('Risco muito aumentado')
    expect(classifyWhr('F', 0.84)).toBe('Dentro do limite da OMS')
    expect(classifyWhr('F', 0.85)).toBe('Acima do limite da OMS')
  })
  it('IMC (OMS)', () => {
    expect(classifyBmi(18)).toBe('Abaixo do peso')
    expect(classifyBmi(22)).toBe('Peso normal')
    expect(classifyBmi(27)).toBe('Sobrepeso')
    expect(classifyBmi(32)).toBe('Obesidade grau I')
  })
})
