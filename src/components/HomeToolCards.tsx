import type { NavKey } from './PrimaryNav'

// Três atalhos de ponta a ponta, logo abaixo do banner: Antes de Tudo, Água e
// IMC. Sem caixas nem bordas: o ícone animado, com o nome bem pequeno em cima
// (sem passar da largura do ícone).
//   Antes de Tudo -> xícara de café com vapor subindo;
//   Água          -> gota com pingos caindo, de leve;
//   IMC           -> coração que pulsa como um batimento.
// As animações respeitam "reduzir movimento" (ficam paradas).

function CoffeeIcon() {
  return (
    <svg className="tool-icon tool-icon--coffee" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <g className="tool-steam" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
        <path className="tool-steam-line tool-steam-line--1" d="M16 14c-2-2.500 2-4 0-6.500" />
        <path className="tool-steam-line tool-steam-line--2" d="M23 14c-2-2.500 2-4 0-6.500" />
        <path className="tool-steam-line tool-steam-line--3" d="M30 14c-2-2.500 2-4 0-6.500" />
      </g>
      <path
        d="M10 20h24v9a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M34 23h2.500a4.500 4.500 0 0 1 0 9H33" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 42h28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
  { key: 'antes-de-tudo', title: 'Antes de Tudo', Icon: CoffeeIcon },
  { key: 'agua', title: 'Água', Icon: WaterIcon },
  { key: 'imc', title: 'IMC', Icon: HeartIcon },
]

interface Props {
  onNavigate: (key: NavKey) => void
}

export function HomeToolCards({ onNavigate }: Props) {
  return (
    <section className="home-tools home-tools--icons" aria-label="Ferramentas">
      {TOOLS.map(({ key, title, Icon }) => (
        <button
          key={key}
          type="button"
          className="home-tool"
          aria-label={title}
          title={title}
          onClick={() => onNavigate(key)}
        >
          <span className="home-tool-title" aria-hidden="true">
            {title}
          </span>
          <span className="home-tool-media" aria-hidden="true">
            <Icon />
          </span>
        </button>
      ))}
    </section>
  )
}
