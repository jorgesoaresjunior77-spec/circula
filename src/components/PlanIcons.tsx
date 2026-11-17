// Ícones próprios dos planos (traço fino, cor herdada) para os cartões da
// página de Planos. Desenhados à mão em SVG: nada gerado por IA.

interface Props {
  size?: number
}

function Svg({ size = 34, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function CirculaPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <circle cx="16" cy="16" r="10.5" />
      <circle cx="16" cy="16" r="4.5" />
      <path d="M16 5.5v3M16 23.5v3M5.5 16h3M23.5 16h3" />
    </Svg>
  )
}

export function MagazinePlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <rect x="7" y="4.5" width="18" height="23" rx="2.2" />
      <path d="M11 10h10M11 14h10M11 18h5" />
      <rect x="17.5" y="17.5" width="3.5" height="5" rx="0.8" />
    </Svg>
  )
}

export function RecipesPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M9 14.5a4.5 4.5 0 0 1 2.2-8.2A5 5 0 0 1 21 6.8a4.3 4.3 0 0 1 2 7.7" />
      <path d="M9 14.5h14v10.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 9 25z" />
      <path d="M13 19.5h6" />
    </Svg>
  )
}

export function EbooksPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M5.5 7.5c3.6-1.2 7.2-.8 10.5 1.5v16.5c-3.3-2.3-6.9-2.7-10.5-1.5z" />
      <path d="M26.5 7.5c-3.6-1.2-7.2-.8-10.5 1.5v16.5c3.3-2.3 6.9-2.7 10.5-1.5z" />
    </Svg>
  )
}

export function HelpNutriPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M5.5 8.5a3 3 0 0 1 3-3h15a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H15l-5.5 5v-5h-1a3 3 0 0 1-3-3z" />
      <path d="M16 9.5c-2.2 0-3.5 1.5-3.5 3.3 0 2.4 3.5 4.7 3.5 4.7s3.5-2.3 3.5-4.7c0-1.8-1.3-3.3-3.5-3.3z" />
    </Svg>
  )
}

export function BreathingPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M4.5 12c3 0 3-3 6-3s3 3 6 3 3-3 6-3 3 3 5 3" />
      <path d="M4.5 18.5c3 0 3-3 6-3s3 3 6 3 3-3 6-3 3 3 5 3" />
      <path d="M4.5 25c3 0 3-3 6-3s3 3 6 3 3-3 6-3 3 3 5 3" />
    </Svg>
  )
}

export function PlaylistPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M12 21.5V8l12-2.5v13.5" />
      <circle cx="9" cy="22" r="3" />
      <circle cx="21" cy="19.5" r="3" />
    </Svg>
  )
}

export function WellnessPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M16 27c-6-4-9-8.3-9-12.3A5.7 5.7 0 0 1 16 10a5.7 5.7 0 0 1 9 4.7C25 18.7 22 23 16 27z" />
      <path d="M16 10V5M16 5c1.8 0 3.2 1 3.8 2.5M16 5c-1.8 0-3.2 1-3.8 2.5" />
    </Svg>
  )
}

export function ReadingPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M8 4.5h14a1.5 1.5 0 0 1 1.5 1.5v21l-8.5-5-8.5 5V6A1.5 1.5 0 0 1 8 4.5z" />
      <path d="M12 10h7M12 14h5" />
    </Svg>
  )
}

export function PremiumPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M5 11.5l5.5 4.5L16 6l5.5 10 5.5-4.5-2 13H7z" />
      <path d="M7.5 27.5h17" />
    </Svg>
  )
}

import type { ProductKey } from '../lib/plansCatalog'

export const PLAN_ICONS: Record<ProductKey | 'circula' | 'premium', (p: Props) => React.ReactElement> = {
  circula: CirculaPlanIcon,
  premium: PremiumPlanIcon,
  magazine: MagazinePlanIcon,
  receitas: RecipesPlanIcon,
  ebooks: EbooksPlanIcon,
  help_nutri: HelpNutriPlanIcon,
  respiracao: BreathingPlanIcon,
  playlist: PlaylistPlanIcon,
  wellness: WellnessPlanIcon,
  leitura: ReadingPlanIcon,
}
