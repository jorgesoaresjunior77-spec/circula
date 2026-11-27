import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { memberTrialDays } from '../lib/trialRule'
import type { NavKey } from './PrimaryNav'
import { RoboGuia, precarregarRobo } from './RoboGuia'
import type { RoboCena } from './RoboGuia'
import { RoboMudo } from './RoboMudo'
import { falar } from '../hooks/useRobo'
import type { RoboSom } from '../lib/roboSom'

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
  /** Passo de novidade: ganha o selo "Novo" (e é o único mostrado a quem já fez o tour). */
  isNew?: boolean
  /** Texto do botão de avançar neste passo (padrão: "Avançar"). */
  nextLabel?: string
  /** Cena do robô. 'apontar' = aponta para o destaque (cima, baixo, direita ou esquerda, conforme a posição). */
  cena?: RoboCena | 'apontar'
  /** Som do robô neste passo. */
  som?: RoboSom
}

/** Texto muito longo: o robô fica pensando em vez de apontar. */
const TEXTO_LONGO = 300

export const CITY_TOUR_TEXT =
  'Descubra lugares, serviços e eventos da sua cidade por categoria, de restaurantes a eletricistas. Indique o que você ama, dê estrelas e comente os lugares, veja os horários, salve seus favoritos e combine caminhadas e cafés com outras mulheres. Tem um negócio local? Reivindique o cadastro e peça destaque na capa.'

/** Marca no aparelho que o passo "Na minha cidade" já foi mostrado (some a novidade). */
const CITY_TOUR_SEEN_KEY = 'circula:tour-na-minha-cidade'
export function cityTourSeen(): boolean {
  try {
    return localStorage.getItem(CITY_TOUR_SEEN_KEY) === '1'
  } catch {
    return true
  }
}
export function markCityTourSeen() {
  try {
    localStorage.setItem(CITY_TOUR_SEEN_KEY, '1')
  } catch {
    /* sem storage: só não lembra */
  }
}

