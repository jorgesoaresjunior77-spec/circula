// SUBSTITUÍDO pelo RoboGuia (robô mascote): este arquivo não é mais usado pelo Tour.
// Fica aqui só para facilitar voltar à bonequinha antiga, se for preciso.
//
// Marluce em desenho: bonequinha de cabelos loiros que acompanhava o tour. O braço
// apontava para o elemento destacado (o ângulo vinha do Tour) e o rosto mudava de
// expressão a cada passo.

export type GuideMood = 'smile' | 'happy' | 'wink'

const MOUTH: Record<GuideMood, string> = {
  smile: 'M44 44 Q50 49 56 44',
  happy: 'M43 43 Q50 53 57 43 Q50 47 43 43 Z',
  wink: 'M44 44 Q50 49 56 44',
}

export function TourGuide({ mood, pointAngle }: { mood: GuideMood; pointAngle: number }) {
  return (
    <svg className="tour-guide" viewBox="0 0 110 128" width="104" height="122" aria-hidden="true" focusable="false" style={{ ['--point' as string]: `${pointAngle}deg` }}>
      <g className="tour-guide-bob">
        {/* cabelo de trás */}
        <g className="tour-guide-hair">
          <path d="M28 38 C24 18 38 8 52 8 C68 8 78 20 74 40 C78 56 76 74 70 84 L34 84 C28 74 26 54 28 38 Z" fill="#e6bf62" />
          <path d="M32 40 C30 56 32 70 36 80" fill="none" stroke="#f3d98f" strokeWidth="3" strokeLinecap="round" />
          <path d="M70 42 C73 56 72 70 68 80" fill="none" stroke="#cfa447" strokeWidth="3" strokeLinecap="round" />
        </g>
        {/* braço de descanso */}
        <path d="M39 62 C34 72 33 82 36 92" fill="none" stroke="#f4d6c0" strokeWidth="7" strokeLinecap="round" />
        {/* vestido */}
        <path d="M38 56 Q50 52 62 56 L74 118 Q50 126 26 118 Z" fill="#efd3bb" stroke="#c99a76" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M36 80 Q50 86 64 80 L66 88 Q50 94 34 88 Z" fill="#c98f6a" />
        <path d="M40 57 Q50 62 60 57" fill="none" stroke="#c99a76" strokeWidth="1.2" strokeLinecap="round" />
        {/* pescoço e rosto */}
        <rect x="46" y="48" width="8" height="9" rx="3" fill="#f4d6c0" />
        <circle cx="50" cy="34" r="17" fill="#f8dfcb" stroke="#d9ad8d" strokeWidth="1.2" />
        {/* franja de lado */}
        <path d="M33 33 C34 20 46 14 58 18 C66 21 69 28 68 34 C62 26 52 24 44 27 C40 28 36 31 33 33 Z" fill="#e6bf62" />
        <path d="M44 25 C50 22 58 22 63 26" fill="none" stroke="#f3d98f" strokeWidth="2" strokeLinecap="round" />
        {/* olhos, sobrancelhas, bochechas */}
        <g className="tour-guide-eyes">
          <ellipse cx="43.500" cy="35" rx="2.200" ry="2.800" fill="#5a3b2a" />
          {mood === 'wink' ? <path d="M54 35 q3 -3 6 0" fill="none" stroke="#5a3b2a" strokeWidth="1.8" strokeLinecap="round" /> : <ellipse cx="56.500" cy="35" rx="2.200" ry="2.800" fill="#5a3b2a" />}
        </g>
        <path d="M40 30 q3.500 -2.500 7 -0.500 M53 29.500 q3.500 -2 7 0.500" fill="none" stroke="#b78a3a" strokeWidth="1.2" strokeLinecap="round" />
        <ellipse cx="38" cy="41" rx="3.500" ry="2.200" fill="#f2a9a0" opacity="0.55" />
        <ellipse cx="62" cy="41" rx="3.500" ry="2.200" fill="#f2a9a0" opacity="0.55" />
        <path d={MOUTH[mood]} fill={mood === 'happy' ? '#d97a6c' : 'none'} stroke="#c0564a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        {/* braço que aponta: gira em volta do ombro */}
        <g className="tour-guide-arm" style={{ transformOrigin: '62px 62px' }}>
          <g className="tour-guide-sway" style={{ transformOrigin: '62px 62px' }}>
            <path d="M62 62 L90 62" fill="none" stroke="#f4d6c0" strokeWidth="7" strokeLinecap="round" />
            <circle cx="92" cy="62" r="5" fill="#f8dfcb" stroke="#d9ad8d" strokeWidth="1" />
            <path d="M96 60 L106 59" fill="none" stroke="#f8dfcb" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </svg>
  )
}
