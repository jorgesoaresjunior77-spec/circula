import { useEffect, useMemo, useRef } from 'react'
import type { ChallengeWithActivities } from '../types/challenge'
import type { HomeSummary } from '../types/home'
import type { NavKey } from './PrimaryNav'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { formatEventDate } from '../lib/formatEventDate'

// C2 — Faixa editorial de experiências da comunidade.
//
// Apresentação horizontal e editorial das experiências que a Home já
// tem em dados REAIS. Não instancia hook de negócio novo e não busca
// nada: recebe tudo pronto da HomeToday (que reusa useHomeToday /
// useChallenges / usePosts e o railSummary do Dashboard). Uma
// experiência só entra na faixa quando há dado real — sem dado, ela não
// aparece; nada de placeholder, imagem ou métrica inventada. Cada card
// preserva a ação já existente do conteúdo que representa: navegar por
// uma rota que já existe, ou rolar até a seção detalhada logo abaixo.

interface NextEvent {
  id: string
  title: string
  starts_at: string
}

interface HomeExperienceStripProps {
  summary: HomeSummary
  pickedChallenge: ChallengeWithActivities | null
  nextEvent: NextEvent | null
  newPosts: number
  hasPosts: boolean
  journey: { pointsBalance: number; achievementsCount: number } | null
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

function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

export function HomeExperienceStrip({
  summary,
  pickedChallenge,
  nextEvent,
  newPosts,
  hasPosts,
  journey,
  onNavigate,
}: HomeExperienceStripProps) {
  // Só o desafio em foco tem imagem diretamente reutilizável — a capa
  // passa pelo mesmo useSignedImageUrl do ChallengeCard. É UM valor,
  // não um .map(), então o hook no topo é seguro.
  const { url: challengeCover } = useSignedImageUrl(
    pickedChallenge?.cover_image_url ?? null,
  )

  const experiences = useMemo<Experience[]>(() => {
    const list: Experience[] = []

    // 1 — Hoje no Círcula (Resumo do dia; sempre presente na Home).
    const todayCount =
      summary.repliesToMe +
      summary.reactionsToMe +
      summary.newPosts +
      (summary.newMembers ?? 0)
    list.push({
      key: 'hoje',
      eyebrow: 'Hoje',
      title: 'Hoje no Círcula',
      meta:
        todayCount > 0
          ? `${todayCount} ${todayCount === 1 ? 'novidade' : 'novidades'}`
          : 'Tudo em dia',
      image: null,
      onActivate: () => onNavigate('comunidades'),
      ariaLabel:
        todayCount > 0
          ? `Hoje no Círcula — ${todayCount} novidades`
          : 'Hoje no Círcula — tudo em dia',
    })

    // 2 — Seus desafios (só com um desafio em foco real).
    if (pickedChallenge) {
      list.push({
        key: 'desafios',
        eyebrow: 'Desafio',
        title: 'Seus desafios',
        meta: pickedChallenge.title,
        image: challengeCover,
        onActivate: () => scrollToSection('home-desafios'),
        ariaLabel: `Seus desafios — ${pickedChallenge.title}`,
      })
    }

    // 3 — Próximos eventos (só com um próximo evento real).
    if (nextEvent) {
      list.push({
        key: 'eventos',
        eyebrow: 'Agenda',
        title: 'Próximos eventos',
        meta: `${nextEvent.title} · ${formatEventDate(nextEvent.starts_at)}`,
        image: null,
        onActivate: () => onNavigate('eventos'),
        ariaLabel: `Próximos eventos — ${nextEvent.title}`,
      })
    }

    // 4 — Na comunidade (feed) — só se houver publicações reais.
    if (hasPosts) {
      list.push({
        key: 'comunidade',
        eyebrow: 'Comunidade',
        title: 'Na comunidade',
        meta:
          newPosts > 0
            ? `${newPosts} ${newPosts === 1 ? 'nova publicação' : 'novas publicações'}`
            : 'Feed da comunidade',
        image: null,
        onActivate: () => onNavigate('feed'),
        ariaLabel:
          newPosts > 0
            ? `Na comunidade — ${newPosts} ${
                newPosts === 1 ? 'nova publicação' : 'novas publicações'
              }`
            : 'Na comunidade — feed',
      })
    }

    // 5 — Sua jornada (pontos + conquistas) — só quando o resumo carregou.
    if (journey) {
      const { pointsBalance, achievementsCount } = journey
      list.push({
        key: 'jornada',
        eyebrow: 'Você',
        title: 'Sua jornada',
        meta: `${pointsBalance} ${
          pointsBalance === 1 ? 'ponto' : 'pontos'
        } · ${achievementsCount} ${
          achievementsCount === 1 ? 'conquista' : 'conquistas'
        }`,
        image: null,
        onActivate: () => scrollToSection('home-jornada'),
        ariaLabel: `Sua jornada — ${pointsBalance} pontos, ${achievementsCount} conquistas`,
      })
    }

    return list
  }, [
    summary,
    pickedChallenge,
    challengeCover,
    nextEvent,
    newPosts,
    hasPosts,
    journey,
    onNavigate,
  ])

  const trackRef = useRef<HTMLUListElement>(null)

  // Movimento horizontal contínuo, muito suave, em vaivém. Pausa ao
  // interagir (mouse, foco, toque) e quando a aba está oculta. Desligado
  // em prefers-reduced-motion e em ponteiro grosso (touch) — aí vale o
  // swipe/scroll nativo. Sem biblioteca.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      window.matchMedia('(pointer: coarse)').matches
    ) {
      return
    }