export const TOUR_STEPS: TourStep[] = [
  {
    targets: ['.home-greeting', '#tour-nav-desktop-inicio', '#tour-nav-mobile-inicio'],
    title: 'Página inicial',
    text: 'Tudo começa aqui. Esta é a sua página inicial: ela reúne os atalhos do dia, os Círculos, a revista, as receitas e tudo o que há de novo na comunidade. Toque no sol para ver a previsão do tempo da sua cidade e role a página para baixo para conhecer cada parte.',
    cena: 'boas-vindas',
    som: 'boasvindas',
  },
  {
    targets: ['.home-tools'],
    title: 'Atalhos do dia',
    text: 'Três atalhos para o seu dia. Antes de Tudo guarda os seus hábitos da manhã e marca o que você já fez. Água mostra a meta do dia, deixa você registrar cada copo e tem o gráfico da semana e do mês. IMC calcula o seu índice a partir do peso e da altura. Toque em um deles para abrir.',
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
    text: 'Toque na agenda para anotar compromissos, consultas e lembretes, e ver o desafio do mês. Toque no relógio para ver a hora e o clima em qualquer lugar do mundo, ótimo para falar com quem mora longe.',
  },
  {
    targets: ['.circ-strip'],
    title: 'Círculos',
    text: 'Grupos por tema. Toque em um Círculo, entre nele e deixe a sua primeira mensagem. Dentro dele, o botão Convidar chama uma amiga para aquele círculo. Você também pode sugerir um novo: é só dizer o nome e o assunto.',
  },
  {
    targets: ['.home-city-card'],
    title: 'Na minha cidade',
    text: CITY_TOUR_TEXT,
    optional: true,
    gesture: 'tap',
    isNew: true,
    nextLabel: 'Próximo',
    cena: 'surpresa',
    som: 'surpresa',
  },
  {
    targets: ['.mag2-viewport', '.mag2-stack'],
    title: 'Revista',
    text: 'A Revista Círcula traz uma edição nova com conteúdo pensado para você. Toque em uma capa para ler a edição inteira aqui mesmo, virando as páginas com o dedo. Dá para dar zoom nas páginas e voltar quando quiser.',
    gesture: 'tap',
  },
  {
    targets: ['.home-trio', '.home-editorial-cards'],
    title: 'Eventos, Loja e Receitas',
    text: 'Abaixo da revista ficam três círculos que se cruzam. Eventos mostra o próximo encontro da comunidade, com data e horário. Loja traz e-books e produtos digitais, que você lê aqui mesmo no app. Receitas são as receitas da nutricionista, em formato de revista, com ingredientes e modo de preparo. Toque em um círculo para abrir a página completa.',
    optional: true,
    gesture: 'tap',
  },
  {
    targets: ['.home-wheel'],
    title: 'Mais conteúdos',
    text: 'No menu que rola, toque em Dicas de leitura, Respiração, Playlist, Wellness, Dicas de Séries / Filmes (filtre por tipo, gênero, faixa etária e plataforma) ou Dicas de Viagem (destinos por estado, cidade e para quem viaja). O Carro em Dia reúne perguntas e respostas para cuidar do seu carro, por R$ 4,50 avulsos.',
    optional: true,
    gesture: 'tap',
  },
  {
    targets: ['.home-pair .menu-banner-wrap'],
    title: 'Meu Chef',
    text: 'Escolha os pratos e receba bem: o Meu Chef monta o cardápio do seu encontro com as receitas da nutricionista e leva todos os ingredientes para a sua Lista de Compras. Ao lado fica a Lista de Compras, onde você acompanha o que já comprou.',
    optional: true,
    gesture: 'tap',
  },
  {
    targets: ['.gratitude-card-wrap'],
    title: 'Lista de Compras',
    text: 'Crie listas, marque o que comprou e use o modo supermercado. Para montar uma lista rápido, abra uma receita e toque em Adicionar ingredientes à minha lista. Para apagar uma lista, toque em Excluir lista no cartão dela.',
    optional: true,
    gesture: 'tap',
  },
  {
    targets: ['.home-pair--feature .menu-banner-wrap'],
    title: 'Para você',
    text: 'Se exercite em casa (escolha o tempo e o que quer trabalhar, e o treino é montado na hora) e o Diário da Gratidão: uma oração por dia, as 5 gratidões de hoje, seus pedidos e a sua jornada. O que você escreve fica privado, e a oração do dia pode ser compartilhada no Feed.',
    optional: true,
    gesture: 'tap',
  },
  {
    targets: ['.home-plans-wrap'],
    title: 'Planos e assinaturas',
    text: 'Veja os conteúdos que você pode assinar (você pode assinar só o Círcula, só alguns conteúdos ou o Círcula Premium com tudo junto, inclusive Dicas de Viagem, Séries e Meu Chef). Nos planos de 6 e 12 meses o valor total é menor. Os planos que você já tem ficam acesos, com selo de Assinado. Atenção: cancelar corta o acesso na hora, mesmo que o período já esteja pago. Seu período grátis dura ' + memberTrialDays() + ' dias e, perto do fim, avisamos aqui na página inicial.',
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
    text: 'Aqui ficam as conversas da comunidade, com o bom dia da nutricionista todo dia cedo. Publique, curta, comente, responda e vote nas enquetes.',
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
    text: 'Sua capa, suas fotos, os depoimentos que você recebe, a sua cidade e os lugares que você salvou (Meus salvos), o Meu Jardim, o convite para amigas (quem convida ganha 10% de desconto no próximo ciclo da assinatura), a sua assinatura e, no fim, a Administração (trocar a senha, cancelar assinaturas e excluir a conta). No Feed, toque na foto de outra participante para visitar o perfil dela.',
  },
  {
    targets: ['#tour-notification-bell'],
    title: 'Notificações',
    text: 'O sino avisa sobre respostas, consultas, plano alimentar e novidades. Toque em um aviso e ele leva você direto ao lugar.',
    cena: 'comemora',
    som: 'assinatura',
  },
]

