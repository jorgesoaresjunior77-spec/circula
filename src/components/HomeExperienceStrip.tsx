import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChallengeWithActivities } from '../types/challenge'
import type { CommunityContent } from '../types/content'
import type { HomeSummary } from '../types/home'
import type { NavKey } from './PrimaryNav'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { formatEventDate } from '../lib/formatEventDate'
import { InstagramHighlightModal } from './InstagramHighlightModal'

// C2 — Faixa editorial de experiências da comunidade.
//
// Apresentação horizontal e editorial das experiências que a Home já
// tem em dados REAIS. Não instancia hook de negócio novo e não busca
// nada: recebe tudo pronto da HomeToday (que reusa useHomeToday /
// useChallenges / usePosts / useContent e o railSummary do Dashboard).
// Uma experiência só entra na faixa quando há dado real — sem dado, ela
// não aparece; nada de placeholder, imagem ou métrica inventada. Cada
// card preserva a ação já existente do conteúdo que representa: navegar
// por uma rota que já existe, rolar até a seção detalhada logo abaixo,
// ou (C4.1 — "No Instagram") abrir uma tela editorial no próprio app.

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
  /**
   * C4.1 — publicações do Instagram destacadas pela comunidade
   * (community_content publicado, com capa, external_url do Instagram).
   * Já filtrado na HomeToday por filterInstagramContent. Vazio -> a
   * experiência "No Instagram" não aparece.
   */
  instagramPosts: CommunityContent[]
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
  instagramPosts,
  onNavigate,
}: HomeExperienceStripProps) {
  // Só o desafio em foco e o 1º post do Instagram têm imagem
  // diretamente reutilizável — a capa passa pelo mesmo useSignedImageUrl
  // do ChallengeCard / ContentCard. São valores únicos, não .map(),
  // então os hooks no topo são seguros.
  const { url: challengeCover } = useSignedImageUrl(
    pickedChallenge?.cover_image_url ?? null,
  )
  const { url: instagramCover } = useSignedImageUrl(
    instagramPosts[0]?.cover_image_url ?? null,
  )

  const [instagramOpen, setInstagramOpen] = useState(false)
  const instagramCardRef = useRef<HTMLButtonElement>(null)

  function closeInstagram() {
    setInstagramOpen(false)
    instagramCardRef.current?.focus()
  }

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

    // 6 — No Instagram (C4.1) — só com publicação real destacada. Abre a
    // tela editorial no app; NÃO navega direto para o Instagram.
    if (instagramPosts.length > 0) {
      const count = instagramPosts.length
      list.push({
        key: 'instagram',
        eyebrow: 'Instagram',
        title: 'No Instagram',
        meta:
          count === 1
            ? instagramPosts[0].title
            : `${count} publicações`,
        image: instagramCover,
        onActivate: () => setInstagramOpen(true),
        ariaLabel:
          count === 1
            ? `No Instagram — ${instagramPosts[0].title}`
            : `No Instagram — ${count} publicações`,
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
    instagramPosts,
    instagramCover,
    onNavigate,
  ])

  const trackRef = useRef<HTMLUListElement>(null)

  // Movimento horizontal contínuo, muito suave, em vaivém. Pausa ao
  // interagir (mouse, foco, toque), quando a aba está oculta e enquanto
  // a tela "No Instagram" está aberta. Desligado em prefers-reduced-
  // motion e em ponteiro grosso (touch) — aí vale o swipe/scroll
  // nativo. Sem biblioteca.
  useEffect(() => {
    const el = trackRef.current
    if (!el || instagramOpen) return
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
  }, [experiences.length, instagramOpen])

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
              aria-haspopup={exp.key === 'instagram' ? 'dialog' : undefined}
              ref={exp.key === 'instagram' ? instagramCardRef : undefined}
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

      {instagramOpen && (
        <InstagramHighlightModal posts={instagramPosts} onClose={closeInstagram} />
      )}
    </section>
  )
}
