import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { WaterBottleView } from './WaterBottleView'

describe('WaterBottleView — 3D ou SVG', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('sem WebGL (como no jsdom) mostra a garrafa SVG com o progresso certo', () => {
    const { container } = render(<WaterBottleView progress={0.5} />)
    expect(container.querySelector('svg.water-bottle')).not.toBeNull()
    expect(container.querySelector('.water-bottle3d')).toBeNull()
    expect(container.querySelector('[aria-label="Garrafa com 50% da meta de água do dia"]')).not.toBeNull()
  })

  it('mesmo forçando 3D, sem WebGL fica no SVG (o ajuste não ignora a falta de suporte)', () => {
    window.localStorage.setItem('circula:bottle', '3d')
    const { container } = render(<WaterBottleView progress={1} celebrating />)
    expect(container.querySelector('svg.water-bottle--celebrate')).not.toBeNull()
    expect(container.querySelector('.water-bottle3d')).toBeNull()
  })

  it('o ajuste "svg" guardado no aparelho mantém a garrafa SVG', () => {
    window.localStorage.setItem('circula:bottle', 'svg')
    const { container } = render(<WaterBottleView progress={0.25} />)
    expect(container.querySelector('svg.water-bottle')).not.toBeNull()
  })
})
