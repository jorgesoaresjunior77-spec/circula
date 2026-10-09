import { useEffect, useMemo, useRef, useState } from 'react'
import type { CommunityCardKey } from '../types/communityCards'
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
// Movimento: LOOP CONTÍNUO E INFINITO via `scrollLeft` nativo (não
// `transform`) — a sequência de cards é renderizada duas vezes e um
// `requestAnimationFrame` incrementa `viewport.scrollLeft`; ao passar do
// fim da 1ª sequência, subtrai a mesma largura (as duas metades são
// idênticas, então o "salto" é invisível). Por rodar em cima do mesmo
// `scrollLeft` que o swipe nativo usa, os dois nunca competem: tocar ou
// clicar pausa o loop (Pointer Events — cobre mouse e toque) e ele
// retoma de onde o scroll manual deixou. Item 7 — antes só rodava fora
// de `pointer: coarse` (touch); como não há mais `transform` brigando
// com o scroll nativo, essa restrição saiu. Só entra em cena quando o
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
  summary: HomeSummary
  nextEvent: NextEvent | null
  newPosts: number
  hasPosts: boolean
  /**
   * C4.1 — publicações do Instagram destacadas pela comunidade
   * (community_content publicado, com capa, external_url do Instagram),
   * já filtrado na HomeToday. Vazio -> a experiência "No Instagram" não
   * aparece.
   */
  instagramPosts: CommunityContent[]
  /**
   * Capas (só VISUAIS) cadastradas pela Profissional no Painel, já
   * assinadas. Uma capa por experiência (mesma chave do `key` do card).
   * Ausente/null -> o card mantém o fallback editorial atual. Não muda a
   * origem dos dados de nenhum card.
   */
  cardCovers?: Partial<Record<CommunityCardKey, string | null>>
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
  summary,
  nextEvent,
  newPosts,
  hasPosts,
  instagramPosts,
  cardCovers,
  onNavigate,
}: HomeExperienceStripProps) {
  // Só o 1º post do Instagram tem imagem diretamente reutilizável — a
  // capa passa pelo mesmo useSignedImageUrl do ContentCard. É um valor
  // único, não .map(), então o hook no topo é seguro.
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
      image: cardCovers?.hoje ?? null,
      onActivate: () => onNavigate('comunidades'),
      ariaLabel:
        todayCount > 0
          ? `Hoje no Círcula — ${todayCount} novidades`
          : 'Hoje no Círcula — tudo em dia',
    })

    // 3 — Próximos eventos (só com um próximo evento real).
    if (nextEvent) {
      list.push({
        key: 'eventos',
        eyebrow: 'Agenda',
        title: 'Próximos eventos',
        meta: `${nextEvent.title} · ${formatEventDate(nextEvent.starts_at)}`,
        image: cardCovers?.eventos ?? null,
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
        image: cardCovers?.comunidade ?? null,
        onActivate: () => onNavigate('feed'),
        ariaLabel:
          newPosts > 0
            ? `Na comunidade — ${newPosts} ${
                newPosts === 1 ? 'nova publicação' : 'novas publicações'
              }`
            : 'Na comunidade — feed',
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
        // Capa do conteúdo primeiro; a imagem cadastrada no Painel é o
        // fallback quando não houver capa específica (C4.1: modal
        // inalterado, sempre com a capa de cada post).
        image: instagramCover ?? cardCovers?.instagram ?? null,
        onActivate: () => setInstagramOpen(true),
        ariaLabel:
          count === 1
            ? `No Instagram — ${instagramPosts[0].title}`
            : `No Instagram — ${count} publicações`,
      })
    }

    return list
  }, [summary, nextEvent, newPosts, hasPosts, instagramPosts, instagramCover, cardCovers, onNavigate])

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

  return (
    <section className="exp-strip" aria-label="Experiências da comunidade">
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

      {instagramOpen && (
        <InstagramHighlightModal posts={instagramPosts} onClose={closeInstagram} />
      )}
    </section>
  )
}
