import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
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
// nada: recebe tudo pronto da HomeToday. Uma experiência só entra na
// faixa quando há dado real. Cada card preserva a ação já existente:
// navegar por uma rota que já existe, rolar até a seção detalhada, ou
// (C4.1 — "No Instagram") abrir uma tela editorial no próprio app.
//
// Movimento (ajuste): MARQUEE CONTÍNUO E INFINITO — a sequência de
// cards é renderizada DUAS vezes e o trilho translada de 0 a -50% em
// loop `linear infinite`. Como as duas metades são idênticas, ao
// completar -50% a 2ª metade ocupa exatamente a posição visual da 1ª:
// não há parada, retorno, salto nem intervalo. O movimento não depende
// de mouse e não pausa no hover (o hover só aplica o micro-zoom do
// card). No mobile (pointer grosso) e em prefers-reduced-motion o
// autoplay fica desligado e a faixa continua estática/rolável.

const SPEED_PX_PER_SEC = 26 // velocidade editorial constante (~20–30 px/s)
const MIN_DURATION_SEC = 18

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
   * (community_content publicado, com capa, external_url do Instagram),
   * já filtrado na HomeToday. Vazio -> a experiência "No Instagram" não
   * aparece.
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
        meta: count === 1 ? instagramPosts[0].title : `${count} publicações`,
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

  // Autoplay do marquee: só no desktop com movimento permitido. Em
  // pointer grosso (touch) ou prefers-reduced-motion fica desligado — a
  // faixa continua estática e rolável. Reage a mudanças ao vivo dessas
  // media queries.
  const [marquee, setMarquee] = useState(
    () =>
      typeof window !== 'undefined' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      !window.matchMedia('(pointer: coarse)').matches,
  )
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarse = window.matchMedia('(pointer: coarse)')
    const update = () => setMarquee(!reduce.matches && !coarse.matches)
    update()
    reduce.addEventListener('change', update)
    coarse.addEventListener('change', update)
    return () => {
      reduce.removeEventListener('change', update)
      coarse.removeEventListener('change', update)
    }
  }, [])

  // Duração = largura de UMA sequência / velocidade -> velocidade
  // constante (~26 px/s) em qualquer largura/quantidade de cards. A
  // sequência é re-medida no resize (os cards usam clamp()/vw).
  const seqRef = useRef<HTMLUListElement>(null)
  const [durationSec, setDurationSec] = useState(48)
  useEffect(() => {
    if (!marquee) return
    const seq = seqRef.current
    if (!seq) return
    const measure = () => {
      const width = seq.offsetWidth
      if (width > 0) {
        setDurationSec(Math.max(MIN_DURATION_SEC, width / SPEED_PX_PER_SEC))
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(seq)
    return () => observer.disconnect()
  }, [marquee, experiences.length])

  if (experiences.length === 0) return null

  const renderCard = (exp: Experience, clone: boolean) => (
    <li key={clone ? `${exp.key}-clone` : exp.key} className="exp-card-item">
      <button
        type="button"
        className={`exp-card${exp.image ? ' exp-card--photo' : ''}`}
        onClick={exp.onActivate}
        aria-label={clone ? undefined : exp.ariaLabel}
        aria-hidden={clone ? true : undefined}
        tabIndex={clone ? -1 : undefined}
        aria-haspopup={!clone && exp.key === 'instagram' ? 'dialog' : undefined}
        ref={!clone && exp.key === 'instagram' ? instagramCardRef : undefined}
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

  const trackStyle = marquee
    ? ({ '--exp-marquee-dur': `${durationSec}s` } as CSSProperties)
    : undefined

  return (
    <section className="exp-strip" aria-label="Experiências da comunidade">
      <div className={`exp-viewport${marquee ? ' exp-viewport--marquee' : ''}`}>
        <div className="exp-track" style={trackStyle}>
          <ul className="exp-seq" ref={seqRef}>
            {experiences.map((exp) => renderCard(exp, false))}
          </ul>
          {marquee && (
            <ul className="exp-seq" aria-hidden="true">
              {experiences.map((exp) => renderCard(exp, true))}
            </ul>
          )}
        </div>
      </div>

      {instagramOpen && (
        <InstagramHighlightModal posts={instagramPosts} onClose={closeInstagram} />
      )}
    </section>
  )
}
