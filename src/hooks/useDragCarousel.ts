import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

// Rolagem infinita dos carrosséis horizontais da capa
// (HomeExperienceStrip · "Seu Círcula de Hoje" e HomeCirclesSection ·
// "Círculos"). Uma implementação só, compartilhada pelas duas faixas.
//
// Movimento automático (marquee) — pedido explícito do usuário, e só
// no DESKTOP: os cards avançam sozinhos, sempre no mesmo sentido
// (nunca vaivém), e pausam enquanto o mouse estiver sobre a faixa,
// retomando quando ele sai. No MOBILE não existe movimento automático
// nenhum — só o toque/arrasto manual move os cards (ver `allowMotion`:
// o gate é por tipo de ponteiro, `hover:hover` + `pointer:fine`, não
// por largura de tela — um touch screen largo continua sem autoplay, e
// uma janela de desktop estreita continua com ele). Roda via
// `requestAnimationFrame` incrementando `scrollLeft` a um ritmo fixo
// (px/s, independente do framerate) — NUNCA a mesma causa do bug antigo
// de cards duplicados (aquele era um `exp-seq` clonado fora do
// mecanismo de ciclo abaixo, sem o `wrap()` que mantém a cópia visível
// sempre centrada). Aqui o autoplay só gira o MESMO `scrollLeft` que o
// arrasto/scroll nativo já usa, e chama o mesmo `wrap()` — por isso
// nunca há duas cópias visíveis ao mesmo tempo. Desliga por completo
// quando a sequência cabe inteira na viewport (`loop` falso — não há
// para onde avançar) e quando a pessoa prefere menos movimento
// (`prefers-reduced-motion: reduce`). A pausa por toque (`onTouchStart`/
// `onTouchEnd`) fica no código mesmo assim — cobre o caso raro de um
// notebook com tela touch E mouse, onde o autoplay está ativo.
//
// O que mudou e por quê (ciclo contínuo, herdado da versão anterior):
//   · Ciclo contínuo nos DOIS sentidos: a sequência é renderizada 3x e
//     a posição de rolagem é mantida sempre na cópia do meio. Ao passar
//     de meia sequência para qualquer lado, somamos/subtraímos
//     exatamente a largura de uma sequência — como as três são
//     idênticas, o reposicionamento é invisível e nunca existe uma
//     borda dura ("fim abrupto") de nenhum dos lados.
//   · O ciclo só liga quando a sequência REALMENTE excede a viewport
//     (`loop`). Enquanto todos os cards couberem na tela, não há cópia
//     nenhuma no DOM — é por isso que não aparece card repetido: com o
//     loop ligado, uma cópia nunca cabe junto do seu original dentro da
//     área visível.
//   · Arrasto com o mouse no desktop (Pointer Events, só `mouse`): o
//     toque continua com a rolagem NATIVA do navegador, que já tem
//     inércia e é melhor do que qualquer reimplementação.
//   · Depois de arrastar, o clique seguinte é engolido (capture) — não
//     se abre um card por acidente ao soltar o mouse em cima dele.
//
// Tudo roda sobre o `scrollLeft` nativo do contêiner (nunca
// `transform`), então rolagem por roda, trackpad, swipe e teclado
// continuam funcionando sem concorrência, e os cards seguem sendo
// botões/links normais, focáveis por Tab.
//
// Encaixe em slot ao soltar o toque (ajuste mobile) — o scroll nativo
// por toque (swipe) não tinha NENHUM assentamento: a rolagem com
// inércia do navegador podia parar em qualquer ponto, inclusive com um
// card cortado pela metade. `scroll-snap` nativo não serve aqui — já
// está desligado de propósito enquanto o ciclo contínuo está ativo
// (`.exp-viewport--looping`, ver App.css), porque ele disputaria o
// mesmo `scrollLeft` que o `wrap()` abaixo também escreve a cada
// instante, causando o salto visível que o CSS já documenta. Em vez
// disso, o PRÓPRIO `wrap()`/`scrollLeft` é reaproveitado: depois que os
// eventos `scroll` de origem TOUCH páram de chegar por
// `SETTLE_DEBOUNCE_MS` (sinal de que a inércia nativa já assentou),
// `settle()` arredonda a posição atual para o múltiplo mais próximo de
// `cardSlotRef` (a largura real de UM card + gap, medida no DOM) e
// anima uma correção curta até lá — nunca um salto abrupto, nunca mais
// de uma correção por gesto (o debounce reseta a cada evento `scroll`
// enquanto a inércia ainda está rolando). Só gestos de TOQUE acionam
// isto (`lastPointerType`) — arrasto de mouse e autoplay no desktop
// continuam exatamente como eram, sem nenhum assentamento.

