// Duas mãos que se aproximam e se unem em oração (gesto de "Amém"). Movimento
// suave e curto, em CSS; com "reduzir movimento" as mãos já aparecem unidas.

export function PrayingHands({ size = 120, label = 'Mãos em oração' }: { size?: number; label?: string }) {
  const hand = (
    <>
      <path d="M0 62 C-3 40 -3 18 0 2 C5 14 14 34 14 56 C14 66 8 72 0 72 Z" fill="#f3d9c1" stroke="#a9754f" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 52 C3 40 5 30 8 22" fill="none" stroke="#c99a76" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M0 66 C6 64 11 60 14 54" fill="none" stroke="#c99a76" strokeWidth="1.2" strokeLinecap="round" />
    </>
  )
  return (
    <svg className="praying-hands" viewBox="-40 -10 80 100" width={size} height={size * 1.25} role="img" aria-label={label}>
      <circle className="praying-glow" cx="0" cy="36" r="30" fill="#ffe3a8" />
      <g className="praying-left">
        <g transform="translate(-1 8)">{hand}</g>
      </g>
      <g className="praying-right">
        <g transform="translate(1 8) scale(-1 1)">{hand}</g>
      </g>
      <g className="praying-rays" stroke="#e6b765" strokeWidth="1.6" strokeLinecap="round">
        <line x1="0" y1="-4" x2="0" y2="-9" />
        <line x1="-12" y1="-1" x2="-16" y2="-5" />
        <line x1="12" y1="-1" x2="16" y2="-5" />
      </g>
    </svg>
  )
}
