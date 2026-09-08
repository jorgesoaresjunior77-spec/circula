import type { ReactNode } from 'react'

// =====================================================================
// Linguagem de ícones do Círcula — redesign editorial (commit 7)
// ---------------------------------------------------------------------
// Traço fino e uniforme, cantos arredondados, viewBox 24 como padrão,
// `currentColor` (herda a cor do texto), `aria-hidden`. Um único
// componente <Icon> concentra o SVG e o peso do traço para que todos
// os ícones falem a mesma língua da tipografia.
//
// Cada export mantém EXATAMENTE o mesmo nome, as mesmas props e o mesmo
// `size` padrão de antes — nenhum dos 22 pontos de uso muda.
// =====================================================================

interface IconProps {
  size?: number
  className?: string
}

interface IconBaseProps extends IconProps {
  viewBox?: string
  /** Peso do traço, calibrado para ~0.058 do lado do viewBox. */
  stroke?: number
  children: ReactNode
}

function Icon({ size = 20, className, viewBox = '0 0 24 24', stroke = 1.4, children }: IconBaseProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function HeartIcon({ size = 17, className }: IconProps) {
  return (
    <Icon size={size} className={className} viewBox="0 0 20 20" stroke={1.3}>
      <path
        d="M10 17.2s-6.8-4.1-6.8-9.1a3.9 3.9 0 0 1 6.8-2.6 3.9 3.9 0 0 1 6.8 2.6c0 5-6.8 9.1-6.8 9.1Z"
        fill="currentColor"
        style={{ fillOpacity: 'var(--heart-fill-opacity, 0)' }}
      />
    </Icon>
  )
}

export function CommentIcon({ size = 17, className }: IconProps) {
  return (
    <Icon size={size} className={className} viewBox="0 0 20 20" stroke={1.3}>
      <path d="M3 9.6c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5-3.1 6.5-7 6.5c-.8 0-1.6-.1-2.3-.4L4 17.2l1-3.1A6.1 6.1 0 0 1 3 9.6Z" />
    </Icon>
  )
}

/** Ramo com folhas — estado vazio, convite discreto à ação. */
export function SproutIcon({ size = 30, className }: IconProps) {
  return (
    <Icon size={size} className={className} viewBox="0 0 32 32" stroke={1.4}>
      <path d="M16 28V15" />
      <path d="M16 17c0-4.5 3.3-7.6 8-8-0.4 4.8-3.5 8-8 8Z" fill="currentColor" fillOpacity="0.5" stroke="none" />
      <path d="M16 20c0-3.8-2.8-6.4-6.7-6.7 0.3 4 2.9 6.7 6.7 6.7Z" fill="currentColor" fillOpacity="0.35" stroke="none" />
    </Icon>
  )
}

/* ===== Navegação primária ===== */

export function HomeIcon({ size = 20, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M4 11.2 12 4l8 7.2M6.4 9.6V20h11.2V9.6" />
    </Icon>
  )
}

export function CommunitiesIcon({ size = 20, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="9" cy="12" r="5.2" />
      <circle cx="15" cy="12" r="5.2" />
    </Icon>
  )
}

export function CirclesIcon({ size = 20, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="5.4" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="17.7" cy="15" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="6.3" cy="15" r="1.7" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function PanelIcon({ size = 20, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2.4" />
      <path d="M4 10h16M10 10v10" />
    </Icon>
  )
}

export function StoreIcon({ size = 20, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M6 8h12l-1 11.2a1 1 0 0 1-1 .8H8a1 1 0 0 1-1-.8L6 8Z" />
      <path d="M9.2 8V6.4a2.8 2.8 0 0 1 5.6 0V8" />
    </Icon>
  )
}

export function CalendarIcon({ size = 20, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect x="4" y="5.5" width="16" height="15" rx="2.4" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </Icon>
  )
}

export function FeedIcon({ size = 20, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2.4" />
      <path d="M7.5 9h9M7.5 12.5h9M7.5 16h5" />
    </Icon>
  )
}

export function MessageIcon({ size = 20, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-4 3.5V16H6.5" />
      <path d="M8 8.5h8M8 11.5h5" />
    </Icon>
  )
}

export function BellIcon({ size = 20, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.2 5.5 1.9 6.2a.6.6 0 0 1-.4 1H5a.6.6 0 0 1-.4-1c.7-.7 1.9-2.2 1.9-6.2Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Icon>
  )
}

export function BookIcon({ size = 20, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M5 4.5h9a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2.5H5V4.5Z" />
      <path d="M17 7.5h2v12.5A2.5 2.5 0 0 0 16.5 17.5" />
    </Icon>
  )
}

export function ChevronRightIcon({ size = 18, className }: IconProps) {
  return (
    <Icon size={size} className={className} stroke={1.5}>
      <path d="M9 6l6 6-6 6" />
    </Icon>
  )
}

export function ChevronLeftIcon({ size = 18, className }: IconProps) {
  return (
    <Icon size={size} className={className} stroke={1.5}>
      <path d="M15 6l-6 6 6 6" />
    </Icon>
  )
}

export function PlusIcon({ size = 24, className }: IconProps) {
  return (
    <Icon size={size} className={className} stroke={1.7}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function UserIcon({ size = 20, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="12" cy="8.4" r="3.8" />
      <path d="M5.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
    </Icon>
  )
}

/** Marcador de dia em forma de folha — trilha de progresso de desafios. */
export function LeafDayMark({ size = 22, state }: { size?: number; state: 'locked' | 'today' | 'completed' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      opacity={state === 'locked' ? 0.4 : 1}
    >
      <g transform="rotate(-45 12 12)">
        <ellipse
          cx="12"
          cy="12"
          rx="8.4"
          ry="5"
          stroke="currentColor"
          strokeWidth={state === 'today' ? 1.7 : 1.35}
          fill={state === 'completed' ? 'currentColor' : 'none'}
          fillOpacity={state === 'completed' ? 0.3 : 0}
        />
        <path d="M4 12h16" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </g>
    </svg>
  )
}

// SALVOS — mesmo padrão do HeartIcon: caminho sempre presente,
// preenchimento controlado por --bookmark-fill-opacity via CSS.
export function BookmarkIcon({ size = 17, className }: IconProps) {
  return (
    <Icon size={size} className={className} viewBox="0 0 20 20" stroke={1.3}>
      <path
        d="M5.8 3.5h8.4a1 1 0 0 1 1 1v12.1l-5.2-3.15-5.2 3.15V4.5a1 1 0 0 1 1-1Z"
        fill="currentColor"
        style={{ fillOpacity: 'var(--bookmark-fill-opacity, 0)' }}
      />
    </Icon>
  )
}

/** Brilho — acento alegre do "Momento de alegria". */
export function SparkleIcon({ size = 18, className }: IconProps) {
  return (
    <Icon size={size} className={className} stroke={1.15}>
      <path
        d="M13 2.5c.6 3.7 1.8 4.9 5.5 5.5-3.7.6-4.9 1.8-5.5 5.5-.6-3.7-1.8-4.9-5.5-5.5 3.7-.6 4.9-1.8 5.5-5.5Z"
        fill="currentColor"
        fillOpacity="0.55"
      />
      <path
        d="M6.5 14c.3 2 1 2.7 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.3 2.7-1 3-3Z"
        fill="currentColor"
        fillOpacity="0.4"
      />
    </Icon>
  )
}

/** Seta de retorno — ação "Responder" no Feed de Conversa. */
export function ReplyIcon({ size = 14, className }: IconProps) {
  return (
    <Icon size={size} className={className} stroke={1.6}>
      <path d="M9 7 4 12l5 5M4 12h9a7 7 0 0 1 7 7" />
    </Icon>
  )
}

/* ===== Reutilizáveis adicionados no redesign (adotar conforme a UI pedir) ===== */

/** Confirmação — "check" fino. */
export function CheckIcon({ size = 18, className }: IconProps) {
  return (
    <Icon size={size} className={className} stroke={1.6}>
      <path d="M4.5 12.5 9 17l10.5-11" />
    </Icon>
  )
}

/** Fechar / dispensar. */
export function CloseIcon({ size = 18, className }: IconProps) {
  return (
    <Icon size={size} className={className} stroke={1.6}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  )
}

/** Busca. */
export function SearchIcon({ size = 18, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="11" cy="11" r="6.4" />
      <path d="m20 20-4.2-4.2" />
    </Icon>
  )
}

/** Seta para a direita — "ver todos", navegação editorial. */
export function ArrowRightIcon({ size = 18, className }: IconProps) {
  return (
    <Icon size={size} className={className} stroke={1.5}>
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </Icon>
  )
}
