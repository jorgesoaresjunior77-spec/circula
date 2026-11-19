import { useState } from 'react'

// Instruções ilustradas para medir o corpo com uma fita métrica. As medidas
// são preenchidas à mão pela paciente: fotografia comum não dá medida exata,
// então o app guarda e compara — não "estima".

type Key = 'arm' | 'waist' | 'abdomen' | 'hip' | 'thigh'

const GUIDE: Record<Key, { label: string; y: number; text: string }> = {
  arm: { label: 'Braço', y: 62, text: 'Com o braço relaxado ao lado do corpo, meça no ponto mais grosso, na metade entre o ombro e o cotovelo.' },
  waist: { label: 'Cintura', y: 92, text: 'Meça na parte mais estreita do tronco, geralmente acima do umbigo, ao final de uma expiração normal.' },
  abdomen: { label: 'Abdômen', y: 108, text: 'Passe a fita na altura do umbigo, sem apertar a pele e sem encolher a barriga.' },
  hip: { label: 'Quadril', y: 128, text: 'Com os pés juntos, meça no ponto mais largo do bumbum, com a fita bem reta ao redor do corpo.' },
  thigh: { label: 'Perna (coxa)', y: 158, text: 'Em pé, meça no ponto mais grosso da coxa, logo abaixo do quadril.' },
}

export function BodyMeasureGuide() {
  const [key, setKey] = useState<Key>('waist')
  const g = GUIDE[key]
  return (
    <div className="body-guide">
      <svg viewBox="0 0 120 220" role="img" aria-label={`Onde medir: ${g.label}`} className="body-guide-fig">
        <g fill="#f3e4d4" stroke="#8a6a52" strokeWidth="1.5">
          <circle cx="60" cy="18" r="13" />
          <path d="M44 36 Q60 44 76 36 L84 70 L82 108 Q80 124 84 138 L78 205 L64 205 L60 150 L56 205 L42 205 L36 138 Q40 124 38 108 L36 70 Z" />
          <path d="M44 38 L30 92 L34 96 L48 54 M76 38 L90 92 L86 96 L72 54" fill="none" />
        </g>
        <line x1="22" x2="98" y1={g.y} y2={g.y} stroke="#c0654a" strokeWidth="2.5" strokeDasharray="5 3" />
        <circle cx="22" cy={g.y} r="3" fill="#c0654a" />
        <circle cx="98" cy={g.y} r="3" fill="#c0654a" />
      </svg>
      <div>
        <div className="body-guide-tabs" role="tablist">
          {(Object.keys(GUIDE) as Key[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={k === key} className={k === key ? 'is-on' : ''} onClick={() => setKey(k)}>
              {GUIDE[k].label}
            </button>
          ))}
        </div>
        <p className="body-guide-text">{g.text}</p>
        <p className="home-muted">Use sempre a mesma fita, de manhã e em jejum se possível, sem roupa grossa. Anote em centímetros.</p>
      </div>
    </div>
  )
}
