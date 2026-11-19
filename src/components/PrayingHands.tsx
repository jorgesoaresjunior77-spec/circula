// Mãos em oração (gesto de "Amém"), a partir da imagem de referência: a imagem é
// dividida ao meio e as duas metades se aproximam até as mãos se unirem, com um
// brilho suave. Movimento curto e delicado; com "reduzir movimento", as mãos já
// aparecem unidas.

export function PrayingHands({ size = 120, label = 'Mãos em oração' }: { size?: number; label?: string }) {
  const src = `${import.meta.env.BASE_URL}diario/maos-amem.webp`
  return (
    <span className="praying-photo" style={{ width: size, height: size * 1.6 }} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
      <span className="praying-glow-bg" />
      <img className="praying-half praying-half--left" src={src} alt="" draggable={false} />
      <img className="praying-half praying-half--right" src={src} alt="" draggable={false} />
    </span>
  )
}