/** Distância (px) a partir da qual o gesto é arrasto, não clique. */
const DRAG_THRESHOLD = 4

/** Ritmo do avanço automático — calmo, não deve parecer "correria". */
const AUTOPLAY_PX_PER_SEC = 32

/** Pausa residual (ms) após soltar o toque, antes de retomar — dá tempo
 *  da inércia nativa do swipe (scroll momentum) assentar, evitando que
 *  o autoplay e a inércia disputem o mesmo `scrollLeft` ao mesmo tempo. */
const RESUME_AFTER_TOUCH_MS = 400

/** Tempo (ms) sem nenhum evento `scroll` de origem touch até considerar
 *  a inércia do swipe assentada e tentar o encaixe no slot mais
 *  próximo. Curto o bastante para não parecer um atraso, longo o
 *  bastante para não disparar no meio da rolagem com inércia ainda em
 *  andamento (que dispara eventos `scroll` com bem menos intervalo que
 *  isto entre si). */
const SETTLE_DEBOUNCE_MS = 140

/** Duração (ms) da animação de encaixe no slot — curta e suave, nunca
 *  um salto; ignorada (correção instantânea) quando `prefers-reduced-
 *  motion: reduce`. */
const SETTLE_DURATION_MS = 220

/** Teto (s) do `deltaSeconds` de UM quadro do autoplay — proteção
 *  contra "salto de catch-up": se o navegador atrasar/pular quadros
 *  (aba perdendo foco, trabalho pesado na main thread, GC), o próximo
 *  `requestAnimationFrame` chega com um `time` bem mais distante do
 *  anterior, e sem este teto o avanço daquele ÚNICO quadro
 *  (`AUTOPLAY_PX_PER_SEC * deltaSeconds`) tentaria compensar todo o
 *  tempo perdido de uma vez — um salto visível, abrupto, exatamente o
 *  tipo de movimento brusco que o autoplay nunca deve ter. Com o teto,
 *  o pior caso é o avanço ficar mais lento por alguns quadros (nunca
 *  mais rápido/saltado) até a cadência normal retomar. */
const MAX_AUTOPLAY_FRAME_SECONDS = 0.05

export interface DragCarousel {
  /** Contêiner que rola (`overflow-x: auto`). */
  viewportRef: RefObject<HTMLDivElement | null>
  /** Primeira sequência de cards — a real; as demais são cópias. */
  seqRef: RefObject<HTMLUListElement | null>
  /** Ligado só quando a sequência excede a viewport. */
  loop: boolean
  /** Arrasto de mouse em andamento (para o cursor e o `user-select`). */
  dragging: boolean
}

