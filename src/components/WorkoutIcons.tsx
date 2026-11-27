import type { ReactNode } from 'react'

// Ícones do Exercite Diário no traço do Círcula (linha fina, cantos redondos,
// cor do texto). Substituem os emojis genéricos das opções do treino.

function I({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

const head = <circle cx="12" cy="4.6" r="2" />

export const WORKOUT_ICONS: Record<string, ReactNode> = {
  // regiões do corpo
  'Corpo inteiro': (
    <I>
      {head}
      <path d="M12 7v7M12 9.5 6.5 7M12 9.5l5.5-2.5M12 14l-4 6M12 14l4 6" />
    </I>
  ),
  Pernas: (
    <I>
      <path d="M9 3v8l-1.5 9H11l1-6 1 6h3.5L15 11V3" />
    </I>
  ),
  Glúteos: (
    <I>
      <path d="M12 6c-3.8 0-7 2.6-7 6.6 0 3 2.2 5.4 5 5.4 1 0 1.6-.4 2-1 .4.6 1 1 2 1 2.8 0 5-2.4 5-5.4C19 8.6 15.8 6 12 6Z" />
      <path d="M12 8.5v8.5" />
    </I>
  ),
  Abdômen: (
    <I>
      <rect x="7" y="4" width="10" height="16" rx="5" />
      <path d="M12 6.5v11M8.5 10h7M8.5 14h7" />
    </I>
  ),
  Braços: (
    <I>
      <path d="M4 18c3-1 4.5-3 5-6l1-4c.5-2 3-2.5 4-.8l.6 1c1.4-1.2 3.6-.6 4.2 1.2.7 2-.6 4-2.8 4.3L12 14c-1.2 2.6-3.6 4.5-8 5" />
    </I>
  ),
  Peito: (
    <I>
      <path d="M12 8c-1.6-2.4-6-2.2-6.6 1-.6 3.4 2.4 6 6.6 9 4.2-3 7.2-5.6 6.6-9-.6-3.2-5-3.4-6.6-1Z" />
    </I>
  ),
  Costas: (
    <I>
      {head}
      <path d="M12 7c-1.5 3-1.5 6 0 9M8 9.5c1.3.8 2.6 1 4 1s2.7-.2 4-1M9 20l3-4 3 4" />
    </I>
  ),
  Equilíbrio: (
    <I>
      {head}
      <path d="M12 7v7l0 6M12 14l3.5-3M12 9.5 7 8M12 9.5l5-1.5" />
    </I>
  ),
  'Condicionamento físico': (
    <I>
      <path d="M13 3 6 13h5l-1 8 7-10h-5l1-8Z" />
    </I>
  ),
  // objetivos
  Fortalecer: (
    <I>
      <path d="M6 9v6M18 9v6M3.5 10.5v3M20.5 10.5v3M6 12h12" />
    </I>
  ),
  Mobilidade: (
    <I>
      <path d="M19 12a7 7 0 1 1-2.1-5" />
      <path d="M19 4v4h-4" />
    </I>
  ),
  Alongar: (
    <I>
      {head}
      <path d="M12 7v6M6 4.5 12 9l6-4.5M7 19c1.6-2 3.2-3 5-3s3.4 1 5 3" />
    </I>
  ),
  Condicionamento: (
    <I>
      <path d="M12 20c-4-2.6-7-5.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 3.6-3 6.4-7 9Z" />
      <path d="M6 12h3l1.5-2.5 2 4.5 1.5-2h4" />
    </I>
  ),
  Postura: (
    <I>
      {head}
      <path d="M12 7v13M9 20h6M8.5 10h7" />
    </I>
  ),
  // nível
  Iniciante: (
    <I>
      <path d="M12 20v-7" />
      <path d="M12 13c0-3-2-5-5.5-5 0 3 2 5 5.5 5ZM12 15c0-2.6 1.8-4.5 4.8-4.5 0 2.6-1.8 4.5-4.8 4.5Z" />
    </I>
  ),
  'Intermediário': (
    <I>
      <path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14Z" />
      <path d="M5 19 13 11" />
    </I>
  ),
  'Só baixo impacto': (
    <I>
      <path d="M19 5c-7 0-12 4-12 10v4M7 15c4 0 8-2 10-6" />
    </I>
  ),
  'Sem equipamentos': (
    <I>
      <path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11M10 10V5a1.5 1.5 0 0 1 3 0v5M13 10V6a1.5 1.5 0 0 1 3 0v6M16 10.5a1.5 1.5 0 0 1 3 0V14c0 3.5-2.5 6-6 6s-5-1.5-6.5-4L5 13a1.4 1.4 0 0 1 2-2l1 1" />
    </I>
  ),
  // o que tem em casa
  parede: (
    <I>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M4 9.7h16M4 14.3h16M9 5v4.7M15 5v4.7M12 9.7v4.6M7 14.3V19M17 14.3V19" />
    </I>
  ),
  cadeira: (
    <I>
      <path d="M7 3v10h10M7 13v8M17 13v8M7 17h10" />
    </I>
  ),
  degrau: (
    <I>
      <path d="M4 19h16M4 19v-5h5v-4h5V6h6v13" />
    </I>
  ),
  garrafas: (
    <I>
      <path d="M10 3h4M10.5 3v3.2C8.8 7 8 8.4 8 10v9a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-9c0-1.6-.8-3-2.5-3.8V3" />
      <path d="M8 13h8" />
    </I>
  ),
  bola: (
    <I>
      <circle cx="12" cy="12" r="8" />
      <path d="M4.5 9.5c4 1.5 11 1.5 15 0M4.5 14.5c4-1.5 11-1.5 15 0" />
    </I>
  ),
  elastico: (
    <I>
      <path d="M5 8c3-3 5 3 7 0s4 3 7 0M5 16c3-3 5 3 7 0s4 3 7 0" />
    </I>
  ),
  toalha: (
    <I>
      <path d="M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4Z" />
      <path d="M6 4a2 2 0 0 0-2 2v3h2M10 16h5" />
    </I>
  ),
  cabo: (
    <I>
      <path d="M5 20 19 4" />
    </I>
  ),
}

export const WORKOUT_ICON_FALLBACK = (
  <I>
    <circle cx="12" cy="12" r="2.5" />
  </I>
)

export function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}
