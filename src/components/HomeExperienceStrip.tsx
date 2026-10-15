import { useEffect, useMemo, useRef, useState } from 'react'
import type { NavKey } from './PrimaryNav'
import { formatEventDate } from '../lib/formatEventDate'

// C2 — Faixa editorial "Círcula Hoje".
//
// Redesign da Home — lista FIXA de destinos de navegação (Meu Perfil,
// Help Nutri, Eventos, Loja, Círculos, Receitas), sempre presentes, e
// não mais condicionados a dado real existir (o antigo "Hoje no
// Círcula"/"Na comunidade"/"No Instagram" saíram daqui — Instagram
// agora é a própria faixa <HomeInstagramStrip>, abaixo de Círculos).
// "Comunidades" saiu (reorganização da navegação): a gestão da
// comunidade mora no Painel da Professional; o Member chega ao
// conteúdo pelo Feed.
// "Eventos" e "Receitas" têm capa opcional cadastrada no Painel — são
// as únicas chaves que seguem válidas no CHECK de
// `community_card_images` (ver HomeToday.tsx; Receitas reusa a chave
// legada 'jornada'); os demais cards não têm capa configurável (fora de
// escopo adicionar novas chaves ao CHECK/migration). Só "Eventos" tem
// meta dinâmica (próximo evento, quando há).
//
// Movimento: LOOP CONTÍNUO E INFINITO via `scrollLeft` nativo (não
// `transform`) — a sequência de cards é renderizada duas vezes e um
// `requestAnimationFrame` incrementa `viewport.scrollLeft`; ao passar do
// fim da 1ª sequência, subtrai a mesma largura (as duas metades são
// idênticas, então o "salto" é invisível). Por rodar em cima do mesmo
// `scrollLeft` que o swipe nativo usa, os dois nunca competem: tocar ou
// clicar pausa o loop (Pointer Events — cobre mouse e toque) e ele
// retoma de onde o scroll manual deixou. Só entra em cena quando o
// conteúdo realmente excede a viewport (`needsLoop`) — com poucos cards
// a faixa fica estática, sem clone nem animação. Em
// prefers-reduced-motion o autoplay fica desligado (clone também não
// renderiza) e a faixa continua estática/rolável por swipe.

const SPEED_PX_PER_SEC = 40 // D1 — mesma velocidade de antes

interface NextEvent {
  id: string
  title: string
  starts_at: string
}

interface HomeExperienceStripProps {
  nextEvent: NextEvent | null
  /**
   * Capa (só VISUAL) cadastrada pela Profissional no Painel para o card
   * "Eventos", já assinada. Ausente/null -> o card mantém o fallback
   * editorial (sem foto). Não muda a origem do dado do evento.
   */
  eventosCover?: string | null
  /** Idem, para o card "Receitas" (ajustes de navegação). */
  receitasCover?: string | null
  onNavigate: (key: NavKey) => void
}

interface Experience {
  key: string
  eyebrow: string
  title: string
  meta: string
  image: string | null
  onActivate: () => void
  ariaLabel: string
}

