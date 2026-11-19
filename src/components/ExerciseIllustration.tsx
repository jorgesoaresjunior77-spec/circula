import { BASE_EXERCISES } from '../lib/exerciseCatalog'
import { ExerciseFigure } from './ExerciseFigure'

// Ilustração do exercício: a imagem desenhada (posição inicial à esquerda,
// execução à direita) quando existe para o exercício; senão, o traço simples
// de reserva (ExerciseFigure), para exercícios cadastrados depois.

const WITH_IMAGE = new Set(BASE_EXERCISES.map((e) => e.slug))

export function exerciseImageUrl(slug: string): string | null {
  return WITH_IMAGE.has(slug) ? `${import.meta.env.BASE_URL}exercicios/${slug}.webp` : null
}

export function ExerciseIllustration({
  slug,
  name,
  poseStart,
  poseEnd,
  view = 'both',
}: {
  slug: string
  name: string
  poseStart: string | null
  poseEnd: string | null
  view?: 'both' | 'end'
}) {
  const url = exerciseImageUrl(slug)
  if (url) {
    return view === 'end' ? (
      <img className="ex-thumb" src={url} alt={`${name}: execução`} loading="lazy" decoding="async" />
    ) : (
      <figure className="ex-both">
        <img src={url} alt={`${name}: posição inicial à esquerda e execução à direita`} loading="lazy" decoding="async" />
        <figcaption>
          <span>1. Posição inicial</span>
          <span>2. Execução</span>
        </figcaption>
      </figure>
    )
  }
  if (view === 'end') return poseEnd ? <ExerciseFigure pose={poseEnd} label={`${name}: execução`} /> : null
  return (
    <div className="ex-pair">
      {poseStart && (
        <figure>
          <ExerciseFigure pose={poseStart} label={`${name}: posição inicial`} />
          <figcaption>1. Posição inicial</figcaption>
        </figure>
      )}
      {poseEnd && (
        <figure>
          <ExerciseFigure pose={poseEnd} label={`${name}: execução`} />
          <figcaption>2. Execução</figcaption>
        </figure>
      )}
    </div>
  )
}
