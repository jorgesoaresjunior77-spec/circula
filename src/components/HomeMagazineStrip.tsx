import { useCallback, useEffect, useState } from 'react'
import type { MagazineIssue } from '../types/magazine'
import { MAGAZINE_BLANK_PAGES, MAGAZINE_PLACEHOLDER_COUNT } from '../types/magazine'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { nextMagazineMessage } from '../lib/magazineSchedule'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './icons'

// "Revista Círcula Woman Magazine" — capas empilhadas, a edição mais nova
// na frente e cada anterior aparecendo pela metade atrás. Clicar abre a
// revista em slides; no leitor há o botão para o Escritório Editorial.
// Enquanto não há edição cadastrada, 4 capas em branco ocupam o lugar.

interface HomeMagazineStripProps {
  issues: MagazineIssue[]
  /** Fundo (já assinado) do Escritório Editorial. */
  officeImage: string | null
}

function Cover({ path, title }: { path: string | null; title: string }) {
  const { url } = useSignedImageUrl(path)
  return url ? (
    <img loading="lazy" decoding="async" src={url} alt={title} className="mag-cover-img" />
  ) : (
    <span className="mag-cover-blank" aria-hidden="true" />
  )
}

function Page({ path, label }: { path: string | null; label: string }) {
  const { url } = useSignedImageUrl(path)
  return url ? (
    <img decoding="async" src={url} alt={label} className="mag-page-img" />
  ) : (
    <span className="mag-page-blank" role="img" aria-label={`${label} (em branco)`} />
  )
}

function MagazineReader({
  issue,
  onClose,
  onOffice,
}: {
  issue: MagazineIssue | null
  onClose: () => void
  onOffice: () => void
}) {
  // Capa + páginas; sem nada cadastrado, páginas em branco.
  const slides: (string | null)[] = issue
    ? [issue.cover_path, ...issue.pages.map((p) => p.image_path)]
    : []
  const padded = slides.length > 1 ? slides : [slides[0] ?? null, ...Array(MAGAZINE_BLANK_PAGES).fill(null)]
  const total = padded.length
  const [index, setIndex] = useState(0)

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIndex((i) => Math.min(total - 1, i + 1)), [total])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      } else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose, next, prev])

  const title = issue?.title ?? 'Revista Círcula Woman Magazine'

  return (
    <div className="mag-reader-backdrop" onClick={onClose}>
      <div
        className="mag-reader"
        role="dialog"
        aria-modal="true"
        aria-label={`Revista ${title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="mag-reader-close" onClick={onClose} aria-label="Fechar" data-autofocus>
          <CloseIcon />
        </button>
        <p className="mag-reader-title">
          {title} · {index + 1} de {total}
        </p>

        <div className="mag-reader-stage">
          <button type="button" className="mag-reader-nav" onClick={prev} disabled={index === 0} aria-label="Página anterior">
            <ChevronLeftIcon />
          </button>
          <div className="mag-reader-page">
            <Page path={padded[index]} label={index === 0 ? 'Capa' : `Página ${index}`} />
          </div>
          <button
            type="button"
            className="mag-reader-nav"
            onClick={next}
            disabled={index === total - 1}
            aria-label="Próxima página"
          >
            <ChevronRightIcon />
          </button>
        </div>

        <button type="button" className="mag-office-btn" onClick={onOffice}>
          Entrar no Escritório Editorial
        </button>
      </div>
    </div>
  )
}

function EditorialOffice({ image, onClose }: { image: string | null; onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      className="mag-office"
      role="dialog"
      aria-modal="true"
      aria-label="Escritório Editorial"
      style={image ? { backgroundImage: `url("${image}")` } : undefined}
    >
      <div className="mag-office-veil">
        <button type="button" className="mag-reader-close" onClick={onClose} aria-label="Fechar" data-autofocus>
          <CloseIcon />
        </button>
        <h3 className="mag-office-title">Escritório Editorial</h3>
        <p className="mag-office-text">Bem-vinda aos bastidores da Círcula Woman Magazine.</p>
        <p className="mag-office-text">{nextMagazineMessage()}</p>
        <button type="button" className="mag-office-btn" onClick={onClose}>
          Voltar
        </button>
      </div>
    </div>
  )
}

export function HomeMagazineStrip({ issues, officeImage }: HomeMagazineStripProps) {
  // `reading`: undefined = fechado; null = leitor de edição em branco.
  const [reading, setReading] = useState<MagazineIssue | null | undefined>(undefined)
  const [office, setOffice] = useState(false)

  const covers: (MagazineIssue | null)[] =
    issues.length > 0 ? issues : Array.from({ length: MAGAZINE_PLACEHOLDER_COUNT }, () => null)

  return (
    <section className="mag-strip" aria-labelledby="mag-strip-title">
      <h2 id="mag-strip-title" className="circ-strip-title">
        Revista Círcula Woman Magazine
      </h2>
      <p className="mag-strip-next">{nextMagazineMessage()}</p>

      <div className="mag-viewport">
        <ul className="mag-stack">
          {covers.map((issue, i) => (
            <li key={issue?.id ?? `blank-${i}`} className="mag-stack-item" style={{ zIndex: covers.length - i }}>
              <button
                type="button"
                className="mag-cover"
                onClick={() => setReading(issue)}
                aria-label={issue ? `Ler a revista ${issue.title}` : 'Revista em breve'}
              >
                <Cover path={issue?.cover_path ?? null} title={issue?.title ?? ''} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {reading !== undefined && (
        <MagazineReader
          issue={reading}
          onClose={() => setReading(undefined)}
          onOffice={() => setOffice(true)}
        />
      )}
      {office && <EditorialOffice image={officeImage} onClose={() => setOffice(false)} />}
    </section>
  )
}
