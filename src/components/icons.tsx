interface IconProps {
  size?: number
  className?: string
}

export function HeartIcon({ size = 17, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M10 17.2s-6.8-4.1-6.8-9.1a3.9 3.9 0 0 1 6.8-2.6 3.9 3.9 0 0 1 6.8 2.6c0 5-6.8 9.1-6.8 9.1Z"
        fill="currentColor"
        style={{ fillOpacity: 'var(--heart-fill-opacity, 0)' }}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CommentIcon({ size = 17, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 9.6c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5-3.1 6.5-7 6.5c-.8 0-1.6-.1-2.3-.4L4 17.2l1-3.1A6.1 6.1 0 0 1 3 9.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Ramo com folhas — estado vazio, convite discreto à ação. */
export function SproutIcon({ size = 30, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 28V15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M16 17c0-4.5 3.3-7.6 8-8-0.4 4.8-3.5 8-8 8Z"
        fill="currentColor"
        fillOpacity="0.5"
      />
      <path
        d="M16 20c0-3.8-2.8-6.4-6.7-6.7 0.3 4 2.9 6.7 6.7 6.7Z"
        fill="currentColor"
        fillOpacity="0.35"
      />
    </svg>
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
          strokeWidth={state === 'today' ? 1.8 : 1.4}
          fill={state === 'completed' ? 'currentColor' : 'none'}
          fillOpacity={state === 'completed' ? 0.3 : 0}
        />
        <path d="M4 12h16" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </g>
    </svg>
  )
}
