import type { NavKey } from './PrimaryNav'

// Três atalhos lado a lado: Antes de Tudo, Água e IMC. Sem caixas nem
// bordas: só o ícone animado e o nome.
//   Antes de Tudo -> sol que brilha, enfraquece e volta a brilhar;
//   Água          -> gota com pingos caindo, de leve;
//   IMC           -> coração que pulsa como um batimento.
// As animações respeitam "reduzir movimento" (ficam paradas).

function SunIcon() {
  return (
    <svg className="tool-icon tool-icon--sun" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <g className="tool-sun-rays" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.6 10.6l4.2 4.2M33.2 33.2l4.2 4.2M10.6 37.4l4.2-4.2M33.2 14.8l4.2-4.2" />
      </g>
      <circle className="tool-sun-core" cx="24" cy="24" r="8" fill="currentColor" />
    </svg>
  )
}

function WaterIcon() {
  return (
    <svg className="tool-icon tool-icon--water" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M24 5c-5 7-10 12.2-10 18a10 10 0 0 0 20 0c0-5.800-5-11-10-18Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.14"
      />
      <circle className="tool-drip tool-drip--1" cx="14" cy="38" r="1.8" fill="currentColor" />
      <circle className="tool-drip tool-drip--2" cx="24" cy="38" r="1.8" fill="currentColor" />
      <circle className="tool-drip tool-drip--3" cx="34" cy="38" r="1.8" fill="currentColor" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg className="tool-icon tool-icon--heart" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M24 41S7 31 7 18.500A9.500 9.500 0 0 1 24 13a9.500 9.500 0 0 1 17 5.500C41 31 24 41 24 41Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const TOOLS: { key: NavKey; title: string; Icon: () => React.ReactElement }[] = [
  { key: 'antes-de-tudo', title: 'Antes de Tudo', Icon: SunIcon },
  { key: 'agua', title: 'Água', Icon: WaterIcon },
  { key: 'imc', title: 'IMC', Icon: HeartIcon },
]

interface Props {
  onNavigate: (key: NavKey) => void
}

export function HomeToolCards({ onNavigate }: Props) {
  return (
    <section className="home-tools" aria-label="Ferramentas">
      {TOOLS.map(({ key, title, Icon }) => (
        <button key={key} type="button" className="home-tool" onClick={() => onNavigate(key)}>
          <span className="home-tool-media" aria-hidden="true">
            <Icon />
          </span>
          <span className="home-tool-title">{title}</span>
        </button>
      ))}
    </section>
  )
}
