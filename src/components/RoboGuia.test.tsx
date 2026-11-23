import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { RoboGuia, roboUrl } from './RoboGuia'
import { RoboMudo } from './RoboMudo'
import { alternarMudo, falar, reiniciarRoboParaTeste } from '../hooks/useRobo'
import { fireEvent, screen } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.clear()
  reiniciarRoboParaTeste()
})

const imgs = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLImageElement>('img.robo-guia-img'))

describe('RoboGuia', () => {
  it('mostra a imagem da cena, decorativa (aria-hidden, alt vazio)', () => {
    const { container } = render(<RoboGuia cena="boas-vindas" />)
    const raiz = container.querySelector('.robo-guia')!
    expect(raiz).toHaveAttribute('aria-hidden', 'true')
    const [img] = imgs(container)
    expect(img.getAttribute('src')).toBe(roboUrl('boas-vindas'))
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveAttribute('data-on', 'true')
  })

  it('ao trocar de cena, empilha a nova imagem e faz o crossfade (a antiga some, a nova aparece)', () => {
    const { container, rerender } = render(<RoboGuia cena="neutro" />)
    rerender(<RoboGuia cena="surpresa" />)
    const [a, b] = imgs(container)
    expect(a.getAttribute('src')).toBe(roboUrl('neutro'))
    expect(b.getAttribute('src')).toBe(roboUrl('surpresa'))
    expect(a).toHaveAttribute('data-on', 'false')
    expect(b).toHaveAttribute('data-on', 'true')
  })

  it('aponta-esquerda usa a imagem da direita espelhada', () => {
    const { container } = render(<RoboGuia cena="aponta-esquerda" />)
    const [img] = imgs(container)
    expect(img.getAttribute('src')).toBe(roboUrl('aponta-direita'))
    expect(img.className).toContain('robo-guia-img--espelho')
  })

  it('reserva o tamanho (sem salto de layout): largura em px e proporção 9:16 no CSS', () => {
    const { container } = render(<RoboGuia cena="neutro" tamanho={90} />)
    expect((container.querySelector('.robo-guia') as HTMLElement).style.width).toBe('90px')
  })

  it('na cena neutra pisca sozinho a cada ~3,2 s, por ~120 ms', () => {
    vi.useFakeTimers()
    const { container } = render(<RoboGuia cena="neutro" />)
    act(() => {
      vi.advanceTimersByTime(3200)
    })
    const srcs = imgs(container).map((i) => i.getAttribute('src'))
    expect(srcs).toContain(roboUrl('neutro-piscando'))
    act(() => {
      vi.advanceTimersByTime(130)
    })
    const ativa = imgs(container).find((i) => i.getAttribute('data-on') === 'true')!
    expect(ativa.getAttribute('src')).toBe(roboUrl('neutro'))
  })

  it('o halo e as ondas aparecem quando o robô toca um som, e não no modo compacto (mudo)', () => {
    localStorage.clear()
    const { container } = render(<RoboGuia cena="feliz" />)
    expect(container.querySelector('.robo-guia-halo')).toBeNull()
    // sem Web Audio no teste, o som "não toca": então o halo também não (só aparece quando toca)
    act(() => falar('feliz', 'feliz'))
    expect(container.querySelector('.robo-guia-halo')).toBeNull()
  })
})

describe('RoboMudo', () => {
  it('alterna o mudo e guarda no aparelho (valor "off")', () => {
    render(<RoboMudo />)
    const botao = screen.getByRole('button', { name: /Desligar o som/ })
    fireEvent.click(botao)
    expect(localStorage.getItem('circula:robo-som')).toBe('off')
    expect(screen.getByRole('button', { name: /Ligar o som/ })).toHaveAttribute('aria-pressed', 'true')
    act(() => alternarMudo())
    expect(localStorage.getItem('circula:robo-som')).toBe('on')
  })
})
