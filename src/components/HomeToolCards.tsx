import type { ComponentType } from 'react'
import type { NavKey } from './PrimaryNav'
import { CalendarIcon, DropIcon, HeartIcon } from './icons'

// Três atalhos de ferramentas (Calendário, Água, IMC). A imagem ocupa cerca
// de 80% do card; sem imagem cadastrada, entra um fundo suave com o ícone.

interface Tool {
  key: NavKey
  title: string
  Icon: ComponentType<{ size?: number; className?: string }>
}

const TOOLS: Tool[] = [
  { key: 'agenda', title: 'Calendário', Icon: CalendarIcon },
  { key: 'agua', title: 'Água', Icon: DropIcon },
  { key: 'imc', title: 'IMC', Icon: HeartIcon },
]

interface Props {
  onNavigate: (key: NavKey) => void
  covers?: Partial<Record<NavKey, string | null>>
}

export function HomeToolCards({ onNavigate, covers = {} }: Props) {
  return (
    <section className="home-tools" aria-label="Ferramentas">
      {TOOLS.map(({ key, title, Icon }) => {
        const cover = covers[key]
        return (
          <button key={key} type="button" className="home-tool" onClick={() => onNavigate(key)}>
            <span className="home-tool-media" aria-hidden="true">
              {cover ? <img src={cover} alt="" loading="lazy" /> : <Icon size={30} />}
            </span>
            <span className="home-tool-title">{title}</span>
          </button>
        )
      })}
    </section>
  )
}
