import type { CircleWithMembers } from '../types/circle'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { useDragCarousel, LOOP_EXTRA_COPIES } from '../hooks/useDragCarousel'

// C3 — Círculos editoriais na comunidade.
//
// Os Círculos EXISTENTES da comunidade em foco apresentados como uma
// coleção editorial dentro da Home (logo depois da faixa de
// experiências da C2), não como um bloco de dashboard. A imagem é a
// capa escolhida pelo criador do Círculo (`circle.cover_image_url`,
// assinada pelo mesmo useSignedImageUrl do CircleCard). Sem capa, o
// card usa uma composição tipográfica — nunca uma imagem inventada.
//
// Correção dos cards de Círculos — os botões "Entrar"/"Sair" saíram do
// card: ele agora só abre a página daquele Círculo (CircleDetail),
// passando o id do círculo clicado (antes `onOpen` era genérico e
// sempre levava à lista). Seguir/deixar de seguir passou a viver
// inteiramente dentro do CircleDetail — mesmos handlers joinCircle/
// leaveCircle de sempre, só o lugar da ação mudou. A leitura/publicação
// de conteúdo continua condicionada a participar (CircleDetail decide
// isso, sem mudança de regra/RLS).
//
// Rolagem — mesmo useDragCarousel de <HomeExperienceStrip>: ciclo
// contínuo nos dois sentidos, arrasto de mouse, swipe nativo, sem
// autoplay.

interface HomeCirclesSectionProps {
  circles: CircleWithMembers[]
  /** Abre a página daquele círculo específico (CircleDetail). */
  onOpen: (circleId: string) => void
}

interface CircleGalleryCardProps {
  circle: CircleWithMembers
  index: number
  clone: boolean
  onOpen: (circleId: string) => void
}

function CircleGalleryCard({ circle, index, clone, onOpen }: CircleGalleryCardProps) {
  // Uma instância por card (hook não pode ir dentro de .map()) — mesmo
  // padrão do antigo HomeCircleTile / CircleCard.
  const { url: coverUrl } = useSignedImageUrl(circle.cover_image_url)

  const memberCount = circle.members.length
  const memberLabel = memberCount === 1 ? '1 mulher' : `${memberCount} mulheres`

  return (
    <li className="circ-card-item">
      <article
        className={`circ-card${coverUrl ? ' circ-card--photo' : ''}`}
        data-tint={index % 4}
      >
        <div className="circ-card-frame">
          {coverUrl && <img src={coverUrl} alt="" className="circ-card-photo" />}

          {/* Abrir ESTE círculo: link esticado sobre todo o card. */}
          <button
            type="button"
            className="circ-card-open"
            onClick={() => onOpen(circle.id)}
            aria-label={clone ? undefined : `Abrir círculo ${circle.name}`}
            aria-hidden={clone ? true : undefined}
            tabIndex={clone ? -1 : undefined}
          />

          <div className="circ-card-text">
            <h3 className="circ-card-title">{circle.name}</h3>
            <span className="circ-card-meta">{memberLabel}</span>
          </div>
        </div>
      </article>
    </li>
  )
}

export function HomeCirclesSection({ circles, onOpen }: HomeCirclesSectionProps) {
  const { viewportRef, seqRef, loop, dragging } = useDragCarousel(circles.length)

  if (circles.length === 0) return null

  const renderSeq = (clone: boolean, key?: string) => (
    <ul className="circ-seq" aria-hidden={clone || undefined} key={key} ref={clone ? undefined : seqRef}>
      {circles.map((circle, index) => (
        <CircleGalleryCard
          key={clone ? `${circle.id}-${key}` : circle.id}
          circle={circle}
          index={index}
          clone={clone}
          onOpen={onOpen}
        />
      ))}
    </ul>
  )

  return (
    <section className="circ-strip" aria-labelledby="circ-strip-title">
      <h2 id="circ-strip-title" className="circ-strip-title">
        Círculos
      </h2>
      <div
        className={`circ-viewport exp-viewport--draggable${loop ? ' exp-viewport--looping' : ''}${dragging ? ' exp-viewport--dragging' : ''}`}
        ref={viewportRef}
      >
        <div className="circ-track">
          {renderSeq(false)}
          {loop &&
            Array.from({ length: LOOP_EXTRA_COPIES }, (_, copy) =>
              renderSeq(true, `copy-${copy}`),
            )}
        </div>
      </div>
    </section>
  )
}
