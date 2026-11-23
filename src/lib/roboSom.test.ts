import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CHAVE_MUDO, GANHO_MESTRE, RECEITAS, gravarMudo, lerMudo, sintetizarSom, tocarSom } from './roboSom'
import type { RoboSom } from './roboSom'

const SR = 44100

describe('roboSom: síntese', () => {
  const nomes = Object.keys(RECEITAS) as RoboSom[]

  it('tem as 11 receitas pedidas', () => {
    expect(nomes.sort()).toEqual(['apontando', 'assinatura', 'boasvindas', 'comemoracao', 'feliz', 'obrigado', 'oops', 'pedindo', 'pensando', 'piscadinha', 'surpresa'])
  })

  it.each(nomes)('%s gera amostras e normaliza o pico em 0,85', (nome) => {
    const amostras = sintetizarSom(nome, SR)
    expect(amostras.length).toBeGreaterThan(0)
    let pico = 0
    for (const v of amostras) pico = Math.max(pico, Math.abs(v))
    expect(pico).toBeCloseTo(0.85, 3)
  })

  it('a duração é a soma das notas e dos silêncios', () => {
    // feliz: 0,11 + 0,03 + 0,16 = 0,30 s
    expect(sintetizarSom('feliz', SR).length).toBeCloseTo(0.3 * SR, -1)
    // apontando: uma nota de 0,10 s
    expect(sintetizarSom('apontando', SR).length).toBe(Math.round(0.1 * SR))
  })

  it('o silêncio entre as notas fica em zero', () => {
    const amostras = sintetizarSom('feliz', SR)
    const meio = Math.round(0.125 * SR) // dentro do silêncio de 0,03 s (0,11 a 0,14)
    expect(amostras[meio]).toBe(0)
  })

  it('começa e termina suave (envelope)', () => {
    const amostras = sintetizarSom('apontando', SR)
    expect(Math.abs(amostras[0])).toBeLessThan(0.05)
    expect(Math.abs(amostras[amostras.length - 1])).toBeLessThan(0.05)
  })
})

describe('roboSom: reprodução e mudo', () => {
  let criados = 0
  let iniciados = 0

  beforeEach(() => {
    criados = 0
    iniciados = 0
    localStorage.clear()
    class FakeAudioContext {
      state = 'running'
      sampleRate = SR
      destination = {}
      constructor() {
        criados += 1
      }
      createBuffer(_c: number, length: number) {
        return { length, copyToChannel: vi.fn() }
      }
      createBufferSource() {
        return { buffer: null, connect: vi.fn(), start: () => (iniciados += 1) }
      }
      createGain() {
        return { gain: { value: 0 }, connect: vi.fn() }
      }
      resume() {
        return Promise.resolve()
      }
    }
    ;(window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext
  })

  afterEach(() => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext
  })

  it('toca o som e usa o ganho mestre baixo', () => {
    expect(GANHO_MESTRE).toBeLessThanOrEqual(0.5)
    expect(tocarSom('feliz', false)).toBe(true)
    expect(iniciados).toBe(1)
  })

  it('no mudo não toca nada', () => {
    expect(tocarSom('feliz', true)).toBe(false)
    expect(iniciados).toBe(0)
  })

  it('o mudo fica guardado no aparelho (padrão: ligado)', () => {
    expect(lerMudo()).toBe(false)
    gravarMudo(true)
    expect(localStorage.getItem(CHAVE_MUDO)).toBe('off')
    expect(lerMudo()).toBe(true)
    expect(tocarSom('oops')).toBe(false) // lê o mudo guardado
    gravarMudo(false)
    expect(lerMudo()).toBe(false)
  })

  it('reaproveita o mesmo AudioContext', () => {
    tocarSom('feliz', false)
    tocarSom('oops', false)
    expect(criados).toBeLessThanOrEqual(1)
  })

  it('sem Web Audio, não falha', () => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext
    // o contexto já criado acima pode estar em cache; o importante é não lançar erro
    expect(() => tocarSom('pedindo', false)).not.toThrow()
  })
})
