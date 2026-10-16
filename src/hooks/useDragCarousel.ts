import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

// Rolagem infinita MANUAL dos carrosséis horizontais da capa
// (HomeExperienceStrip · "Seu Círcula de Hoje" e HomeCirclesSection ·
// "Círculos"). Uma implementação só, compartilhada pelas duas faixas —
// antes cada uma tinha o seu mecanismo, e os dois eram de AUTOPLAY
// (marquee por requestAnimationFrame num caso, vaivém no outro).
//
// O que mudou e por quê:
//   · Nenhum movimento automático. Nada se move sem a pessoa mover —
//     sem autoplay, sem animação, sem vaivém. O rAF saiu por completo.
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

/** Distância (px) a partir da qual o gesto é arrasto, não clique. */
const DRAG_THRESHOLD = 4

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
  const centeredRef = useRef(false)
  const [loop, setLoop] = useState(false)
  const [dragging, setDragging] = useState(false)

  // Medida: a sequência excede a viewport? É o único gatilho do ciclo
  // (e, portanto, das cópias no DOM). Quando liga, a posição inicial
  // vai para o começo da 2ª cópia — visualmente idêntico ao começo da
  // faixa, mas com uma sequência inteira de folga à esquerda.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const seq = seqRef.current
    if (!viewport || !seq) return

    const measure = () => {
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

    const onPointerDown = (event: PointerEvent) => {
      // Toque e caneta: rolagem nativa (com inércia). Só o mouse, que
      // não tem gesto de arrasto próprio, é tratado aqui.
      if (event.pointerType !== 'mouse' || event.button !== 0) return
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
      if (activePointer === null) wrap()
    }

    viewport.addEventListener('pointerdown', onPointerDown)
    viewport.addEventListener('pointermove', onPointerMove)
    viewport.addEventListener('pointerup', endDrag)
    viewport.addEventListener('pointercancel', endDrag)
    viewport.addEventListener('click', onClickCapture, true)
    viewport.addEventListener('dragstart', onDragStart)
    viewport.addEventListener('scroll', onScroll, { passive: true })

    return () => {
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
