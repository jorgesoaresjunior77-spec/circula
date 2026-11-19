import { m, inViewOnce, riseVariants } from '../lib/motionKit'

// Card único "Planos e assinaturas": duas coroas recortadas (sem contorno, só
// com sombra nas bordas), uma bege-clara e uma rosé, e o nome embaixo.

const CROWN = 'M4 64 L12 16 L33 40 L50 6 L67 40 L88 16 L96 64 Q50 74 4 64 Z'

export function HomePlansCard({ onOpen }: { onOpen: () => void }) {
  return (
    <m.section className="home-plans-wrap" {...inViewOnce} variants={riseVariants} aria-label="Planos e assinaturas">
      <button type="button" className="home-plans-card" onClick={onOpen}>
        <svg className="home-plans-crowns" viewBox="0 0 230 100" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="crown-beige" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f6ebdb" />
              <stop offset="1" stopColor="#e2cbae" />
            </linearGradient>
            <linearGradient id="crown-rose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#efc0c0" />
              <stop offset="1" stopColor="#d4949a" />
            </linearGradient>
          </defs>
          <g className="home-plans-crown home-plans-crown--beige" transform="translate(14 20) rotate(-9 50 40)">
            <path d={CROWN} fill="url(#crown-beige)" />
            <path d="M12 52 Q50 60 88 52 L90 58 Q50 67 10 58 Z" fill="#fff" opacity="0.35" />
          </g>
          <g className="home-plans-crown home-plans-crown--rose" transform="translate(112 14) rotate(7 50 40)">
            <path d={CROWN} fill="url(#crown-rose)" />
            <path d="M12 52 Q50 60 88 52 L90 58 Q50 67 10 58 Z" fill="#fff" opacity="0.3" />
          </g>
          <path d="M113 76 L117 84 L113 92 L109 84 Z" fill="#e8c98a" />
        </svg>
        <span className="home-plans-title">Planos e assinaturas</span>
      </button>
    </m.section>
  )
}
