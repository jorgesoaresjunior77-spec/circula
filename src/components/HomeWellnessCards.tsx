import type { ComponentType } from 'react'
import type { NavKey } from './PrimaryNav'
import { BookIcon, ChevronRightIcon, DropIcon, HeartIcon, SparkleIcon } from './icons'

// Cards horizontais, finos e compactos, das áreas de bem-estar. Ficam
// depois dos cards editoriais (Eventos/Receitas/Loja) e antes do card de
// assinaturas, sem competir com os conteúdos principais da Home.

interface WellnessCard {
  key: NavKey
  title: string
  subtitle?: string
  Icon: ComponentType<{ size?: number; className?: string }>
}

const CARDS: WellnessCard[] = [
  {
    key: 'antes-de-tudo',
    title: 'ANTES DE TUDO',
    subtitle: 'Pequenos hábitos. Uma vida melhor.',
    Icon: SparkleIcon,
  },
  { key: 'agua', title: 'Calculadora de água', Icon: DropIcon },
  { key: 'leitura', title: 'Dicas de Leitura', Icon: BookIcon },
  { key: 'respiracao', title: 'Respiração e Meditação', Icon: HeartIcon },
]

interface HomeWellnessCardsProps {
  onNavigate: (key: NavKey) => void
  /** Profissional: acesso ao cadastro das mensagens do pop-up diário. */
  canManageInspirations?: boolean
}

export function HomeWellnessCards({ onNavigate, canManageInspirations = false }: HomeWellnessCardsProps) {
  const cards = canManageInspirations
    ? [...CARDS, { key: 'inspiracoes' as NavKey, title: 'Mensagens do dia', subtitle: 'Cadastro do pop-up diário', Icon: SparkleIcon }]
    : CARDS
  return (
    <section className="home-wellness" aria-label="Bem-estar">
      {cards.map(({ key, title, subtitle, Icon }) => (
        <button key={key} type="button" className="home-wellness-card" onClick={() => onNavigate(key)}>
          <span className="home-wellness-icon" aria-hidden="true">
            <Icon size={22} />
          </span>
          <span className="home-wellness-text">
            <span className="home-wellness-title">{title}</span>
            {subtitle && <span className="home-wellness-sub">{subtitle}</span>}
          </span>
          <ChevronRightIcon size={18} className="home-wellness-chevron" />
        </button>
      ))}
    </section>
  )
}
