import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { CircleWithMembers, JoinCircleResult } from '../types/circle'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'

// C3 — Círculos editoriais na comunidade.
//
// Os Círculos EXISTENTES da comunidade em foco apresentados como uma
// coleção editorial dentro da Home (logo depois da faixa de
// experiências da C2), não como um bloco de dashboard. Sem consulta,
// campo, tabela, migration ou hook de negócio novo: recebe `circles`
// pronto (useCircles, já instanciado na HomeToday) e reusa os handlers
// que já existem — abrir o destino Círculos, joinCircle e leaveCircle.
// A imagem é a capa escolhida pelo criador do Círculo
// (`circle.cover_image_url`, assinada pelo mesmo useSignedImageUrl do
// CircleCard). Sem capa, o card usa uma composição tipográfica — nunca
// uma imagem inventada.

interface HomeCirclesSectionProps {
  circles: CircleWithMembers[]
  profileId: string
  /** Leva ao destino "Círculos" — o mesmo comportamento que a Home já tinha. */
  onOpen: () => void
  onJoin: (circleId: string) => Promise<JoinCircleResult>
  onLeave: (circleId: string) => Promise<JoinCircleResult>
}

interface CircleGalleryCardProps {
  circle: CircleWithMembers
  index: number
  isParticipating: boolean
  onOpen: () => void
  onJoin: (circleId: string) => Promise<JoinCircleResult>
  onLeave: (circleId: string) => Promise<JoinCircleResult>
}

function CircleGalleryCard({
  circle,
  index,
  isParticipating,
  onOpen,
  onJoin,
  onLeave,
}: CircleGalleryCardProps) {
  // Uma instância por card (hook não pode ir dentro de .map()) — mesmo
  // padrão do antigo HomeCircleTile / CircleCard.
  const { url: coverUrl } = useSignedImageUrl(circle.cover_image_url)
  const [working, setWorking] = useState(false)

  const memberCount = circle.members.length
  const memberLabel =
    memberCount === 1 ? '1 mulher' : `${memberCount} mulheres`

  async function handleToggle(event: MouseEvent) {
    event.stopPropagation()
    if (working) return
    setWorking(true)
    await (isParticipating ? onLeave(circle.id) : onJoin(circle.id))
    setWorking(false)
  }

  return (
    <li className="circ-card-item">
      <article
        className={`circ-card${coverUrl ? ' circ-card--photo' : ''}`}
        data-tint={index % 4}
      >
        <div className="circ-card-frame">
          {coverUrl && <img src={coverUrl} alt="" className="circ-card-photo" />}

          {/* Abrir o Círculo: link esticado sobre todo o card. */}
          <button
            type="button"
            className="circ-card-open"
            onClick={onOpen}
            aria-label={`Abrir círculo ${circle.name}`}
          />

          <div className="circ-card-text">
            <h3 className="circ-card-title">{circle.name}</h3>
            <span className="circ-card-meta">{memberLabel}</span>
          </div>

          <button
            type="button"
            className="circ-card-join"
            onClick={handleToggle}
            disabled={working}
            aria-label={
              isParticipating
                ? `Sair do círculo ${circle.name}`
                : `Participar do círculo ${circle.name}`
            }
          >
            {working ? '…' : isParticipating ? 'Sair' : 'Participar'}
          </button>
        </div>
      </article>
    </li>
  )
}

export function HomeCirclesSection({
  circles,
  profileId,
  onOpen,
  onJoin,
  onLeave,
}: HomeCirclesSectionProps) {
  const trackRef = useRef<HTMLUListElement>(null)

  // Deslize horizontal muito sutil, em vaivém, na linguagem da C2. Pausa
  // ao interagir (mouse, foco, toque) e com a aba oculta. Desligado em
  // prefers-reduced-motion e em ponteiro grosso (touch) — aí vale o
  // swipe/scroll nativo. Sem biblioteca.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      window.matchMedia('(pointer: coarse)').matches
    ) {
      return
    }

    let raf = 0
    let paused = false
    let dir = 1
    let pos = el.scrollLeft
    const SPEED = 0.4

    const step = () => {
      if (!paused && el.scrollWidth > el.clientWidth + 4) {
        const max = el.scrollWidth - el.clientWidth
        if (pos >= max) dir = -1
        else if (pos <= 0) dir = 1
        pos += SPEED * dir
        el.scrollLeft = pos
      }
      raf = requestAnimationFrame(step)
    }

    const pause = () => {
      paused = true
    }
    const resume = () => {
      paused = false
    }
    const onVisibility = () => {
      paused = document.hidden
    }
    const syncPos = () => {
      if (paused) pos = el.scrollLeft
    }

    el.addEventListener('pointerenter', pause)
    el.addEventListener('pointerleave', resume)
    el.addEventListener('pointerdown', pause)
    el.addEventListener('focusin', pause)
    el.addEventListener('focusout', resume)
    el.addEventListener('scroll', syncPos, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerenter', pause)
      el.removeEventListener('pointerleave', resume)
      el.removeEventListener('pointerdown', pause)
      el.removeEventListener('focusin', pause)
      el.removeEventListener('focusout', resume)
      el.removeEventListener('scroll', syncPos)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [circles.length])

  if (circles.length === 0) return null

  return (
    <section className="circ-strip" aria-labelledby="circ-strip-title">
      <h2 id="circ-strip-title" className="circ-strip-title">
        Círculos
      </h2>
      <ul className="circ-track" ref={trackRef}>
        {circles.map((circle, index) => (
          <CircleGalleryCard
            key={circle.id}
            circle={circle}
            index={index}
            isParticipating={circle.members.some(
              (member) => member.profile_id === profileId,
            )}
            onOpen={onOpen}
            onJoin={onJoin}
            onLeave={onLeave}
          />
        ))}
      </ul>
    </section>
  )
}