export function HomeExperienceStrip({
  nextEvent,
  eventosCover,
  receitasCover,
  onNavigate,
}: HomeExperienceStripProps) {
  const experiences = useMemo<Experience[]>(
    () => [
      {
        key: 'perfil',
        eyebrow: 'Perfil',
        title: 'Meu Perfil',
        meta: 'Seus dados e preferências',
        image: null,
        onActivate: () => onNavigate('perfil'),
        ariaLabel: 'Meu Perfil',
      },
      {
        key: 'help-nutri',
        eyebrow: 'Ajuda',
        title: 'Help Nutri',
        meta: 'Fale com a nutricionista',
        image: null,
        onActivate: () => onNavigate('mensagens'),
        ariaLabel: 'Help Nutri — fale com a nutricionista',
      },
      {
        key: 'eventos',
        eyebrow: 'Agenda',
        title: 'Eventos',
        meta: nextEvent
          ? `${nextEvent.title} · ${formatEventDate(nextEvent.starts_at)}`
          : 'A agenda da comunidade',
        image: eventosCover ?? null,
        onActivate: () => onNavigate('eventos'),
        ariaLabel: nextEvent ? `Eventos — ${nextEvent.title}` : 'Eventos',
      },
      {
        key: 'loja',
        eyebrow: 'Loja',
        title: 'Loja',
        meta: 'Produtos e novidades',
        image: null,
        onActivate: () => onNavigate('loja'),
        ariaLabel: 'Loja',
      },
      {
        key: 'circulos',
        eyebrow: 'Círculos',
        title: 'Círculos',
        meta: 'Pequenos grupos da comunidade',
        image: null,
        onActivate: () => onNavigate('circulos'),
        ariaLabel: 'Círculos',
      },
      {
        key: 'receitas',
        eyebrow: 'Receitas',
        title: 'Receitas',
        meta: 'A biblioteca de receitas da comunidade',
        image: receitasCover ?? null,
        onActivate: () => onNavigate('receitas'),
        ariaLabel: 'Receitas',
      },
    ],
    [nextEvent, eventosCover, receitasCover, onNavigate],
  )

  // Autoplay permitido: só prefers-reduced-motion decide (não mais o
  // tipo de ponteiro — ver comentário no topo do arquivo).
  const [autoplayAllowed, setAutoplayAllowed] = useState(
    () => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setAutoplayAllowed(!reduce.matches)
    update()
    reduce.addEventListener('change', update)
    return () => reduce.removeEventListener('change', update)
  }, [])

  // needsLoop: só vale clonar a sequência e animar quando ela realmente
  // excede a viewport — com poucos cards a faixa cabe inteira e fica
  // estática (nada a "percorrer", então também sem indicador de borda).
  const viewportRef = useRef<HTMLDivElement>(null)
  const seqRef = useRef<HTMLUListElement>(null)
  const cloneSeqRef = useRef<HTMLUListElement>(null)
  const [needsLoop, setNeedsLoop] = useState(false)
  useEffect(() => {
    const viewport = viewportRef.current
    const seq = seqRef.current
    if (!viewport || !seq) return
    const measure = () => setNeedsLoop(seq.scrollWidth > viewport.clientWidth + 4)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(seq)
    return () => observer.disconnect()
  }, [experiences.length])

  const marquee = autoplayAllowed && needsLoop

  // Loop via scrollLeft — ver comentário no topo do arquivo. Só roda
  // quando `marquee` está de pé (autoplay permitido + conteúdo excede a
  // viewport); pausa em qualquer interação e retoma de onde parou.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !marquee) return

    let raf = 0
    let paused = false
    const SPEED = SPEED_PX_PER_SEC / 60

    const step = () => {
      if (!paused) {
        const loopWidth =
          (cloneSeqRef.current?.offsetLeft ?? 0) - (seqRef.current?.offsetLeft ?? 0)
        if (loopWidth > 0) {
          viewport.scrollLeft += SPEED
          if (viewport.scrollLeft >= loopWidth) {
            viewport.scrollLeft -= loopWidth
          }
        }
      }
      raf = requestAnimationFrame(step)
    }
    const pause = () => {
      paused = true
    }
    const resume = () => {
      paused = false
    }
    const onVisibility = () => {
      paused = document.hidden
    }

    viewport.addEventListener('pointerenter', pause)
    viewport.addEventListener('pointerleave', resume)
    viewport.addEventListener('pointerdown', pause)
    viewport.addEventListener('focusin', pause)
    viewport.addEventListener('focusout', resume)
    document.addEventListener('visibilitychange', onVisibility)
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      viewport.removeEventListener('pointerenter', pause)
      viewport.removeEventListener('pointerleave', resume)
      viewport.removeEventListener('pointerdown', pause)
      viewport.removeEventListener('focusin', pause)
      viewport.removeEventListener('focusout', resume)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [marquee])

  const renderCard = (exp: Experience, clone: boolean) => (
    <li key={clone ? `${exp.key}-clone` : exp.key} className="exp-card-item">
      <button
        type="button"
        className={`exp-card${exp.image ? ' exp-card--photo' : ''}`}
        onClick={exp.onActivate}
        aria-label={clone ? undefined : exp.ariaLabel}
        aria-hidden={clone ? true : undefined}
        tabIndex={clone ? -1 : undefined}
      >
        <span className="exp-card-frame">
          {exp.image && <img src={exp.image} alt="" className="exp-card-photo" />}
          <span className="exp-card-eyebrow">{exp.eyebrow}</span>
          <span className="exp-card-title">{exp.title}</span>
          <span className="exp-card-meta">{exp.meta}</span>
        </span>
      </button>
    </li>
  )

  return (
    <section className="exp-strip" aria-label="Círcula Hoje">
      <div
        className={`exp-viewport${marquee ? ' exp-viewport--marquee' : ''}`}
        ref={viewportRef}
      >
        <div className="exp-track">
          <ul className="exp-seq" ref={seqRef}>
            {experiences.map((exp) => renderCard(exp, false))}
          </ul>
          {marquee && (
            <ul className="exp-seq" aria-hidden="true" ref={cloneSeqRef}>
              {experiences.map((exp) => renderCard(exp, true))}
            </ul>
          )}
        </div>
      </div>
      {needsLoop && <span className="exp-edge-fade" aria-hidden="true" />}
    </section>
  )
}
