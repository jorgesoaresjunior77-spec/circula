// Ilustração do exercício: a imagem desenhada, com a posição inicial à esquerda
// e a execução à direita (public/exercicios/<slug>.webp).

export function exerciseImageUrl(slug: string): string {
  return `${import.meta.env.BASE_URL}exercicios/${slug}.webp`
}

export function ExerciseIllustration({ slug, name, view = 'both' }: { slug: string; name: string; view?: 'both' | 'end' }) {
  const url = exerciseImageUrl(slug)
  if (view === 'end') return <img className="ex-thumb" src={url} alt={`${name}: execução`} loading="lazy" decoding="async" />
  return (
    <figure className="ex-both">
      <img src={url} alt={`${name}: posição inicial à esquerda e execução à direita`} loading="lazy" decoding="async" />
      <figcaption>
        <span>1. Posição inicial</span>
        <span>2. Execução</span>
      </figcaption>
    </figure>
  )
}
