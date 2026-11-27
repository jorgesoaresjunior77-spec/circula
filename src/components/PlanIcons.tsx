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

export function ListPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M4.5 6h3.2l2.600 12h12.200l2.400-8.800H9" />
      <circle cx="12" cy="23" r="1.500" />
      <circle cx="21" cy="23" r="1.500" />
    </Svg>
  )
}

export function ChefPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M10 14a4.500 4.500 0 0 1 1.500-8.700A5 5 0 0 1 21 5.300 4.500 4.500 0 0 1 22 14z" />
      <path d="M10 14v10.500h12V14" />
      <path d="M10 19h12" />
    </Svg>
  )
}

export function ExercisePlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M6 12v8M26 12v8M9.500 9v14M22.500 9v14M9.500 16h13" />
    </Svg>
  )
}

export function SeriesPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <rect x="5" y="8" width="22" height="15" rx="2.500" />
      <path d="M13.500 12.500l6 3.500-6 3.500z" />
      <path d="M11 26.500h10" />
    </Svg>
  )
}

export function TravelPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M16 4.500a8 8 0 0 0-8 8c0 6 8 15 8 15s8-9 8-15a8 8 0 0 0-8-8z" />
      <circle cx="16" cy="12.500" r="3" />
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

export function CarPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M5 19v-4.5l2.3-5.2A2 2 0 0 1 9.100 8h13.800a2 2 0 0 1 1.800 1.300L27 14.500V19" />
      <path d="M4 19h24v3.500a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V21H9v1.500a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
      <path d="M8 14.500h16" />
      <circle cx="9.500" cy="17.500" r=".8" fill="currentColor" />
      <circle cx="22.500" cy="17.500" r=".8" fill="currentColor" />
    </Svg>
  )
}

export function MoneyPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <rect x="4" y="8" width="24" height="16" rx="3" />
      <circle cx="16" cy="16" r="3.800" />
      <path d="M8 12v.1M24 20v.1" />
    </Svg>
  )
}

export function CupPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M7 13h15v6a6 6 0 0 1-6 6h-3a6 6 0 0 1-6-6v-6Z" />
      <path d="M22 15h2a3 3 0 0 1 0 6h-2.300" />
      <path d="M12 6c0 2 2 2 2 4M17 6c0 2 2 2 2 4" />
    </Svg>
  )
}

export function DropPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M16 4.500c4.500 6 8 10.200 8 14.500a8 8 0 0 1-16 0c0-4.300 3.500-8.500 8-14.500Z" />
      <path d="M12.500 19.500a3.500 3.500 0 0 0 3.500 3.500" />
    </Svg>
  )
}

export function ScalePlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <rect x="5" y="5" width="22" height="22" rx="5" />
      <path d="M10.500 13a7.500 7.500 0 0 1 11 0" />
      <path d="M16 16l2.500-3.500" />
    </Svg>
  )
}

export function CalcPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <rect x="7" y="4" width="18" height="24" rx="3" />
      <rect x="10.500" y="7.500" width="11" height="5" rx="1" />
      <path d="M11 17h.1M16 17h.1M21 17h.1M11 21h.1M16 21h.1M21 21h.1M11 25h.1M16 25h.1M21 25h.1" />
    </Svg>
  )
}

export function CalendarPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <rect x="5" y="7" width="22" height="20" rx="3" />
      <path d="M5 13h22M11 4.500v5M21 4.500v5" />
      <path d="M11 18h.1M16 18h.1M21 18h.1M11 22h.1M16 22h.1" />
    </Svg>
  )
}

export function GlobeClockPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <circle cx="16" cy="16" r="11" />
      <path d="M16 9.500V16l4.500 3" />
    </Svg>
  )
}

export function CloudPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="4" />
      <path d="M11 3.500v1.500M3.500 11H5M5.700 5.700l1 1" />
      <path d="M10 25h13a5 5 0 0 0 0-10 7 7 0 0 0-13 2.500A3.800 3.800 0 0 0 10 25Z" />
    </Svg>
  )
}

export function HeartBookPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M6 6.500h14a4 4 0 0 1 4 4V27H10a4 4 0 0 1-4-4V6.500Z" />
      <path d="M15 20.500s-4-2.400-4-5a2.200 2.200 0 0 1 4-1.300 2.200 2.200 0 0 1 4 1.300c0 2.600-4 5-4 5Z" />
    </Svg>
  )
}

export function FlowerPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <circle cx="16" cy="12" r="3" />
      <path d="M16 9c-1.500-4 3-6 3-1.500M19 12c4-1.500 6 3 1.500 3M16 15c1.500 4-3 6-3 1.500M13 12c-4 1.500-6-3-1.500-3" />
      <path d="M16 15v13M16 23c-3-3-6-2-7-1M16 25c3-3 6-2 7-1" />
    </Svg>
  )
}

export function PinCityPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M16 28s8-7.500 8-14a8 8 0 0 0-16 0c0 6.500 8 14 8 14Z" />
      <path d="M12.500 16v-3.500l3.500-2.500 3.500 2.500V16h-7Z" />
    </Svg>
  )
}

export function ChartPlanIcon(p: Props) {
  return (
    <Svg {...p}>
      <path d="M5 26h22" />
      <path d="M6 21l6-6 4 4 9-10" />
      <path d="M20 9h5v5" />
    </Svg>
  )
}

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
  minha_lista: ListPlanIcon,
  meu_chef: ChefPlanIcon,
  lista_inteligente: ListPlanIcon,
  exercicios: ExercisePlanIcon,
  series_filmes: SeriesPlanIcon,
  viagens: TravelPlanIcon,
  carro: CarPlanIcon,
  financas: MoneyPlanIcon,
  rachei: MoneyPlanIcon,
  antes_de_tudo: CupPlanIcon,
  agua: DropPlanIcon,
  imc: ScalePlanIcon,
  calculadora: CalcPlanIcon,
  agenda: CalendarPlanIcon,
  relogio: GlobeClockPlanIcon,
  previsao: CloudPlanIcon,
  diario: HeartBookPlanIcon,
  jardim: FlowerPlanIcon,
  cidade: PinCityPlanIcon,
  cotacoes: ChartPlanIcon,
}
