import { useEffect, useMemo, useRef, useState } from 'react'
import type { CommunityContent } from '../types/content'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { isInstagramUrl } from '../lib/instagramContent'

// Faixa editorial "No Instagram" — item 5 do redesign da Home.
//
// Reaproveita 100% a infraestrutura existente de `community_content`
// (mesmo filtro `filterInstagramContent`, em lib/instagramContent.ts):
// nenhuma tabela, campo ou migration nova. Cada publicação é um item de
// `community_content` publicado com `external_url` do Instagram — a
// Profissional cadastra o link pela seção "Publicações do Instagram" do
// Painel (6 espaços numerados 1–6, InstagramSlotsManager.tsx), que pede
// SÓ o link (sem imagem/título/descrição obrigatórios). Sempre 6
// espaços na faixa: publicações reais primeiro, o restante como vaga
// vazia — nunca um card falso ou link genérico.
//
// Diferença chave em relação a <HomeExperienceStrip>: aqui o clique
// ABRE A PUBLICAÇÃO NO INSTAGRAM (nova aba), não navega dentro do app —
// por isso os cards são links reais (<a target="_blank">), não botões.
// Mesmo padrão visual (.exp-*) e mesmo mecanismo de loop/vaivém das
// demais faixas — ver comentário completo em HomeExperienceStrip.tsx.

const SPEED_PX_PER_SEC = 40
// Ajustes de navegação (item 4) — SEMPRE 6 espaços, publicados ou não:
// os reais primeiro, o restante como vaga vazia (nunca um card
// inventado). Antes só mostrava vagas vazias quando não havia NENHUMA
// publicação real; agora o preenchimento completa até 6 em qualquer
// combinação.
const TOTAL_SLOTS = 6

interface HomeInstagramStripProps {
  /** Já filtrado (filterInstagramContent) na HomeToday — publicados,
   *  com link do Instagram (capa opcional). */
  posts: CommunityContent[]
}

function InstagramCard({ post, clone }: { post: CommunityContent; clone: boolean }) {
  const { url: coverUrl } = useSignedImageUrl(post.cover_image_url)

  // Correção pontual — reaproveita o mesmo `isInstagramUrl` do filtro
  // compartilhado (instagramContent.ts), sem duplicar a lista de hosts.
  // `filterInstagramContent` já garante isso na origem (HomeToday.tsx),
  // mas o componente não deve confiar cegamente nisso: um link ausente
  // ou inválido não vira um <a> clicável quebrado (sem href, sem
  // target/rel) — o card continua aparecendo, só sem a ação de clique.
  const href = isInstagramUrl(post.external_url) ? post.external_url : null
  // Ajustes de navegação — a capa deixou de ser obrigatória; o Painel
  // (seção "Publicações do Instagram") só pede o link, então o título
  // pode vir vazio (publicação cadastrada pelo campo único de URL). Sem
  // título, o card mostra só a foto (quando há) e o selo "Instagram".
  const hasTitle = post.title.trim().length > 0

  const content = (
    <span className="exp-card-frame">
      {coverUrl && <img src={coverUrl} alt="" className="exp-card-photo" />}
      <span className="exp-card-eyebrow">Instagram</span>
      {hasTitle && <span className="exp-card-title exp-card-title--clamp">{post.title}</span>}
    </span>
  )

  if (!href) {
    return (
      <li className="exp-card-item">
        <div
          className={`exp-card${coverUrl ? ' exp-card--photo' : ''}`}
          style={{ cursor: 'default' }}
          aria-hidden={clone ? true : undefined}
        >
          {content}
        </div>
      </li>
    )
  }

  return (
    <li className="exp-card-item">
      <a
        className={`exp-card${coverUrl ? ' exp-card--photo' : ''}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={clone ? undefined : hasTitle ? `No Instagram — ${post.title}` : 'No Instagram'}
        aria-hidden={clone ? true : undefined}
        tabIndex={clone ? -1 : undefined}
      >
        {content}
      </a>
    </li>
  )
}

function EmptyInstagramCard({ clone }: { clone: boolean }) {
  return (
    <li className="exp-card-item">
      <div className="exp-card exp-card--empty" aria-hidden={clone ? true : undefined}>
        <span className="exp-card-frame">
          <span className="exp-card-eyebrow">Instagram</span>
          <span className="exp-card-empty-label">Em breve</span>
        </span>
      </div>
    </li>
  )
}

export function HomeInstagramStrip({ posts }: HomeInstagramStripProps) {
  const items = useMemo(() => posts.slice(0, TOTAL_SLOTS), [posts])
  const emptyCount = TOTAL_SLOTS - items.length

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
  }, [items.length])

  const marquee = autoplayAllowed && needsLoop

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

  // Ajustes de navegação (item 4) — sempre 6 espaços: as publicações
  // reais primeiro, o restante como vaga vazia (nunca um card inventado,
  // nunca menos de 6 no total). Marquee/loop considera a sequência toda
  // (reais + vazias) do mesmo jeito que as outras faixas.
  return (
    <section className="exp-strip" aria-labelledby="insta-strip-title">
      <h2 id="insta-strip-title" className="circ-strip-title">
        No Instagram
      </h2>
      <div
        className={`exp-viewport${marquee ? ' exp-viewport--marquee' : ''}`}
        ref={viewportRef}
      >
        <div className="exp-track">
          <ul className="exp-seq" ref={seqRef}>
            {items.map((post) => (
              <InstagramCard key={post.id} post={post} clone={false} />
            ))}
            {Array.from({ length: emptyCount }, (_, i) => (
              <EmptyInstagramCard key={`empty-${i}`} clone={false} />
            ))}
          </ul>
          {marquee && (
            <ul className="exp-seq" aria-hidden="true" ref={cloneSeqRef}>
              {items.map((post) => (
                <InstagramCard key={`${post.id}-clone`} post={post} clone />
              ))}
              {Array.from({ length: emptyCount }, (_, i) => (
                <EmptyInstagramCard key={`empty-${i}-clone`} clone />
              ))}
            </ul>
          )}
        </div>
      </div>
      {needsLoop && <span className="exp-edge-fade" aria-hidden="true" />}
    </section>
  )
}
