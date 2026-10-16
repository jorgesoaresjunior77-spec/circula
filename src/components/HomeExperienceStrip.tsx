import { useMemo } from 'react'
import type { NavKey } from './PrimaryNav'
import { formatEventDate } from '../lib/formatEventDate'
import { useDragCarousel, LOOP_EXTRA_COPIES } from '../hooks/useDragCarousel'

// C2 — Faixa editorial "Seu Círcula de hoje".
//
// Lista FIXA de destinos de navegação, sempre presentes: Meu Perfil,
// Help Nutri, Eventos, Loja, Receitas. "Círculos" NÃO aparece aqui —
// tem a sua própria coleção editorial (<HomeCirclesSection>, logo
// abaixo) e apareceria duplicado se também estivesse nesta faixa.
// Painel → Imagens da comunidade — cada card tem capa configurável,
// numa chave legada do CHECK de `community_card_images` (ver
// types/communityCards.ts pro mapa completo chave -> destino). Só
// "Eventos" tem meta dinâmica (próximo evento) — ela some do card
// (ver "Correção dos cards" abaixo), mas ainda informa o aria-label.
//
// Correção dos cards duplicados — a causa real era o próprio mecanismo
// de autoplay: a faixa clonava a sequência inteira (`exp-seq` duplicado)
// e um `requestAnimationFrame` empurrava `scrollLeft` sem parar,
// deixando os MESMOS 5 cards visíveis duas vezes seguidas na tela. O
// autoplay saiu por completo (ver useDragCarousel) — zero clone fora do
// gesto de arrasto, e mesmo esse clone nunca fica ao lado do original
// na área visível (só entra quando a sequência excede a viewport).
//
// Correção dos cards (texto) — eyebrow e meta saíram do card: só o
// nome. Texto branco com contorno (text-stroke) mais grosso que antes,
// para ler em qualquer foto (ver .exp-card-title no App.css).
//
// Rolagem — useDragCarousel (compartilhado com <HomeCirclesSection>):
// ciclo contínuo nos dois sentidos via `scrollLeft` nativo, arrasto de
// mouse no desktop, swipe nativo no toque, sem autoplay. Ver o hook
// para o mecanismo completo.

interface NextEvent {
  id: string
  title: string
  starts_at: string
}

interface HomeExperienceStripProps {
  nextEvent: NextEvent | null
  /**
   * Capas (só VISUAL) cadastradas pela Profissional no Painel, já
   * assinadas. Ausente/null -> o card mantém o fallback editorial (sem
   * foto). Nenhuma muda a origem do dado do card correspondente.
   */
  perfilCover?: string | null
  helpNutriCover?: string | null
  eventosCover?: string | null
  lojaCover?: string | null
  receitasCover?: string | null
  onNavigate: (key: NavKey) => void
}

interface Experience {
  key: string
  title: string
  /** Só para o aria-label — não aparece como texto visível no card. */
  ariaLabel: string
  image: string | null
  onActivate: () => void
}

export function HomeExperienceStrip({
  nextEvent,
  perfilCover,
  helpNutriCover,
  eventosCover,
  lojaCover,
  receitasCover,
  onNavigate,
}: HomeExperienceStripProps) {
  const experiences = useMemo<Experience[]>(
    () => [
      {
        key: 'perfil',
        title: 'Meu Perfil',
        image: perfilCover ?? null,
        onActivate: () => onNavigate('perfil'),
        ariaLabel: 'Meu Perfil',
      },
      {
        key: 'help-nutri',
        title: 'Help Nutri',
        image: helpNutriCover ?? null,
        onActivate: () => onNavigate('mensagens'),
        ariaLabel: 'Help Nutri — fale com a nutricionista',
      },
      {
        key: 'eventos',
        title: 'Eventos',
        image: eventosCover ?? null,
        onActivate: () => onNavigate('eventos'),
        ariaLabel: nextEvent
          ? `Eventos — ${nextEvent.title} · ${formatEventDate(nextEvent.starts_at)}`
          : 'Eventos',
      },
      {
        key: 'loja',
        title: 'Loja',
        image: lojaCover ?? null,
        onActivate: () => onNavigate('loja'),
        ariaLabel: 'Loja',
      },
      {
        key: 'receitas',
        title: 'Receitas',
        image: receitasCover ?? null,
        onActivate: () => onNavigate('receitas'),
        ariaLabel: 'Receitas',
      },
    ],
    [nextEvent, perfilCover, helpNutriCover, eventosCover, lojaCover, receitasCover, onNavigate],
  )

  const { viewportRef, seqRef, loop, dragging } = useDragCarousel(experiences.length)

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
          <span className="exp-card-title">{exp.title}</span>
        </span>
      </button>
    </li>
  )

  return (
    <section className="exp-strip exp-strip--hoje" aria-label="Seu Círcula de Hoje">
      <div
        className={`exp-viewport exp-viewport--draggable${loop ? ' exp-viewport--looping' : ''}${dragging ? ' exp-viewport--dragging' : ''}`}
        ref={viewportRef}
      >
        <div className="exp-track">
          <ul className="exp-seq" ref={seqRef}>
            {experiences.map((exp) => renderCard(exp, false))}
          </ul>
          {loop &&
            Array.from({ length: LOOP_EXTRA_COPIES }, (_, copy) => (
              <ul className="exp-seq" aria-hidden="true" key={`copy-${copy}`}>
                {experiences.map((exp) => renderCard(exp, true))}
              </ul>
            ))}
        </div>
      </div>
    </section>
  )
}
