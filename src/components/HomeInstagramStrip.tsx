import { useEffect, useMemo, useRef, useState } from 'react'
import type { CommunityContent } from '../types/content'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { isInstagramUrl } from '../lib/instagramContent'

// Faixa editorial "No Instagram" — item 5 do redesign da Home.
//
// Reaproveita 100% a infraestrutura existente de `community_content`
// (C4.1 — mesmo filtro `filterInstagramContent` já usado antes para a
// experiência única "No Instagram"): nenhuma tabela, campo, migration
// ou painel administrativo novo. Cada publicação é um item de
// `community_content` publicado, com capa real e `external_url` do
// Instagram — a Profissional cadastra/edita os 6 posts (frase = título,
// imagem = capa, link = link externo) pelo Painel → Conteúdo
// (<ContentManager>), que já existe. Sem publicação real cadastrada, a
// faixa inteira não aparece — nunca um card falso ou link genérico.
//
// Diferença chave em relação a <HomeExperienceStrip>: aqui o clique
// ABRE A PUBLICAÇÃO NO INSTAGRAM (nova aba), não navega dentro do app —
// por isso os cards são links reais (<a target="_blank">), não botões.
// Mesmo padrão visual (.exp-*) e mesmo mecanismo de loop/vaivém das
// demais faixas — ver comentário completo em HomeExperienceStrip.tsx.

const SPEED_PX_PER_SEC = 40
const MAX_CARDS = 6

interface HomeInstagramStripProps {
  /** Já filtrado (filterInstagramContent) na HomeToday — publicados, com
   *  capa real e link do Instagram. */
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

  const content = (
    <span className="exp-card-frame">
      {coverUrl && <img src={coverUrl} alt="" className="exp-card-photo" />}
      <span className="exp-card-eyebrow">Instagram</span>
      <span className="exp-card-title exp-card-title--clamp">{post.title}</span>
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
        aria-label={clone ? undefined : `No Instagram — ${post.title}`}
        aria-hidden={clone ? true : undefined}
        tabIndex={clone ? -1 : undefined}
      >
        {content}
      </a>
    </li>
  )
}

export function HomeInstagramStrip({ posts }: HomeInstagramStripProps) {
  const items = useMemo(() => posts.slice(0, MAX_CARDS), [posts])

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

  if (items.length === 0) return null

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
          </ul>
          {marquee && (
            <ul className="exp-seq" aria-hidden="true" ref={cloneSeqRef}>
              {items.map((post) => (
                <InstagramCard key={`${post.id}-clone`} post={post} clone />
              ))}
            </ul>
          )}
        </div>
      </div>
      {needsLoop && <span className="exp-edge-fade" aria-hidden="true" />}
    </section>
  )
}
