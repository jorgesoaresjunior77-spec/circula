import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { NavKey } from './PrimaryNav'
import { TourGuide } from './TourGuide'
import type { GuideMood } from './TourGuide'

// Tour guiado: acontece todo na PÁGINA INICIAL e aponta, um por vez, os
// lugares de verdade onde a pessoa toca para entrar e interagir (atalhos,
// Menu, agenda, Círculos, revista, Feed, perfil e sino). Cada passo destaca
// o elemento real da tela com um "buraco" de luz e mostra um balão ao lado.
//
// O alvo é procurado por seletores CSS, em ordem; vale o primeiro que estiver
// visível. Se nenhum existir (ex.: comunidade ainda sem Círculos), o balão
// aparece no centro, sem destaque — o tour nunca trava.
//
// O balão mede a própria altura e se posiciona abaixo do alvo quando cabe,
// acima quando não cabe e, se o alvo ocupa quase a tela toda, fica preso no
// rodapé da tela — sempre inteiro dentro da tela.

interface TourStep {
  /** Seletores do alvo, em ordem de preferência. */
  targets: string[]
  title: string
  text: string
  /** Passo que só existe quando o elemento está na tela (ex.: botão Nutri só para paciente). */
  optional?: boolean
  /** Animação explicativa sobre o destaque: tocar ou deslizar. */
  gesture?: 'tap' | 'swipe'
}

