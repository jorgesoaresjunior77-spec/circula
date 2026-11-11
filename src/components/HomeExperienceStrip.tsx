import { m, inViewOnce, riseVariants, tapPress } from '../lib/motionKit'
import { useMemo } from 'react'
import type { NavKey } from './PrimaryNav'
import { formatEventDate } from '../lib/formatEventDate'
import { useDragCarousel, LOOP_EXTRA_COPIES } from '../hooks/useDragCarousel'

// C2 — Faixa editorial "Seu Círcula de hoje".
//
// Lista FIXA de destinos de navegação, sempre presentes: Meu Perfil,
// Help Nutri, Eventos, Loja, Receitas, Meu Jardim. "Círculos" NÃO aparece aqui —
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
  /** Etapa 3.2 (evolução/gamificação) — capa própria do card "Meu
   *  Jardim", cadastrada pela Profissional em Painel → Imagens da
   *  comunidade (chave `jardim`, migration 20261030120000). */
  jardimCover?: string | null
  /** Bolinhas vermelhas por card (chave do card -> quantidade). */
  badges?: Record<string, number>
  onNavigate: (key: NavKey) => void
}

/**
 * Item 2 da auditoria — "Meu Jardim" não tinha NENHUM caminho de
 * navegação em telas < 1024px (fora da cápsula fixa, de propósito — só
 * Início/Feed/Painel/Perfil cabem nela) nem nos cards fixos desta
 * faixa. Entra aqui pelo mesmo mecanismo dos outros 5 (onNavigate com a
 * NavKey já existente, 'jardim') — sem rota nova, sem tocar a cápsula.
 * Etapa 3.2 (evolução/gamificação) — ganhou capa própria configurável
 * (`jardimCover`, chave `jardim`), mesmo mecanismo dos outros 5 cards
 * desta faixa; até a migration 20261030120000 ser aplicada no remoto,
 * continua caindo no mesmo fallback editorial (fundo pastel + título).
 */

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
  jardimCover,
  badges = {},
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
      {
        key: 'jardim',
        title: 'Meu Jardim',
        image: jardimCover ?? null,
        onActivate: () => onNavigate('jardim'),
        ariaLabel: 'Meu Jardim',
      },
    ],
    [
      nextEvent,
      perfilCover,
      helpNutriCover,
      eventosCover,
      lojaCover,
      receitasCover,
      jardimCover,
      onNavigate,
    ],
  )

  const { viewportRef, seqRef, loop, dragging } = useDragCarousel(experiences.length)

  const renderCard = (exp: Experience, clone: boolean) => (
    <li key={clone ? `${exp.key}-clone` : exp.key} className="exp-card-item">
      <m.button
        type="button"
        className={`exp-card${exp.image ? ' exp-card--photo' : ''}`}
        {...tapPress}
        onClick={exp.onActivate}
        aria-label={clone ? undefined : exp.ariaLabel}
        aria-hidden={clone ? true : undefined}
        tabIndex={clone ? -1 : undefined}
      >
        <span className="exp-card-frame">
          {exp.image && <img loading="lazy" decoding="async" src={exp.image} alt="" className="exp-card-photo" />}
          {!clone && (badges[exp.key] ?? 0) > 0 && <span className="notif-dot" aria-label="Novidade" />}
          <span className="exp-card-title">{exp.title}</span>
        </span>
      </m.button>
    </li>
  )

  return (
    <m.section className="exp-strip exp-strip--hoje" aria-label="Seu Círcula de Hoje" {...inViewOnce} variants={riseVariants}>
      {/* Sem título visível (pedido de 2026-11-12): os cartões sobem para o
          lugar da palavra "Menu"; o nome da faixa segue no aria-label. */}
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
    </m.section>
  )
}