interface TourProps {
  onNavigate: (key: NavKey) => void
  onDone: () => void
  /** Quem já fez o tour vê só o passo de novidade ("Na minha cidade"), uma única vez. */
  noveltyOnly?: boolean
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

export function Tour({ onNavigate, onDone, noveltyOnly = false }: TourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<SpotlightRect | null>(null)
  const [cardHeight, setCardHeight] = useState(190)
  const cardRef = useRef<HTMLDivElement>(null)
  const ultimaCena = useRef<RoboCena>('boas-vindas')
  // Passos opcionais só entram se o elemento existe na tela (ex.: Nutri só para paciente).
  const [steps] = useState(() =>
    noveltyOnly ? TOUR_STEPS.filter((st) => st.isNew) : TOUR_STEPS.filter((st) => !st.optional || findTarget(st)),
  )
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

  // Cena e som do robô neste passo: boas-vindas no primeiro, surpresa na novidade, comemoração no
  // último; nos demais aponta para o destaque (ou pensa, quando não há destaque ou o texto é longo).
  useEffect(() => {
    precarregarRobo(['neutro', 'boas-vindas', 'aponta-cima', 'aponta-baixo', 'aponta-direita', 'pensando', 'surpresa', 'comemora', 'oops'])
  }, [])
  useEffect(() => {
    const st = steps[stepIndex]
    const comemora = stepIndex === steps.length - 1 && steps.length > 1
    const som = comemora ? 'assinatura' : (st.som ?? (st.text.length > TEXTO_LONGO ? 'pensando' : 'apontando'))
    falar(undefined, som)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex])

  function pular() {
    falar('oops', 'oops')
    onDone()
  }

  function goNext() {
    if (isLast) onDone()
    else setStepIndex((i) => i + 1)
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex((i) => i - 1)
  }

  const viewW = window.innerWidth
  const viewH = window.innerHeight
  const cardWidth = Math.min(380, viewW - EDGE * 2)

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

  // O robô fica na quina do balão (em cima; embaixo quando o balão está no topo da tela)
  // e aponta para o centro do destaque.
  const ROBO_W = 92
  const roboH = (ROBO_W * 16) / 9
  const roboAbove = cardTop >= roboH - 24 + EDGE
  const roboX = cardLeft + 4
  const roboY = roboAbove ? cardTop - roboH + 26 : cardTop + cardHeight - 8
  const centroX = roboX + ROBO_W / 2
  const centroY = roboY + roboH / 3
  let cena: RoboCena
  if (stepIndex === 0 && step.cena) cena = step.cena as RoboCena
  else if (step.cena && step.cena !== 'apontar') cena = step.cena
  else if (!rect && findTarget(step)) cena = ultimaCena.current // ainda medindo o destaque: mantém a cena
  else if (!rect || step.text.length > TEXTO_LONGO) cena = 'pensando'
  else {
    const dx = rect.left + rect.width / 2 - centroX
    const dy = rect.top + rect.height / 2 - centroY
    cena = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'aponta-cima' : 'aponta-baixo') : dx > 0 ? 'aponta-direita' : 'aponta-esquerda'
  }

  ultimaCena.current = cena

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

      <div className="tour-robo-wrap" style={{ top: roboY, left: roboX }}>
        <RoboGuia cena={cena} tamanho={ROBO_W} />
      </div>

      <div ref={cardRef} className="tour-card" style={{ top: cardTop, left: cardLeft, width: cardWidth }}>
        <RoboMudo className="tour-robo-mudo" />
        <p className="tour-card-step">
          {step.isNew && <span className="tour-card-new">{noveltyOnly ? 'Novidade · Novo' : 'Novo'}</span>}
          {steps.length > 1 && `${stepIndex + 1} / ${steps.length}`}
        </p>
        <h3 className="tour-card-title">{step.title}</h3>
        <p className="tour-card-text">{step.text}</p>
        <div className="tour-card-actions">
          <button type="button" className="auth-link" onClick={pular}>
            Pular tour
          </button>
          <div className="tour-card-nav">
            {stepIndex > 0 && (
              <button type="button" className="panel-content-action" onClick={goBack}>
                Voltar
              </button>
            )}
            <button type="button" className="onboarding-next" onClick={goNext}>
              {isLast ? (noveltyOnly ? 'Entendi' : 'Encerrar') : (step.nextLabel ?? 'Avançar')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
