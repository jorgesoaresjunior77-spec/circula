import { useCallback, useEffect, useRef, useState } from 'react'
import type { CommunityContent } from '../types/content'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './icons'

// C4.1 — Tela editorial da experiência "No Instagram".
//
// Aberta ao clicar no card "No Instagram" da faixa de experiências.
// NÃO leva direto ao Instagram: mostra a publicação cadastrada
// (community_content) dentro do próprio app — foto, título, legenda — e
// só o botão "Ver no Instagram" abre o `external_url` real numa nova
// aba. Identidade Círcula: fundo branco, foto grande, Mitr no título,
// Lato na legenda, Jost nos rótulos. Sem borda pesada, fechamento
// claro, ESC fecha, foco preso e devolvido ao card ao fechar.

interface InstagramHighlightModalProps {
  posts: CommunityContent[]
  onClose: () => void
}

export function InstagramHighlightModal({ posts, onClose }: InstagramHighlightModalProps) {
  const total = posts.length
  const [index, setIndex] = useState(0)
  const safeIndex = total > 0 ? Math.min(index, total - 1) : 0
  const post = posts[safeIndex]
  const { url: photo } = useSignedImageUrl(post?.cover_image_url ?? null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const goPrev = useCallback(() => {
    if (total > 1) setIndex((i) => (i - 1 + total) % total)
  }, [total])
  const goNext = useCallback(() => {
    if (total > 1) setIndex((i) => (i + 1) % total)
  }, [total])

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.querySelector<HTMLElement>('[data-autofocus]')?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key === 'ArrowRight') {
        goNext()
        return
      }
      if (event.key === 'ArrowLeft') {
        goPrev()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button, [href], [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose, goPrev, goNext])

  if (!post) return null

  return (
    <div className="ig-modal-backdrop" onClick={onClose}>
      <div
        className="ig-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ig-modal-title"
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="ig-modal-close"
          onClick={onClose}
          data-autofocus
          aria-label="Fechar"
        >
          <CloseIcon />
        </button>

        <div className="ig-modal-photo" aria-hidden="true">
          {photo && <img src={photo} alt="" />}
        </div>

        <div className="ig-modal-body">
          <p className="ig-modal-eyebrow">
            No Instagram{total > 1 ? ` · ${safeIndex + 1} de ${total}` : ''}
          </p>
          <h2 id="ig-modal-title" className="ig-modal-title">
            {post.title}
          </h2>
          {post.summary && <p className="ig-modal-caption">{post.summary}</p>}

          <div className="ig-modal-actions">
            {total > 1 && (
              <div className="ig-modal-nav">
                <button type="button" onClick={goPrev} aria-label="Publicação anterior">
                  <ChevronLeftIcon />
                </button>
                <button type="button" onClick={goNext} aria-label="Próxima publicação">
                  <ChevronRightIcon />
                </button>
              </div>
            )}
            {post.external_url && (
              <a
                className="ig-modal-link"
                href={post.external_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver no Instagram
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
