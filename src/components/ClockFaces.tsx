import { useId } from 'react'

// Mostradores desenhados em vetor (nítidos em qualquer tela) para o relógio da página inicial.
// - RoseDigitalFace: caixa rosé de laterais arredondadas, estilo Apple Watch, hora em cima e minutos embaixo.
// - SwissFace: relógio suíço de ponteiros, caixa prata, índices e ponteiros em ouro.
// - ClassicFace: versão plana do relógio de sempre (só para a miniatura da escolha).
// Todos usam a grade 100 x 100.

interface FaceProps {
  h: number
  m: number
  className?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

export function RoseDigitalFace({ h, m, className }: FaceProps) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`rc-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe4df" />
          <stop offset="0.35" stopColor="#e8b9b1" />
          <stop offset="0.7" stopColor="#c98c88" />
          <stop offset="1" stopColor="#a96f6f" />
        </linearGradient>
        <linearGradient id={`rs-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1c20" />
          <stop offset="1" stopColor="#140d10" />
        </linearGradient>
        <linearGradient id={`rg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="0.45" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* coroa e botão lateral */}
      <rect x="91" y="27" width="5.5" height="14" rx="2.75" fill={`url(#rc-${id})`} />
      <rect x="92" y="47" width="3.5" height="12" rx="1.75" fill="#c98c88" />
      {/* caixa com as laterais bem arredondadas */}
      <rect x="6" y="2" width="86" height="96" rx="30" fill={`url(#rc-${id})`} />
      <rect x="6.8" y="2.8" width="84.4" height="94.4" rx="29.2" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.8" />
      {/* tela */}
      <rect x="12.5" y="8.5" width="73" height="83" rx="23.5" fill={`url(#rs-${id})`} />
      <text x="49" y="47" textAnchor="middle" className="cface-digit cface-digit--h">
        {pad(h)}
      </text>
      <text x="49" y="80" textAnchor="middle" className="cface-digit cface-digit--m">
        {pad(m)}
      </text>
      <rect x="12.5" y="8.5" width="73" height="83" rx="23.5" fill={`url(#rg-${id})`} />
    </svg>
  )
}

// Ponteiro "dauphine" (de lâmina facetada), apontando para cima a partir do centro.
function dauphine(len: number, w: number) {
  const tip = 50 - len
  return {
    left: `50,${tip} ${50 - w},${50 - len * 0.18} 50,54`,
    right: `50,${tip} ${50 + w},${50 - len * 0.18} 50,54`,
  }
}

export function SwissFace({ h, m, className }: FaceProps) {
  const id = useId().replace(/:/g, '')
  const hourA = ((h % 12) + m / 60) * 30
  const minA = m * 6
  const hour = dauphine(22, 2.9)
  const minute = dauphine(33, 2.4)
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`sc-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#d9dbde" />
          <stop offset="0.65" stopColor="#a6a9ae" />
          <stop offset="1" stopColor="#7c8086" />
        </linearGradient>
        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e3a8" />
          <stop offset="0.45" stopColor="#d4ab55" />
          <stop offset="1" stopColor="#9c7428" />
        </linearGradient>
        <radialGradient id={`sd-${id}`} cx="45%" cy="38%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#f1f0ec" />
          <stop offset="1" stopColor="#dcdbd5" />
        </radialGradient>
      </defs>
      {/* coroa */}
      <rect x="93" y="46" width="5" height="8" rx="1.4" fill={`url(#sc-${id})`} />
      {/* caixa prata, aro de ouro e mostrador */}
      <circle cx="50" cy="50" r="46" fill={`url(#sc-${id})`} />
      <circle cx="50" cy="50" r="45.3" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.6" />
      <circle cx="50" cy="50" r="41" fill={`url(#sg-${id})`} />
      <circle cx="50" cy="50" r="39" fill={`url(#sd-${id})`} />
      {/* trilho dos minutos */}
      {Array.from({ length: 60 }, (_, i) =>
        i % 5 === 0 ? null : (
          <line key={i} x1="50" y1="12.4" x2="50" y2="14.2" stroke="#9a9a96" strokeWidth="0.45" transform={`rotate(${i * 6} 50 50)`} />
        ),
      )}
      {/* índices das horas em ouro (o das 12 duplo) */}
      {Array.from({ length: 12 }, (_, i) =>
        i === 0 ? (
          <g key={i}>
            <rect x="47.1" y="13" width="2.2" height="9" rx="0.5" fill={`url(#sg-${id})`} />
            <rect x="50.7" y="13" width="2.2" height="9" rx="0.5" fill={`url(#sg-${id})`} />
          </g>
        ) : (
          <rect key={i} x="48.9" y="13" width="2.2" height={i % 3 === 0 ? 8 : 6} rx="0.5" fill={`url(#sg-${id})`} transform={`rotate(${i * 30} 50 50)`} />
        ),
      )}
      <text x="50" y="33" textAnchor="middle" className="cface-swiss-brand">
        Círcula
      </text>
      {/* ponteiros (facetados: um lado claro, outro escuro) */}
      <g transform={`rotate(${hourA} 50 50)`}>
        <polygon points={hour.left} fill="#e9cf86" />
        <polygon points={hour.right} fill="#a67b2c" />
      </g>
      <g transform={`rotate(${minA} 50 50)`}>
        <polygon points={minute.left} fill="#ecd38c" />
        <polygon points={minute.right} fill="#a67b2c" />
      </g>
      <circle cx="50" cy="50" r="2.6" fill={`url(#sg-${id})`} />
      <circle cx="49.4" cy="49.4" r="0.8" fill="rgba(255,255,255,0.8)" />
    </svg>
  )
}

export function ClassicFace({ h, m, className }: FaceProps) {
  const id = useId().replace(/:/g, '')
  const hourA = ((h % 12) + m / 60) * 30
  const minA = m * 6
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`cc-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e7cdb8" />
          <stop offset="0.5" stopColor="#b98f74" />
          <stop offset="1" stopColor="#8a6450" />
        </linearGradient>
      </defs>
      <rect x="96" y="30" width="5" height="12" rx="2.5" fill={`url(#cc-${id})`} />
      <rect x="5" y="2" width="91" height="96" rx="25" fill={`url(#cc-${id})`} />
      <rect x="11" y="8" width="79" height="84" rx="19" fill="#241914" />
      <line x1="50" y1="50" x2="50" y2="28" stroke="#f7efe6" strokeWidth="4" strokeLinecap="round" transform={`rotate(${hourA} 50 50)`} />
      <line x1="50" y1="54" x2="50" y2="17" stroke="#f7efe6" strokeWidth="2.6" strokeLinecap="round" transform={`rotate(${minA} 50 50)`} />
      <circle cx="50" cy="50" r="3.2" fill="#b98f74" />
    </svg>
  )
}
