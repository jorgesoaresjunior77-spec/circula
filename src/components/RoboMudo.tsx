import { useRobo } from '../hooks/useRobo'

/** Botão de mudo do robô (o mesmo estado vale no tour, na Ajuda e nos Planos). */
export function RoboMudo({ className }: { className?: string }) {
  const { mudo, alternarMudo } = useRobo()
  return (
    <button
      type="button"
      className={`robo-mudo${className ? ` ${className}` : ''}`}
      onClick={alternarMudo}
      aria-pressed={mudo}
      aria-label={mudo ? 'Ligar o som do robô' : 'Desligar o som do robô'}
      title={mudo ? 'Ligar o som do robô' : 'Desligar o som do robô'}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5Z" />
        {mudo ? <path d="m16 9.5 5 5m0-5-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />}
      </svg>
    </button>
  )
}