export function useDragCarousel(itemCount: number): DragCarousel {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const seqRef = useRef<HTMLUListElement | null>(null)
  /** Largura de uma sequência + a folga até a próxima (0 = sem ciclo). */
  const loopWidthRef = useRef(0)
  /** Largura real de UM card + o gap até o próximo, medida no DOM (0 =
   *  ainda não medida, ou sequência curta demais para ter 2 itens).
   *  Usada só pelo encaixe em slot do toque (`settle`, no efeito
   *  principal abaixo) — nunca pelo layout em si. */
  const cardSlotRef = useRef(0)
  const centeredRef = useRef(false)
  const [loop, setLoop] = useState(false)
  const [dragging, setDragging] = useState(false)
  /** Espelha `loop` em ref — o efeito do autoplay roda uma única vez
   *  (deps `[]`, junto do arrasto) e precisa ler o valor mais recente
   *  dentro do próprio `requestAnimationFrame`, sem recriar listeners a
   *  cada vez que `loop` muda. */
  const loopRef = useRef(false)
  /** Autoplay pausado — mouse sobre a faixa (desktop) ou dedo tocando
   *  (mobile). Ref, não estado: muda a cada quadro potencialmente, não
   *  precisa (e não deve) re-renderizar o componente. */
  const pausedRef = useRef(false)

  useEffect(() => {
    loopRef.current = loop
  }, [loop])

  // Medida: a sequência excede a viewport? É o único gatilho do ciclo
  // (e, portanto, das cópias no DOM). Quando liga, a posição inicial
  // vai para o começo da 2ª cópia — visualmente idêntico ao começo da
  // faixa, mas com uma sequência inteira de folga à esquerda.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const seq = seqRef.current
    if (!viewport || !seq) return

    const measure = () => {
      // Largura real de UM card + gap (slot), a partir dos 2 primeiros
      // itens da sequência REAL — sempre que houver pelo menos 2, ciclo
      // ligado ou não (um valor "sem ciclo" ainda pode precisar de
      // encaixe: sequência maior que a viewport, mas não o bastante
      // pra disparar o ciclo contínuo). Com 0 ou 1 item não há slot
      // nenhum pra encaixar (nunca cabe "cortado") — fica 0, e o
      // `settle()` do efeito principal simplesmente não faz nada.
      const items = seq.children
      cardSlotRef.current =
        items.length >= 2
          ? (items[1] as HTMLElement).offsetLeft - (items[0] as HTMLElement).offsetLeft
          : 0

      const seqWidth = seq.getBoundingClientRect().width
      if (seqWidth <= viewport.clientWidth + 8) {
        loopWidthRef.current = 0
        centeredRef.current = false
        setLoop(false)
        return
      }

      setLoop(true)
      // As cópias só existem no render seguinte ao `setLoop(true)`;
      // este efeito roda de novo (depende de `loop`) e aí mede.
      const second = seq.nextElementSibling as HTMLElement | null
      if (!second) return

      const width = second.offsetLeft - seq.offsetLeft
      if (width <= 0) return
      loopWidthRef.current = width
      if (!centeredRef.current) {
        centeredRef.current = true
        viewport.scrollLeft = width
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(seq)
    return () => observer.disconnect()
  }, [itemCount, loop])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    // Mantém a posição na cópia do meio. Como o salto é de exatamente
    // uma sequência, o conteúdo sob o ponteiro não muda — o olho não vê
    // nada acontecer.
    const wrap = () => {
      const width = loopWidthRef.current
      if (width <= 0) return
      const position = viewport.scrollLeft
      if (position < width * 0.5) viewport.scrollLeft = position + width
      else if (position > width * 1.5) viewport.scrollLeft = position - width
    }

    let activePointer: number | null = null
    let lastX = 0
    let travelled = 0
    let swallowClick = false
    let resumeTimer: ReturnType<typeof setTimeout> | null = null

    // Encaixe em slot (ajuste mobile) — ver bloco de comentários no topo
    // do arquivo. `lastPointerType` distingue o gesto que está movendo o
    // `scrollLeft` agora (ou que moveu por último): só 'touch' arma o
    // encaixe; nunca 'mouse' (preserva o arrasto/autoplay do desktop
    // intactos). `touchDown` — dedo ainda na tela: enquanto for true,
    // nunca tenta encaixar (evita "puxar" o conteúdo de sob o dedo).
    let lastPointerType: 'mouse' | 'touch' | null = null
    let touchDown = false
    let settleTimer: ReturnType<typeof setTimeout> | null = null
    let snapRafId: number | null = null
    let isSnapping = false

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const cancelSnap = () => {
      if (snapRafId !== null) {
        cancelAnimationFrame(snapRafId)
        snapRafId = null
      }
      isSnapping = false
    }

    const clearSettleTimer = () => {
      if (settleTimer !== null) {
        clearTimeout(settleTimer)
        settleTimer = null
      }
    }

    // Arredonda a posição atual para o slot (card + gap) mais próximo e
    // anima uma correção curta até lá. `cardSlotRef` é medido no DOM
    // (measure(), acima) — reflete a largura REAL de um card em
    // qualquer breakpoint, nunca um valor calculado às cegas aqui.
    // Limitado a `[0, scrollWidth - clientWidth]`: nunca cria espaço
    // vazio depois do último card (relevante quando `loop` é falso —
    // com o ciclo ligado, `wrap()` já mantém a posição bem longe desses
    // extremos na prática).
    const settle = () => {
      const slot = cardSlotRef.current
      if (slot <= 0 || activePointer !== null || touchDown) return

      const current = viewport.scrollLeft
      const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
      let target = Math.round(current / slot) * slot
      target = Math.max(0, Math.min(target, maxScrollLeft))

      const delta = target - current
      if (Math.abs(delta) < 0.5) return

      cancelSnap()
      isSnapping = true

      if (prefersReducedMotion) {
        viewport.scrollLeft = target
        wrap()
        isSnapping = false
        return
      }

      const startTime = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / SETTLE_DURATION_MS)
        const eased = 1 - (1 - t) ** 3 // ease-out cúbico — some movimento brusco no final
        viewport.scrollLeft = current + delta * eased
        wrap()
        if (t < 1) {
          snapRafId = requestAnimationFrame(step)
        } else {
          snapRafId = null
          isSnapping = false
        }
      }
      snapRafId = requestAnimationFrame(step)
    }

    const armSettle = () => {
      clearSettleTimer()
      settleTimer = setTimeout(settle, SETTLE_DEBOUNCE_MS)
    }

    const pauseAutoplay = () => {
      if (resumeTimer !== null) {
        clearTimeout(resumeTimer)
        resumeTimer = null
      }
      pausedRef.current = true
    }

    const resumeAutoplay = (delayMs = 0) => {
      if (resumeTimer !== null) clearTimeout(resumeTimer)
      if (delayMs <= 0) {
        pausedRef.current = false
        return
      }
      resumeTimer = setTimeout(() => {
        pausedRef.current = false
        resumeTimer = null
      }, delayMs)
    }

    // Desktop: o mouse só precisa estar sobre a faixa, sem precisar
    // clicar, para pausar o avanço automático.
    const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') pauseAutoplay()
    }
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') resumeAutoplay()
    }

    // Mobile: o toque pausa ao encostar o dedo; ao soltar, dá uma folga
    // (RESUME_AFTER_TOUCH_MS) antes de retomar, pra não disputar o
    // `scrollLeft` com a inércia do swipe que o navegador continua
    // aplicando por conta própria depois do dedo já ter saído.
    const onTouchStart = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      pauseAutoplay()
      lastPointerType = 'touch'
      touchDown = true
      // Novo toque: qualquer encaixe pendente ou em andamento do gesto
      // anterior para agora — o dedo assume o `scrollLeft` de volta.
      clearSettleTimer()
      cancelSnap()
    }
    const onTouchEnd = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      resumeAutoplay(RESUME_AFTER_TOUCH_MS)
      touchDown = false
      // Arma já aqui (não só via onScroll): se o dedo soltar sem
      // nenhuma inércia residual, pode não vir mais nenhum evento
      // `scroll` — sem isto, o encaixe nunca seria tentado nesse caso.
      armSettle()
    }

    const onPointerDown = (event: PointerEvent) => {
      // Toque e caneta: rolagem nativa (com inércia). Só o mouse, que
      // não tem gesto de arrasto próprio, é tratado aqui.
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      lastPointerType = 'mouse'
      activePointer = event.pointerId
      lastX = event.clientX
      travelled = 0
      swallowClick = false
      setDragging(true)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (activePointer !== event.pointerId) return
      const dx = event.clientX - lastX
      lastX = event.clientX
      travelled += Math.abs(dx)
      if (travelled > DRAG_THRESHOLD && !viewport.hasPointerCapture(event.pointerId)) {
        viewport.setPointerCapture(event.pointerId)
        swallowClick = true
      }
      // Incremental (nunca a partir de uma origem fixa): assim o
      // reposicionamento do ciclo no meio do arrasto não desalinha o
      // gesto.
      viewport.scrollLeft -= dx
      wrap()
    }

    const endDrag = (event: PointerEvent) => {
      if (activePointer !== event.pointerId) return
      if (viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId)
      }
      activePointer = null
      setDragging(false)
    }

    // Arrastou -> o clique que o navegador dispara ao soltar não deve
    // abrir o card sob o cursor.
    const onClickCapture = (event: MouseEvent) => {
      if (!swallowClick) return
      swallowClick = false
      event.preventDefault()
      event.stopPropagation()
    }

    // Sem isto o navegador inicia o drag-and-drop nativo da imagem.
    const onDragStart = (event: Event) => {
      if (activePointer !== null) event.preventDefault()
    }

    // Swipe, roda, trackpad, teclado: o ciclo é fechado aqui.
    const onScroll = () => {
      // Evita reagir aos PRÓPRIOS eventos `scroll` disparados pela
      // animação de encaixe (`settle`, acima) — ela já chama `wrap()`
      // a cada quadro por conta própria; rearmar o debounce aqui, no
      // meio da própria correção, só atrasaria sem motivo.
      if (isSnapping) return
      if (activePointer === null) wrap()
      // Rearma o encaixe a cada evento de rolagem de origem touch
      // (inércia ainda em andamento) — só dispara de fato depois de
      // `SETTLE_DEBOUNCE_MS` sem nenhum evento novo, isto é, quando a
      // rolagem já assentou de verdade.
      if (lastPointerType === 'touch' && !touchDown) armSettle()
    }

    // Avanço automático — SÓ no desktop (pedido explícito do usuário:
    // "não executar movimento automático no mobile"). O critério não é
    // largura de tela (uma janela de desktop pode ser estreita, e um
    // tablet largo continua sendo tocado, não "mouseado") — é o tipo de
    // ponteiro: `hover:hover` + `pointer:fine` só é verdade com mouse/
    // trackpad de precisão, nunca em touch puro. Combinado com
    // `prefers-reduced-motion`, que também desliga o avanço. A
    // verificação é feita uma vez (não reage a uma troca de preferência
    // em tempo real, o mesmo compromisso já aceito pelas transições em
    // CSS do resto do app). `matchMedia` não existe em todo ambiente
    // (ex.: jsdom nos testes, sem polyfill) — sem a checagem, o efeito
    // inteiro lançava e os testes quebravam antes de chegar a qualquer
    // asserção.
    const allowMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let rafId: number | null = null
    let lastFrameTime: number | null = null

    const tick = (time: number) => {
      if (lastFrameTime === null) lastFrameTime = time
      const deltaSeconds = Math.min(
        (time - lastFrameTime) / 1000,
        MAX_AUTOPLAY_FRAME_SECONDS,
      )
      lastFrameTime = time

      if (loopRef.current && !pausedRef.current && activePointer === null) {
        viewport.scrollLeft += AUTOPLAY_PX_PER_SEC * deltaSeconds
        wrap()
      }
      rafId = requestAnimationFrame(tick)
    }

    if (allowMotion) rafId = requestAnimationFrame(tick)

    viewport.addEventListener('pointerenter', onPointerEnter)
    viewport.addEventListener('pointerleave', onPointerLeave)
    viewport.addEventListener('pointerdown', onTouchStart)
    viewport.addEventListener('pointerup', onTouchEnd)
    viewport.addEventListener('pointercancel', onTouchEnd)
    viewport.addEventListener('pointerdown', onPointerDown)
    viewport.addEventListener('pointermove', onPointerMove)
    viewport.addEventListener('pointerup', endDrag)
    viewport.addEventListener('pointercancel', endDrag)
    viewport.addEventListener('click', onClickCapture, true)
    viewport.addEventListener('dragstart', onDragStart)
    viewport.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (resumeTimer !== null) clearTimeout(resumeTimer)
      clearSettleTimer()
      cancelSnap()
      viewport.removeEventListener('pointerenter', onPointerEnter)
      viewport.removeEventListener('pointerleave', onPointerLeave)
      viewport.removeEventListener('pointerdown', onTouchStart)
      viewport.removeEventListener('pointerup', onTouchEnd)
      viewport.removeEventListener('pointercancel', onTouchEnd)
      viewport.removeEventListener('pointerdown', onPointerDown)
      viewport.removeEventListener('pointermove', onPointerMove)
      viewport.removeEventListener('pointerup', endDrag)
      viewport.removeEventListener('pointercancel', endDrag)
      viewport.removeEventListener('click', onClickCapture, true)
      viewport.removeEventListener('dragstart', onDragStart)
      viewport.removeEventListener('scroll', onScroll)
    }
  }, [])

  return { viewportRef, seqRef, loop, dragging }
}

/** Nº de cópias extra da sequência quando o ciclo está ligado (2 clones
 *  além da sequência real — meio + 2). */
export const LOOP_EXTRA_COPIES = 2
