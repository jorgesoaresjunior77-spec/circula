import { useEffect, useMemo, useRef } from 'react'
import type { CommunityContent } from '../types/content'
import { useContent } from '../hooks/useContent'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'

// C4 — Destaque editorial de postagens do Instagram.
//
// NÃO há infraestrutura própria para "posts do Instagram selecionados"
// no projeto: nenhuma tabela, campo, tipo ou flag para isso. A única
// estrutura adequada existente é `community_content` (hook useContent,
// tabela community_content): conteúdo curado pela comunidade, com
// `cover_image_url` (imagem) + `external_url` (link livre) + `title` /
// `summary` + `status`. Um item cujo `external_url` aponta para o
// Instagram E que tem capa É, na prática, "a postagem do Instagram que a
// comunidade destacou" — sem nenhum campo/flag novo.
//
// Esta seção reusa esse dado, filtrando client-side. Sem consulta nova
// de propósito para imagem, sem tabela, migration, campo, hook de
// backend, RLS, Auth, Billing. Se não houver item real que se
// qualifique, a seção simplesmente não aparece — nada de post fictício,
// imagem aleatória ou placeholder.

const INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am',
  'www.instagr.am',
])

function isInstagramUrl(raw: string | null): boolean {
  if (!raw) return false
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    return INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

interface HomeInstagramSectionProps {
  communityId: string
}

function InstagramCard({ item }: { item: CommunityContent }) {
  // Uma instância por card — mesmo padrão do ContentCard / CircleCard.
  const { url: coverUrl } = useSignedImageUrl(item.cover_image_url)

  return (
    <li className="ig-card-item">
      <a
        className="ig-card"
        href={item.external_url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Abrir "${item.title}" no Instagram (nova aba)`}
      >
        <span className="ig-card-frame">
          {coverUrl && <img src={coverUrl} alt="" className="ig-card-photo" />}
          <span className="ig-card-text">
            <span className="ig-card-eyebrow">Instagram</span>
            <span className="ig-card-title">{item.title}</span>
            {item.summary && <span className="ig-card-meta">{item.summary}</span>}
          </span>
        </span>
      </a>
    </li>
  )
}

export function HomeInstagramSection({ communityId }: HomeInstagramSectionProps) {
  const { items } = useContent(communityId)

  // Só conteúdo publicado, com capa real, cujo link é do Instagram.
  const posts = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === 'published' &&
          !!item.cover_image_url &&
          isInstagramUrl(item.external_url),
      ),
    [items],
  )

  const trackRef = useRef<HTMLUListElement>(null)

  // Deslize horizontal muito sutil, em vaivém — mesma linguagem da
  // C2/C3. Pausa ao interagir e com a aba oculta; desligado em
  // prefers-reduced-motion e em ponteiro grosso (touch). Sem biblioteca.
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
  }, [posts.length])

  if (posts.length === 0) return null

  return (
    <section className="ig-strip" aria-labelledby="ig-strip-title">
      <h2 id="ig-strip-title" className="ig-strip-title">
        Postagens do Instagram
      </h2>
      <ul className="ig-track" ref={trackRef}>
        {posts.map((item) => (
          <InstagramCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  )
}
