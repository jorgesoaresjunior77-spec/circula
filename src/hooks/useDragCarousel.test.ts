import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { createElement } from 'react'
import { useDragCarousel } from './useDragCarousel'

/**
 * Etapa (ajuste mobile — encaixe de 3 cards) — testa a lógica de
 * ENCAIXE EM SLOT do `useDragCarousel` (ver comentário no topo do
 * hook): depois que a rolagem de origem TOQUE para de disparar
 * eventos `scroll` por `SETTLE_DEBOUNCE_MS`, `settle()` deve arredondar
 * `scrollLeft` para o múltiplo mais próximo da largura de UM card+gap
 * (medida no DOM), nunca deixando a faixa parada com um card cortado.
 *
 * jsdom não faz layout real — `offsetLeft`/`clientWidth`/`scrollWidth`
 * são todos 0 por padrão. Em vez de fingir um layout completo (frágil
 * e indireto), este arquivo define esses valores diretamente via
 * `Object.defineProperty` nos nós reais (anexados por uma árvore JSX
 * mínima, para que os refs do hook já estejam preenchidos quando os
 * efeitos rodam — a mesma ordem de commit do React nos componentes de
 * produção). `PointerEvent`/`scroll` são simulados como `Event`
 * comuns com as propriedades que os handlers de fato leem
 * (`pointerType`/`pointerId`/`clientX`/`button`) — suficiente, já que
 * nenhum handler depende de nenhuma outra API de `PointerEvent`.
 */

/** Captura o callback passado ao `ResizeObserver` para poder disparar um
 *  "remeasure" manualmente, DEPOIS de `stubLayout` — o hook mede no
 *  `useLayoutEffect` inicial (síncrono, antes do teste ter chance de
 *  injetar `offsetLeft`/`clientWidth`/etc. no jsdom, que não calcula
 *  layout nenhum sozinho), então a 1ª medição sempre vê zeros. Chamar
 *  o callback de novo replica exatamente o que o `ResizeObserver` real
 *  faria ao notar uma mudança de tamanho. */
let resizeCallback: (() => void) | null = null
class ResizeObserverStub {
  constructor(cb: () => void) {
    resizeCallback = cb
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** Sequência com `itemCount` itens de SLOT px cada (largura+gap já
 *  somados no espaçamento de `offsetLeft`), mais `copies - 1` cópias
 *  idênticas (ciclo contínuo) — `offsetLeft` de cada cópia é um
 *  múltiplo exato de `seqWidth = itemCount * SLOT`. */
const SLOT = 120
const ITEM_COUNT = 5
const SEQ_WIDTH = ITEM_COUNT * SLOT // 600
const VIEWPORT_WIDTH = 300 // 300/120 = cabem 2,5 cards — sobra "cortado" se não encaixar

function TestCarousel({ copies }: { copies: number }) {
  const { viewportRef, seqRef } = useDragCarousel(ITEM_COUNT)
  return createElement(
    'div',
    { ref: viewportRef, 'data-testid': 'viewport' },
    Array.from({ length: copies }, (_, seqIndex) =>
      createElement(
        'ul',
        { key: seqIndex, ref: seqIndex === 0 ? seqRef : undefined, 'data-testid': `seq-${seqIndex}` },
        Array.from({ length: ITEM_COUNT }, (_, i) => createElement('li', { key: i })),
      ),
    ),
  )
}

/** Aplica as medidas estáticas que o jsdom não calcula sozinho — chamada
 *  DEPOIS do render, antes de disparar qualquer evento. Força `loop`
 *  (3 cópias já renderizadas, mesmo padrão de produção). Termina
 *  disparando o `resizeCallback` capturado, pra forçar o hook a medir
 *  de novo com estes valores (a 1ª medição, no render, só viu zeros). */
function stubLayout(viewport: HTMLElement) {
  // Chamadas que o jsdom não implementa, mas que os handlers de mouse
  // (não exercitados pelos testes de toque, mas sempre registrados)
  // invocam incondicionalmente num `pointerup` com `activePointer`
  // correspondente.
  Object.assign(viewport, {
    hasPointerCapture: () => false,
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
  })

  Object.defineProperty(viewport, 'clientWidth', { value: VIEWPORT_WIDTH, configurable: true })
  // scrollLeft não é implementado como propriedade "de verdade" com
  // efeito colateral no jsdom — guarda o valor manualmente.
  let scrollLeftValue = SEQ_WIDTH // começa centrado na cópia do meio, como useLayoutEffect faz
  Object.defineProperty(viewport, 'scrollLeft', {
    get: () => scrollLeftValue,
    set: (v: number) => {
      scrollLeftValue = v
    },
    configurable: true,
  })
  Object.defineProperty(viewport, 'scrollWidth', { value: SEQ_WIDTH * 3, configurable: true })

  const seqs = viewport.querySelectorAll('ul')
  seqs.forEach((seq, seqIndex) => {
    Object.defineProperty(seq, 'offsetLeft', { value: seqIndex * SEQ_WIDTH, configurable: true })
    Object.defineProperty(seq, 'getBoundingClientRect', {
      value: () => ({ width: SEQ_WIDTH, left: 0, right: 0, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON() {} }),
      configurable: true,
    })
    const items = seq.querySelectorAll('li')
    items.forEach((item, i) => {
      Object.defineProperty(item, 'offsetLeft', { value: seqIndex * SEQ_WIDTH + i * SLOT, configurable: true })
    })
  })

  // Força o hook a medir de novo agora que os valores acima existem —
  // a 1ª medição (síncrona, no mount) só viu zeros. `act()` porque
  // `measure()` chama `setLoop`, fora de qualquer evento do React.
  act(() => {
    resizeCallback?.()
  })
}

function touchPointerEvent(type: string, overrides: Partial<{ pointerId: number }> = {}): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'pointerType', { value: 'touch' })
  Object.defineProperty(event, 'pointerId', { value: overrides.pointerId ?? 1 })
  return event
}

