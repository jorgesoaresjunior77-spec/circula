// Ícones próprios do módulo Finanças: traço fino rosé-dourado em 48x48, no estilo dos ícones do Círcula.
// A categoria guarda só o NOME do ícone; o desenho vive aqui.

const P: Record<string, React.ReactNode> = {
  mercado: (<><path d="M5 8h6l4 22h22l4-16H13" /><circle cx="19" cy="38" r="2.5" /><circle cx="34" cy="38" r="2.5" /></>),
  casa: (<><path d="M6 23 24 8l18 15" /><path d="M10 20v22h28V20" /><path d="M20 42V29h8v13" /></>),
  transporte: (<><path d="M7 30v-7l4-10h26l4 10v7" /><path d="M5 30h38v6H5z" /><circle cx="14" cy="39" r="3" /><circle cx="34" cy="39" r="3" /></>),
  saude: (<><path d="M24 40S7 30 7 18a9 9 0 0 1 17-4 9 9 0 0 1 17 4c0 12-17 22-17 22Z" /><path d="M24 17v10M19 22h10" /></>),
  lazer: (<><path d="M24 6l5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1 5-12Z" /></>),
  fora: (<><path d="M14 6v14a4 4 0 0 0 4 4v18M10 6v10M18 6v10" /><path d="M34 42V6c-5 4-7 10-7 17h7" /></>),
  edu: (<><path d="M6 12c6-3 12-3 18 1 6-4 12-4 18-1v26c-6-3-12-3-18 1-6-4-12-4-18-1V12Z" /><path d="M24 13v26" /></>),
  roupas: (<><path d="M17 8 6 15l5 7 5-3v21h16V19l5 3 5-7-11-7c-1 4-4 6-7 6s-6-2-7-6Z" /></>),
  cuidados: (<><circle cx="24" cy="24" r="5" /><path d="M24 7c4 4 4 9 0 12-4-3-4-8 0-12ZM24 41c-4-4-4-9 0-12 4 3 4 8 0 12ZM7 24c4-4 9-4 12 0-3 4-8 4-12 0ZM41 24c-4 4-9 4-12 0 3-4 8-4 12 0Z" /></>),
  contas: (<><path d="M12 5h24v38l-4-3-4 3-4-3-4 3-4-3-4 3V5Z" /><path d="M18 14h12M18 21h12M18 28h7" /></>),
  pets: (<><circle cx="13" cy="20" r="3.5" /><circle cx="22" cy="12" r="3.5" /><circle cx="33" cy="14" r="3.5" /><circle cx="39" cy="24" r="3.5" /><path d="M24 25c-7 0-12 7-10 12 2 4 7 2 10 2s8 2 10-2c2-5-3-12-10-12Z" /></>),
  estrela: (<><path d="M24 5l5.500 12.500L43 19l-10 9.500 3 13.500-12-7-12 7 3-13.500L5 19l13.500-1.500L24 5Z" /></>),
  salario: (<><rect x="5" y="12" width="38" height="26" rx="4" /><path d="M5 20h38" /><circle cx="35" cy="29" r="2.500" /></>),
  consultorio: (<><path d="M14 6v12a8 8 0 0 0 16 0V6" /><path d="M22 26v6a8 8 0 0 0 16 0" /><circle cx="38" cy="26" r="3" /></>),
  vendas: (<><path d="M6 26 26 6h14v14L20 40 6 26Z" /><circle cx="32" cy="14" r="2.500" /></>),
  freelance: (<><rect x="9" y="11" width="30" height="21" rx="3" /><path d="M4 38h40M20 32v6M28 32v6" /></>),
  aluguel: (<><circle cx="16" cy="28" r="9" /><path d="M23 22 40 7M33 14l5 5M29 18l4 4" /></>),
  poupanca: (<><path d="M10 26c0-8 6-13 14-13 4 0 7 1 9 3h6l-1 6c2 2 3 4 3 6v5h-6l-2 4h-6l-1-3h-4l-1 3h-6l-2-5c-2-1-3-3-3-6Z" /><circle cx="33" cy="22" r="1.400" fill="currentColor" stroke="none" /></>),
  cripto: (<><path d="M24 5 40 14v20L24 43 8 34V14L24 5Z" /><path d="M19 17h8a4 4 0 0 1 0 8h-8m0 0h9a4 4 0 0 1 0 8h-9M19 17v16M23 13v4M23 33v4" /></>),
  cdi: (<><path d="M6 40h36" /><path d="M9 32 19 21l7 6 13-16" /><path d="M31 11h8v8" /></>),
  cdb: (<><path d="M24 5 9 11v11c0 10 6 17 15 21 9-4 15-11 15-21V11L24 5Z" /><path d="M18 24l4 4 8-9" /></>),
  dolar: (<><circle cx="24" cy="24" r="17" /><path d="M29 17c-1-2-3-3-5-3-3 0-5 1.600-5 4s2 3.200 5 4 5 1.700 5 4.200S27 31 24 31c-2.400 0-4.400-1.100-5.200-3M24 10v4M24 31v4" /></>),
  presente: (<><rect x="7" y="18" width="34" height="10" rx="2" /><path d="M10 28v14h28V28M24 18v24" /><path d="M24 18c-6 0-10-2-10-6s6-5 10 6c4-11 10-10 10-6s-4 6-10 6Z" /></>),
  cafe: (<><path d="M9 17h26v12a10 10 0 0 1-10 10h-6A10 10 0 0 1 9 29V17Z" /><path d="M35 20h3a4 4 0 0 1 0 9h-3M17 6v5M24 6v5M31 6v5" /></>),
  viagem: (<><path d="M42 8 6 22l12 5 5 12L42 8Z" /><path d="m18 27 24-19" /></>),
  celular: (<><rect x="13" y="4" width="22" height="40" rx="5" /><path d="M21 38h6" /></>),
  filhos: (<><circle cx="17" cy="16" r="6" /><circle cx="33" cy="21" r="4.500" /><path d="M6 40c0-7 5-12 11-12s11 5 11 12M27 40c0-4 3-8 6-8s7 3 7 8" /></>),
  fitness: (<><path d="M4 20v8M9 15v18M39 15v18M44 20v8M9 24h30" /></>),
  musica: (<><path d="M18 36V10l22-5v26" /><circle cx="12" cy="36" r="6" /><circle cx="34" cy="31" r="6" /></>),
  ferramenta: (<><path d="M30 6a10 10 0 0 0-9 13L6 34l8 8 15-15a10 10 0 0 0 13-9l-7 4-5-5 4-7Z" /></>),
  cartao: (<><rect x="4" y="11" width="40" height="26" rx="4" /><path d="M4 19h40M10 30h10" /></>),
  coracao: (<><path d="M24 41S6 30 6 17a10 10 0 0 1 18-5 10 10 0 0 1 18 5c0 13-18 24-18 24Z" /></>),
  flor: (<><circle cx="24" cy="20" r="4" /><path d="M24 8c3 3 3 6 0 8-3-2-3-5 0-8ZM34 15c0 4-2 6-6 6 0-4 2-6 6-6ZM14 15c4 0 6 2 6 6-4 0-6-2-6-6ZM24 24v18M24 34c-6 0-9-3-10-7M24 36c5 0 8-2 10-6" /></>),
}

export const FIN_ICON_IDS = Object.keys(P)
/** Ícones que a pessoa pode escolher ao criar uma categoria nova. */
export const FIN_ICON_PICKER = ['estrela', 'presente', 'cafe', 'viagem', 'celular', 'filhos', 'fitness', 'musica', 'ferramenta', 'cartao', 'coracao', 'flor', 'casa', 'mercado', 'saude', 'edu', 'pets', 'dolar']

export function FinIcon({ name, size = 30 }: { name: string; size?: number }) {
  return (
    <svg className="fin-icon" viewBox="0 0 48 48" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name] ?? P.estrela}
    </svg>
  )
}