    let raf = 0
    let paused = false
    let dir = 1
    // `scrollLeft` volta arredondado a inteiro quando dpr = 1 — por isso
    // o avanço é acumulado num float e só então escrito. ~0.4px/frame
    // ≈ 24px/s: um deslize, não um carrossel.
    let pos = el.scrollLeft
    const SPEED = 0.4

    const step = () => {
      if (!paused && el.scrollWidth > el.clientWidth + 4) {
        const max = el.scrollWidth - el.clientWidth
        if (pos >= max) dir = -1
        else if (pos <= 0) dir = 1
        pos += SPEED * dir
        el.scrollLeft = pos
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
    // enquanto pausado, o usuário pode ter rolado/deslizado à mão —
    // ressincroniza o acumulador para não haver salto ao retomar.
    const syncPos = () => {
      if (paused) pos = el.scrollLeft
    }

    el.addEventListener('pointerenter', pause)
    el.addEventListener('pointerleave', resume)
    el.addEventListener('pointerdown', pause)
    el.addEventListener('focusin', pause)
    el.addEventListener('focusout', resume)
    el.addEventListener('scroll', syncPos, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerenter', pause)
      el.removeEventListener('pointerleave', resume)
      el.removeEventListener('pointerdown', pause)
      el.removeEventListener('focusin', pause)
      el.removeEventListener('focusout', resume)
      el.removeEventListener('scroll', syncPos)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [experiences.length])

  if (experiences.length === 0) return null

  return (
    <section className="exp-strip" aria-label="Experiências da comunidade">
      <ul className="exp-track" ref={trackRef}>
        {experiences.map((exp) => (
          <li key={exp.key} className="exp-card-item">
            <button
              type="button"
              className={`exp-card${exp.image ? ' exp-card--photo' : ''}`}
              onClick={exp.onActivate}
              aria-label={exp.ariaLabel}
            >
              <span className="exp-card-frame">
                {exp.image && <img src={exp.image} alt="" className="exp-card-photo" />}
                <span className="exp-card-eyebrow">{exp.eyebrow}</span>
                <span className="exp-card-title">{exp.title}</span>
                <span className="exp-card-meta">{exp.meta}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