function scrollEvent(): Event {
  return new Event('scroll', { bubbles: false })
}

/** Matcher de `window.matchMedia` controlável por teste — `hover:hover`
 *  sempre falso (nunca é mouse/desktop nestes testes, então o autoplay
 *  nunca liga e não interfere); `prefers-reduced-motion` configurável. */
function stubMatchMedia(reducedMotion: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
}

describe('useDragCarousel — encaixe em slot ao soltar o toque (ajuste mobile)', () => {
  beforeEach(() => {
    resizeCallback = null
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.useFakeTimers()
    // rAF dirigido pelos fake timers (padrão comum para animações em
    // teste): cada quadro avança ~16ms de tempo fake, sem depender do
    // relógio real.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16) as unknown as number,
    )
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  })

  afterEach(() => {
    cleanup()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('depois que a inércia do toque assenta, encaixa scrollLeft num múltiplo exato do slot (card + gap)', () => {
    stubMatchMedia(false)
    const { container } = render(createElement(TestCarousel, { copies: 3 }))
    const viewport = container.querySelector('[data-testid="viewport"]') as HTMLElement
    stubLayout(viewport)

    // Toque: encosta, "arrasta" (simulado só pelos eventos de scroll
    // nativo, como o toque real dispara), solta — pousando fora de um
    // múltiplo de SLOT (ex.: 650 = 600 + 50, "meio card" cortado).
    viewport.dispatchEvent(touchPointerEvent('pointerdown'))
    viewport.scrollLeft = 650
    viewport.dispatchEvent(scrollEvent())
    viewport.dispatchEvent(touchPointerEvent('pointerup'))

    // Ainda não assentou — nenhum timer disparou.
    expect(viewport.scrollLeft).toBe(650)

    vi.advanceTimersByTime(140) // SETTLE_DEBOUNCE_MS
    vi.advanceTimersByTime(260) // SETTLE_DURATION_MS — anima até o fim

    // 650 está entre 600 (5º slot) e 720 (6º) — mais perto de 600? não,
    // mais perto de 720 (diferença 70 vs 50)... na verdade 650-600=50,
    // 720-650=70 => mais perto de 600. Math.round(650/120)=round(5.41)=5 => 5*120=600.
    expect(viewport.scrollLeft).toBe(600)
  })

  it('não deixa um card cortado: o resultado final é SEMPRE um múltiplo exato do slot', () => {
    stubMatchMedia(false)
    const { container } = render(createElement(TestCarousel, { copies: 3 }))
    const viewport = container.querySelector('[data-testid="viewport"]') as HTMLElement
    stubLayout(viewport)

    viewport.dispatchEvent(touchPointerEvent('pointerdown'))
    viewport.scrollLeft = 674 // propositalmente não-alinhado
    viewport.dispatchEvent(scrollEvent())
    viewport.dispatchEvent(touchPointerEvent('pointerup'))

    vi.advanceTimersByTime(140)
    vi.advanceTimersByTime(260)

    expect(viewport.scrollLeft % SLOT).toBe(0)
  })

  it('já alinhado ao soltar, não corrige nada (sem correção redundante)', () => {
    stubMatchMedia(false)
    const { container } = render(createElement(TestCarousel, { copies: 3 }))
    const viewport = container.querySelector('[data-testid="viewport"]') as HTMLElement
    stubLayout(viewport)

    viewport.dispatchEvent(touchPointerEvent('pointerdown'))
    viewport.scrollLeft = 720 // já um múltiplo exato de SLOT
    viewport.dispatchEvent(scrollEvent())
    viewport.dispatchEvent(touchPointerEvent('pointerup'))

    vi.advanceTimersByTime(140)
    vi.advanceTimersByTime(260)

    expect(viewport.scrollLeft).toBe(720)
  })

  it('com prefers-reduced-motion, a correção é instantânea (sem quadros de animação)', () => {
    stubMatchMedia(true)
    const { container } = render(createElement(TestCarousel, { copies: 3 }))
    const viewport = container.querySelector('[data-testid="viewport"]') as HTMLElement
    stubLayout(viewport)

    viewport.dispatchEvent(touchPointerEvent('pointerdown'))
    viewport.scrollLeft = 650
    viewport.dispatchEvent(scrollEvent())
    viewport.dispatchEvent(touchPointerEvent('pointerup'))

    // Só o debounce (140ms) precisa passar — a correção em si não usa rAF.
    vi.advanceTimersByTime(140)

    expect(viewport.scrollLeft).toBe(600)
  })

  it('eventos de scroll repetidos (inércia ainda em andamento) adiam o encaixe — não corrige antes de assentar', () => {
    stubMatchMedia(false)
    const { container } = render(createElement(TestCarousel, { copies: 3 }))
    const viewport = container.querySelector('[data-testid="viewport"]') as HTMLElement
    stubLayout(viewport)

    viewport.dispatchEvent(touchPointerEvent('pointerdown'))
    viewport.scrollLeft = 650
    viewport.dispatchEvent(scrollEvent())
    viewport.dispatchEvent(touchPointerEvent('pointerup'))

    // Avança quase até o debounce, mas chega mais um evento de scroll
    // (inércia) antes — o timer deve reiniciar, não disparar ainda.
    vi.advanceTimersByTime(120)
    viewport.scrollLeft = 660
    viewport.dispatchEvent(scrollEvent())
    vi.advanceTimersByTime(120) // 120 < 140 desde o último scroll — ainda não assentou
    expect(viewport.scrollLeft).toBe(660)

    vi.advanceTimersByTime(20) // completa os 140ms desde o último scroll
    vi.advanceTimersByTime(260) // duração da animação
    expect(viewport.scrollLeft % SLOT).toBe(0)
  })

  it('arrasto de MOUSE nunca aciona o encaixe (preserva o comportamento de desktop)', () => {
    stubMatchMedia(false)
    const { container } = render(createElement(TestCarousel, { copies: 3 }))
    const viewport = container.querySelector('[data-testid="viewport"]') as HTMLElement
    stubLayout(viewport)

    const down = new Event('pointerdown', { bubbles: true, cancelable: true })
    Object.defineProperty(down, 'pointerType', { value: 'mouse' })
    Object.defineProperty(down, 'pointerId', { value: 2 })
    Object.defineProperty(down, 'button', { value: 0 })
    Object.defineProperty(down, 'clientX', { value: 0 })
    viewport.dispatchEvent(down)

    viewport.scrollLeft = 650
    viewport.dispatchEvent(scrollEvent())

    const up = new Event('pointerup', { bubbles: true, cancelable: true })
    Object.defineProperty(up, 'pointerId', { value: 2 })
    viewport.dispatchEvent(up)

    vi.advanceTimersByTime(140)
    vi.advanceTimersByTime(260)

    // Nenhum encaixe: o valor não-alinhado do mouse permanece intacto.
    expect(viewport.scrollLeft).toBe(650)
  })

  it('um novo toque cancela um encaixe em andamento (o dedo retoma o controle do scrollLeft)', () => {
    stubMatchMedia(false)
    const { container } = render(createElement(TestCarousel, { copies: 3 }))
    const viewport = container.querySelector('[data-testid="viewport"]') as HTMLElement
    stubLayout(viewport)

    viewport.dispatchEvent(touchPointerEvent('pointerdown'))
    viewport.scrollLeft = 650
    viewport.dispatchEvent(scrollEvent())
    viewport.dispatchEvent(touchPointerEvent('pointerup'))

    vi.advanceTimersByTime(140)
    vi.advanceTimersByTime(60) // animação em andamento, ainda não terminou (dura 220ms)

    // Novo toque no meio da correção — assume o `scrollLeft` de volta.
    viewport.dispatchEvent(touchPointerEvent('pointerdown', { pointerId: 2 }))
    viewport.scrollLeft = 610
    viewport.dispatchEvent(scrollEvent())

    // A animação cancelada não deve sobrescrever o valor do novo toque
    // nos quadros seguintes.
    vi.advanceTimersByTime(32)
    expect(viewport.scrollLeft).toBe(610)
  })
})

/** Correções visuais + carrossel (item 3) — teto de `deltaSeconds` no
 *  autoplay: se o navegador atrasar um quadro (aba sem foco, trabalho
 *  pesado na main thread), o PRÓXIMO `requestAnimationFrame` chega com
 *  um `time` bem mais distante do anterior; sem o teto, aquele único
 *  quadro tentaria avançar `AUTOPLAY_PX_PER_SEC * deltaSeconds` de uma
 *  vez — um salto visível. Aqui o `requestAnimationFrame` é capturado
 *  manualmente (sem `setTimeout`/fake timers) para poder chamar o
 *  mesmo callback com um `time` arbitrariamente distante do anterior,
 *  simulando esse atraso com precisão. */
describe('useDragCarousel — autoplay no desktop (teto de deltaSeconds por quadro)', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('depois de um quadro muito atrasado, o avanço daquele quadro fica limitado — nunca um salto de catch-up', () => {
    // hover:hover + pointer:fine true (desktop/mouse), reduced-motion
    // false -> allowMotion true, autoplay liga.
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: !query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    )
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)

    let tick: ((time: number) => void) | null = null
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      tick = cb as (time: number) => void
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    const { container } = render(createElement(TestCarousel, { copies: 3 }))
    const viewport = container.querySelector('[data-testid="viewport"]') as HTMLElement
    stubLayout(viewport) // força loop=true (3 cópias) — mesmo setup dos outros testes.

    expect(tick).not.toBeNull()

    // 1º quadro: só estabelece lastFrameTime (delta=0 — nenhum motor de
    // avanço ainda rodou).
    tick!(0)
    const afterFirstFrame = viewport.scrollLeft

    // 2º quadro: gap de 5s "reais" (bem maior que qualquer frame normal
    // a 60fps) — simula o navegador tendo pulado/atrasado quadros.
    tick!(5000)
    const advanced = viewport.scrollLeft - afterFirstFrame

    // Sem teto: 32px/s * 5s = 160px num quadro só (o salto perceptível
    // que este teste existe pra impedir). Com MAX_AUTOPLAY_FRAME_SECONDS
    // (0.05s): no máximo 32 * 0.05 = 1.6px.
    expect(advanced).toBeGreaterThan(0)
    expect(advanced).toBeLessThanOrEqual(1.6 + 1e-6)
  })
})