export const TOUR_STEPS: TourStep[] = [
  {
    targets: ['.home-greeting', '#tour-nav-desktop-inicio', '#tour-nav-mobile-inicio'],
    title: 'Página inicial',
    text: 'Tudo começa aqui. Toque no sol para ver a previsão do tempo da sua cidade.',
  },
  {
    targets: ['.home-tools'],
    title: 'Atalhos do dia',
    text: 'Antes de Tudo (seus hábitos da manhã), Água (meta do dia, registros e gráfico da semana e do mês) e IMC. Toque em um deles para abrir.',
  },
  {
    targets: ['.exp-strip', '.exp-viewport'],
    title: 'Menu',
    text: 'Em "Hoje", deslize para o lado e toque em um cartão: Meu Perfil, Help Nutri, Meu Jardim, Assine o Círcula e Convite (para chamar uma amiga). Eventos, Loja e Receitas estão mais abaixo, em "Descobrir".',
    gesture: 'swipe',
  },
  {
    targets: ['.home-time'],
    title: 'Agenda e relógio',
    text: 'Toque na agenda para anotar compromissos. Toque no relógio para ver a hora e o clima em qualquer lugar do mundo.',
  },
  {
    targets: ['.circ-strip'],
    title: 'Círculos',
    text: 'Grupos por tema. Toque em um Círculo, entre nele e deixe a sua primeira mensagem. Você também pode sugerir um novo.',
  },
  {
    targets: ['.mag2-viewport', '.mag2-stack'],
    title: 'Revista',
    text: 'Toque em uma capa para ler a edição inteira aqui mesmo, virando as páginas.',
    gesture: 'tap',
  },
  {
    targets: ['.home-wheel'],
    title: 'Mais conteúdos',
    text: 'No menu que rola, toque em Dicas de leitura, Respiração, Playlist, Wellness ou Lista de Compras.',
    optional: true,
    gesture: 'tap',
  },
  {
    targets: ['.home-pair .menu-banner-wrap'],
    title: 'Meu Chef',
    text: 'Escolha os pratos e receba bem: o Meu Chef monta o cardápio do seu encontro com as receitas da nutricionista.',
    optional: true,
    gesture: 'tap',
  },
  {
    targets: ['.gratitude-card-wrap'],
    title: 'Diário da Gratidão',
    text: 'Uma oração ou passagem da Bíblia por dia, as 5 gratidões de hoje, seus pedidos e a sua jornada. É um momento só seu, e tudo o que você escreve fica privado.',
    optional: true,
    gesture: 'tap',
  },
  {
    targets: ['.home-pair--feature .menu-banner-wrap'],
    title: 'Para você',
    text: 'Se exercite em casa (escolha o tempo e o que quer trabalhar, e o treino é montado na hora) e Dicas de Séries / Filmes, com a plataforma e a classificação de cada indicação.',
    optional: true,
    gesture: 'tap',
  },
  {
    targets: ['.home-plans-wrap'],
    title: 'Planos e assinaturas',
    text: 'Veja os conteúdos que você pode assinar, com desconto nos planos de 6 e 12 meses, e o Círcula Premium com tudo junto.',
    optional: true,
    gesture: 'tap',
  },
  {
    targets: ['.home-partners'],
    title: 'Parceiros',
    text: 'As marcas que caminham com a comunidade. Toque em um logo para conhecer o parceiro.',
    optional: true,
    gesture: 'tap',
  },
  {
    targets: ['.home-footer'],
    title: 'Rodapé',
    text: 'Termos de Uso, Política de Privacidade e como falar com a sua nutricionista: tudo o que você precisa saber sobre o app, no fim da página.',
    optional: true,
  },
  {
    targets: ['.bottom-nav', '.topnav'],
    title: 'Menu de baixo',
    text: 'Seu atalho para o essencial: Início, Feed, Ajuda, Nutri (para quem é paciente) e Meu perfil. Ele fica sempre à mão enquanto você usa o app.',
    optional: true,
  },
  {
    targets: ['#tour-nav-mobile-feed', '#tour-nav-desktop-feed'],
    title: 'Feed',
    text: 'Aqui ficam as conversas da comunidade. Publique, curta, comente, responda e vote nas enquetes.',
  },
  {
    targets: ['#tour-nav-mobile-ajuda', '#tour-nav-desktop-ajuda'],
    title: 'Ajuda',
    text: 'Central de Ajuda com respostas para as dúvidas mais comuns, e o Help Nutri para falar direto com a nutricionista.',
    optional: true,
    gesture: 'tap',
  },
  {
    targets: ['#tour-nav-mobile-nutri', '#tour-nav-desktop-nutri'],
    title: 'Nutri',
    text: 'O seu plano alimentar, a agenda de consultas (você pode cancelar ou pedir reagendamento), orientações e tarefas, medidas e fotos de evolução.',
    optional: true,
    gesture: 'tap',
  },
  {
    targets: ['#tour-nav-mobile-perfil', '#tour-nav-desktop-perfil'],
    title: 'Meu perfil',
    text: 'Sua capa, suas fotos, os depoimentos que você recebe, o Meu Jardim, o convite para amigas, a sua assinatura e a troca de senha. No Feed, toque na foto de outra participante para visitar o perfil dela.',
  },
  {
    targets: ['#tour-notification-bell'],
    title: 'Notificações',
    text: 'O sino avisa sobre respostas, consultas, plano alimentar e novidades. Toque em um aviso e ele leva você direto ao lugar.',
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

const CARD_GAP = 12
const EDGE = 12

function isVisible(el: HTMLElement): boolean {
  // jsdom não calcula layout: lá `offsetParent` só existe quando o teste define.
  return el.offsetParent !== null || el.getClientRects().length > 0
}

function findTarget(step: TourStep): HTMLElement | null {
  let fallback: HTMLElement | null = null
  for (const selector of step.targets) {
    const el = document.querySelector<HTMLElement>(selector)
    if (!el) continue
    if (isVisible(el)) return el
    fallback ??= el
  }
  return fallback
}

export function Tour({ onNavigate, onDone }: TourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<SpotlightRect | null>(null)
  const [cardHeight, setCardHeight] = useState(190)
  const cardRef = useRef<HTMLDivElement>(null)
  // Passos opcionais só entram se o elemento existe na tela (ex.: Nutri só para paciente).
  const [steps] = useState(() => TOUR_STEPS.filter((st) => !st.optional || findTarget(st)))
  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1

  const measure = useCallback(() => {
    const el = findTarget(step)
    if (!el) {
      setRect(null)
      return
    }
    const box = el.getBoundingClientRect()
    const padding = 6
    // Recorta o destaque à área visível: um alvo mais alto que a tela não
    // empurra o balão para fora.
    const top = Math.max(EDGE / 2, box.top - padding)
    const bottom = Math.min(window.innerHeight - EDGE / 2, box.bottom + padding)
    const left = Math.max(EDGE / 2, box.left - padding)
    const right = Math.min(window.innerWidth - EDGE / 2, box.right + padding)
    if (bottom - top < 8 || right - left < 8) {
      setRect(null)
      return
    }
    setRect({ top, left, width: right - left, height: bottom - top })
  }, [step])

  // O tour inteiro acontece na página inicial.
  useEffect(() => {
    onNavigate('inicio')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Um instante para a tela renderizar; depois traz o alvo para o meio da
    // tela e mede. Mede de novo logo depois, para pegar a posição já parada.
    const raf = requestAnimationFrame(() => {
      findTarget(step)?.scrollIntoView({ block: 'center', behavior: 'instant' })
      measure()
    })
    const settle = window.setTimeout(measure, 350)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(settle)
    }
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

  // Altura real do balão (muda com o tamanho do texto de cada passo).
  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight
    if (h && Math.abs(h - cardHeight) > 2) setCardHeight(h)
  }, [stepIndex, rect, cardHeight])

  function goNext() {
    if (isLast) onDone()
    else setStepIndex((i) => i + 1)
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex((i) => i - 1)
  }

  const viewW = window.innerWidth
  const viewH = window.innerHeight
  const cardWidth = Math.min(340, viewW - EDGE * 2)

  let cardTop: number
  let cardLeft: number
  if (!rect) {
    cardTop = Math.max(EDGE, viewH / 2 - cardHeight / 2)
    cardLeft = Math.max(EDGE, viewW / 2 - cardWidth / 2)
  } else {
    const below = rect.top + rect.height + CARD_GAP
    const above = rect.top - CARD_GAP - cardHeight
    if (below + cardHeight <= viewH - EDGE) cardTop = below
    else if (above >= EDGE) cardTop = above
    else cardTop = viewH - cardHeight - EDGE // alvo grande: balão preso no rodapé
    // Centraliza no alvo, sem sair pelas laterais.
    const centered = rect.left + rect.width / 2 - cardWidth / 2
    cardLeft = Math.min(Math.max(EDGE, centered), viewW - cardWidth - EDGE)
  }

  // A bonequinha fica na quina do balão (em cima; embaixo quando o balão está no topo da tela)
  // e aponta o braço para o centro do destaque.
  const guideAbove = cardTop >= 96
  const guideX = cardLeft + 36
  const guideY = guideAbove ? cardTop - 40 : cardTop + cardHeight + 40
  const pointAngle = rect ? (Math.atan2(rect.top + rect.height / 2 - guideY, rect.left + rect.width / 2 - guideX) * 180) / Math.PI : 20
  const mood: GuideMood = (['smile', 'happy', 'wink'] as GuideMood[])[stepIndex % 3]

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="Tour guiado do Círcula">
      {rect && (
        <div
          className="tour-spotlight"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}
      {!rect && <div className="tour-overlay-dim" />}
      {rect && step.gesture && (
        <div className={`tour-gesture tour-gesture--${step.gesture}`} aria-hidden="true" style={{ top: rect.top + rect.height / 2, left: rect.left + rect.width / 2 }}>
          <span className="tour-gesture-ring" />
          <span className="tour-gesture-hand">{step.gesture === 'swipe' ? '👉' : '👆'}</span>
        </div>
      )}

      <div className={`tour-guide-wrap${guideAbove ? '' : ' tour-guide-wrap--below'}`} style={{ top: guideAbove ? cardTop - 84 : cardTop + cardHeight - 6, left: cardLeft + 4 }}>
        <TourGuide mood={mood} pointAngle={pointAngle} />
      </div>

      <div ref={cardRef} className="tour-card" style={{ top: cardTop, left: cardLeft, width: cardWidth }}>
        <p className="tour-card-step">
          {stepIndex + 1} / {steps.length}
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
