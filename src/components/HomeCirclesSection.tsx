import type { CircleWithMembers } from '../types/circle'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { useDragCarousel, LOOP_EXTRA_COPIES } from '../hooks/useDragCarousel'
import { PlusIcon } from './icons'

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
  /** Etapa 5 (evolução/experiência/gamificação) — abre o formulário de
   *  solicitação de um novo Círculo (CircleRequestForm). `undefined`
   *  omite o card "Novo Círculo" por completo (ex.: Master, que não
   *  participa de comunidade). */
  onRequestNewCircle?: () => void
}

/** Card fixo "Novo Círculo" — mesma identidade visual/dimensão dos
 *  cards reais (reusa .circ-card-frame/.circ-card-text), só com um
 *  ícone de "+" no lugar da foto e abrindo o formulário de solicitação
 *  em vez de um Círculo existente. Nunca clonado pelo ciclo contínuo —
 *  fica de fora de `circles`, sempre o último item real da sequência
 *  (ver render abaixo). */
function NewCircleCard({ onActivate, clone }: { onActivate: () => void; clone: boolean }) {
  return (
    <li className="circ-card-item">
      <article className="circ-card circ-card--new">
        <div className="circ-card-frame">
          <span className="circ-card-new-icon" aria-hidden="true">
            <PlusIcon size={22} />
          </span>
          <button
            type="button"
            className="circ-card-open"
            onClick={onActivate}
            aria-label={clone ? undefined : 'Sugerir um novo círculo'}
            aria-hidden={clone ? true : undefined}
            tabIndex={clone ? -1 : undefined}
          />
          <div className="circ-card-text">
            <h3 className="circ-card-title">Novo Círculo</h3>
            <span className="circ-card-meta">Sugira um grupo</span>
          </div>
        </div>
      </article>
    </li>
  )
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
          {coverUrl && <img loading="lazy" decoding="async" src={coverUrl} alt="" className="circ-card-photo" />}

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

export function HomeCirclesSection({ circles, onOpen, onRequestNewCircle }: HomeCirclesSectionProps) {
  // +1 pelo card fixo "Novo Círculo" (quando presente) — precisa entrar
  // na contagem que decide se o ciclo contínuo liga (useDragCarousel
  // mede a largura real da sequência inteira; se o card novo ficasse de
  // fora da contagem, o hook não re-mediria ao ele aparecer/sumir).
  const itemCount = circles.length + (onRequestNewCircle ? 1 : 0)
  const { viewportRef, seqRef, loop, dragging } = useDragCarousel(itemCount)

  if (itemCount === 0) return null

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
      {onRequestNewCircle && (
        <NewCircleCard
          key={clone ? `new-circle-${key}` : 'new-circle'}
          onActivate={onRequestNewCircle}
          clone={clone}
        />
      )}
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
