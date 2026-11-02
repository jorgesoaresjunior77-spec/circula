import { useCallback, useEffect, useState } from 'react'
import type { NavKey } from './PrimaryNav'

// Etapa 9 (evolução/experiência/gamificação) — tour guiado real: destaca
// elementos VERDADEIROS da interface (nunca uma captura de tela ou
// ilustração) via um "buraco" de spotlight sobre o elemento + um cartão
// de texto ao lado. `navKey`, quando presente, navega para aquele
// destino ANTES de medir a posição — a pessoa vê a tela de verdade atrás
// do destaque, não só o nome dela. `elementId` é usado para alvos que
// não são da navegação principal (ex.: sino de notificações).
//
// Cada passo mede a posição do elemento-alvo no momento em que entra
// (useLayoutEffect-like via useEffect + rAF) e reage a resize/scroll —
// funciona tanto no layout desktop (.topnav-item) quanto na cápsula
// mobile (.bottom-nav-item), escolhendo qualquer um dos dois ids que
// estiver de fato visível (offsetParent !== null).

interface TourStep {
  navKey?: NavKey
  elementId?: string
  title: string
  text: string
}

const TOUR_STEPS: TourStep[] = [
  {
    navKey: 'inicio',
    title: 'Página inicial',
    text: 'Aqui você encontra sua comunidade, os Círculos, o Instagram e as novidades do dia.',
  },
  {
    navKey: 'circulos',
    title: 'Círculos',
    text: 'Pequenos grupos dentro da comunidade, por tema ou interesse — entre em quantos quiser.',
  },
  {
    navKey: 'circulos',
    title: 'Como participar de um círculo',
    text: 'Toque em um Círculo para ver as publicações dele e no botão "Participar" para entrar.',
  },
  {
    navKey: 'feed',
    title: 'Publicações e interações',
    text: 'O Feed reúne as publicações da comunidade — curta, comente e compartilhe suas experiências.',
  },
  {
    navKey: 'jardim',
    title: 'Meu Jardim',
    text: 'Seu espaço de evolução: desafios mensais, progressão anual e conquistas — tudo no seu ritmo.',
  },
  {
    navKey: 'perfil',
    title: 'Perfil pessoal',
    text: 'Sua foto, suas fotos, seus interesses e sua evolução no Meu Jardim, tudo em um só lugar.',
  },
  {
    elementId: 'tour-notification-bell',
    title: 'Notificações',
    text: 'O sino avisa sobre respostas, novidades da comunidade e tudo que precisa da sua atenção.',
  },
]

interface TourProps {
  onNavigate: (key: NavKey) => void
  onDone: () => void
}

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

function findVisibleElement(step: TourStep): HTMLElement | null {
  if (step.elementId) return document.getElementById(step.elementId)
  if (!step.navKey) return null
  const desktop = document.getElementById(`tour-nav-desktop-${step.navKey}`)
  if (desktop && desktop.offsetParent !== null) return desktop
  const mobile = document.getElementById(`tour-nav-mobile-${step.navKey}`)
  if (mobile && mobile.offsetParent !== null) return mobile
  return desktop ?? mobile
}

export function Tour({ onNavigate, onDone }: TourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<SpotlightRect | null>(null)
  const step = TOUR_STEPS[stepIndex]
  const isLast = stepIndex === TOUR_STEPS.length - 1

  const measure = useCallback(() => {
    const el = findVisibleElement(step)
    if (!el) {
      setRect(null)
      return
    }
    const box = el.getBoundingClientRect()
    const padding = 6
    setRect({
      top: box.top - padding,
      left: box.left - padding,
      width: box.width + padding * 2,
      height: box.height + padding * 2,
    })
  }, [step])

  useEffect(() => {
    if (step.navKey) onNavigate(step.navKey)
    // Dá um instante para a navegação re-renderizar antes de medir —
    // sem isto, a 1a medição de cada passo pode pegar a tela ANTERIOR
    // ainda montada (um frame de atraso é imperceptível aqui).
    const raf = requestAnimationFrame(() => {
      // Achado em teste real — sem isto, um alvo fora da área visível
      // (ex.: página já rolada para baixo quando o tour começa, ou ao
      // reabrir pelo Perfil) deixava o spotlight e o cartão posicionados
      // fora da tela, invisíveis, até a pessoa rolar manualmente. Rola
      // só NESTE momento (troca de passo) — nunca durante resize/scroll
      // (o outro efeito abaixo só remede, não rola de novo), para não
      // brigar com uma rolagem manual em andamento.
      const el = findVisibleElement(step)
      el?.scrollIntoView({ block: 'center', behavior: 'instant' })
      measure()
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex])

  useEffect(() => {
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [measure])

  function goNext() {
    if (isLast) onDone()
    else setStepIndex((i) => i + 1)
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex((i) => i - 1)
  }

  // Cartão abaixo do alvo quando há espaço; senão, acima.
  const cardTop = rect
    ? rect.top + rect.height + 12 + 160 < window.innerHeight
      ? rect.top + rect.height + 12
      : Math.max(12, rect.top - 172)
    : window.innerHeight / 2 - 80
  const cardLeft = rect
    ? Math.min(Math.max(12, rect.left), window.innerWidth - 300)
    : window.innerWidth / 2 - 150

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="Tour guiado do Círcula">
      {rect && (
        <div
          className="tour-spotlight"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}
      {!rect && <div className="tour-overlay-dim" />}

      <div className="tour-card" style={{ top: cardTop, left: cardLeft }}>
        <p className="tour-card-step">
          {stepIndex + 1} / {TOUR_STEPS.length}
        </p>
        <h3 className="tour-card-title">{step.title}</h3>
        <p className="tour-card-text">{step.text}</p>
        <div className="tour-card-actions">
          <button type="button" className="auth-link" onClick={onDone}>
            Pular tour
          </button>
          <div className="tour-card-nav">
            {stepIndex > 0 && (
              <button type="button" className="panel-content-action" onClick={goBack}>
                Voltar
              </button>
            )}
            <button type="button" className="onboarding-next" onClick={goNext}>
              {isLast ? 'Encerrar' : 'Avançar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
