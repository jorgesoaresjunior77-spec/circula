// Ícones do Carro em Dia: traço fino rosé-dourado, 48x48, no estilo dos ícones do Círcula.
// O banco guarda só o NOME do ícone; o desenho vive aqui.

const P: Record<string, React.ReactNode> = {
  carro: (
    <>
      <path d="M8 29v-6l4-9h24l4 9v6" />
      <path d="M6 29h36v6a2 2 0 0 1-2 2h-3v-3H11v3H8a2 2 0 0 1-2-2v-6Z" />
      <circle cx="15" cy="28" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="33" cy="28" r="1.6" fill="currentColor" stroke="none" />
      <path d="M12 23h24" />
    </>
  ),
  alerta: (
    <>
      <path d="M24 7 5 40h38L24 7Z" />
      <path d="M24 19v10" />
      <circle cx="24" cy="34" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  luz: (
    <>
      <path d="M15 33a11 11 0 1 1 18 0v4H15v-4Z" />
      <path d="M18 41h12M24 4v4M8 13l3 3M40 13l-3 3" />
    </>
  ),
  chave: (
    <>
      <circle cx="16" cy="16" r="8" />
      <path d="M22 22 41 41M33 33l5-5M28 28l4-4" />
    </>
  ),
  pneu: (
    <>
      <circle cx="24" cy="24" r="17" />
      <circle cx="24" cy="24" r="6" />
      <path d="M24 7v11M24 30v11M7 24h11M30 24h11" />
    </>
  ),
  oficina: (
    <>
      <path d="M5 21 24 8l19 13" />
      <path d="M9 19v21h30V19" />
      <path d="M19 40V29h10v11" />
    </>
  ),
  doc: (
    <>
      <path d="M12 5h18l8 8v30H12V5Z" />
      <path d="M30 5v8h8M18 22h14M18 29h14M18 36h8" />
    </>
  ),
  escudo: (
    <>
      <path d="M24 5 9 11v11c0 10 6 17 15 21 9-4 15-11 15-21V11L24 5Z" />
      <path d="m17 24 5 5 9-10" />
    </>
  ),
  brilho: (
    <>
      <path d="M24 6l4 11 11 4-11 4-4 11-4-11-11-4 11-4 4-11Z" />
      <path d="M38 6v6M35 9h6" />
    </>
  ),
  moeda: (
    <>
      <circle cx="24" cy="24" r="17" />
      <path d="M29 17c-1-2-3-3-5-3-3 0-5 1.600-5 4s2 3.200 5 4 5 1.700 5 4.200S27 31 24 31c-2.400 0-4.400-1.100-5.200-3M24 10v4M24 31v4" />
    </>
  ),
}

export const CAR_ICON_NAMES = Object.keys(P)

export function CarIcon({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <svg className="car-icon" viewBox="0 0 48 48" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name] ?? P.carro}
    </svg>
  )
}
