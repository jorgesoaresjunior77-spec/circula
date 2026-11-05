import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { MagazineIssue } from '../types/magazine'
import { MAGAZINE_BLANK_PAGES } from '../types/magazine'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { nextMagazineMessage } from '../lib/magazineSchedule'
import { CloseIcon } from './icons'

// "Revista Círcula Magazine": até 6 capas empilhadas (a mais nova na
// frente, cada uma cobrindo ~70% da de trás). Deslizar a de cima para a
// esquerda manda ela para o fim da fila. Clicar abre a revista em tela
// cheia (páginas viradas para a esquerda); de lá há o caminho para o
// Escritório Editorial (a "banca" com as prateleiras).

export const MAGAZINE_STACK_MAX = 6
export const MAGAZINE_SHELF_MAX = 12
export const MAGAZINE_PAGES_MAX = 12
const SHELF_ROW = 4

function Cover({ path, title }: { path: string | null; title: string }) {
  const { url } = useSignedImageUrl(path)
  return url ? (
    <img loading="lazy" decoding="async" src={url} alt={title} className="mag-cover-img" draggable={false} />
  ) : (
    <span className="mag-cover-blank" aria-hidden="true" />
  )
}

function Page({ path, label }: { path: string | null; label: string }) {
  const { url } = useSignedImageUrl(path)
  return url ? (
    <img decoding="async" src={url} alt={label} className="mag2-page-img" draggable={false} />
  ) : (
    <span className="mag2-page-blank" role="img" aria-label={`${label} (em branco)`} />
  )
}

export function MagazineReader({
  issue,
  onClose,
  onOffice,
}: {
  issue: MagazineIssue | null
  onClose: () => void
  onOffice?: () => void
}) {
  const slides: (string | null)[] = issue
    ? [issue.cover_path, ...issue.pages.slice(0, MAGAZINE_PAGES_MAX).map((p) => p.image_path)]
    : []
  const padded =
    slides.length > 1 ? slides : [slides[0] ?? null, ...Array(MAGAZINE_BLANK_PAGES).fill(null)]
  const total = padded.length
  const [index, setIndex] = useState(0)
  const [hint, setHint] = useState(true)
  const touch = useRef<{ x: number; y: number } | null>(null)

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIndex((i) => Math.min(total - 1, i + 1)), [total])

  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 4500)
    return () => window.clearTimeout(t)
  }, [])

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

  const title = issue?.title ?? 'Revista Círcula Magazine'

  return (
    <div
      className="mag2-reader"
      role="dialog"
      aria-modal="true"
      aria-label={`Revista ${title}`}
      onTouchStart={(e) => {
        touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }}
      onTouchEnd={(e) => {
        const s = touch.current
        touch.current = null
        if (!s) return
        const dx = e.changedTouches[0].clientX - s.x
        const dy = e.changedTouches[0].clientY - s.y
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
        setHint(false)
        if (dx < 0) next()
        else prev()
      }}
    >
      <button type="button" className="mag2-close" onClick={onClose} aria-label="Fechar revista" data-autofocus>
        <CloseIcon />
      </button>
      <p className="mag2-count">
        {title} · {index + 1}/{total}
      </p>
      <div className="mag2-page" key={index}>
        <Page path={padded[index]} label={index === 0 ? 'Capa' : `Página ${index}`} />
      </div>
      {hint && <p className="mag2-hint">Deslize para a esquerda para virar a página ←</p>}
      <div className="mag2-controls">
        <button type="button" onClick={prev} disabled={index === 0} aria-label="Página anterior">
          ‹
        </button>
        {onOffice && (
          <button type="button" className="mag2-office" onClick={onOffice}>
            Entrar no Escritório Editorial
          </button>
        )}
        <button type="button" onClick={next} disabled={index === total - 1} aria-label="Próxima página">
          ›
        </button>
      </div>
    </div>
  )
}

function ShelfCover({ issue, onOpen }: { issue: MagazineIssue; onOpen: () => void }) {
  return (
    <button type="button" className="mag-shelf-cover" onClick={onOpen} aria-label={`Ler ${issue.title}`}>
      <Cover path={issue.cover_path} title={issue.title} />
    </button>
  )
}

function EditorialOffice({
  image,
  issues,
  manager,
  onRead,
  onClose,
}: {
  image: string | null
  issues: MagazineIssue[]
  /** Cadastro das edições — só a profissional recebe. */
  manager?: ReactNode
  onRead: (issue: MagazineIssue) => void
  onClose: () => void
}) {
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

  const shelved = issues.slice(0, MAGAZINE_SHELF_MAX)
  const rows: MagazineIssue[][] = []
  for (let i = 0; i < shelved.length; i += SHELF_ROW) rows.push(shelved.slice(i, i + SHELF_ROW))
  // Sempre mostra as prateleiras (vazias enquanto não há edição).
  while (rows.length < 3) rows.push([])

  return (
    <div
      className="mag-office"
      role="dialog"
      aria-modal="true"
      aria-label="Escritório Editorial"
      style={image ? { backgroundImage: `url("${image}")` } : undefined}
    >
      <div className="mag-office-veil">
        <button type="button" className="mag2-close" onClick={onClose} aria-label="Fechar" data-autofocus>
          <CloseIcon />
        </button>
        <h3 className="mag-office-title">Revista Círcula Magazine</h3>
        <p className="mag-office-text">Bem-vinda ao Escritório Editorial da Círcula Magazine.</p>
        <p className="mag-office-text">{nextMagazineMessage()}</p>

        <div className="mag-newsstand">
          {rows.map((row, r) => (
            <div className="mag-shelf" key={r}>
              <div className="mag-shelf-row">
                {Array.from({ length: SHELF_ROW }, (_, c) => {
                  const issue = row[c]
                  return issue ? (
                    <ShelfCover key={issue.id} issue={issue} onOpen={() => onRead(issue)} />
                  ) : (
                    <span key={c} className="mag-shelf-cover mag-shelf-cover--empty" aria-hidden="true" />
                  )
                })}
              </div>
              <div className="mag-shelf-board" />
            </div>
          ))}
        </div>

        {manager && <div className="mag-office-manager">{manager}</div>}

        <button type="button" className="mag-office-btn" onClick={onClose}>
          Voltar
        </button>
      </div>
    </div>
  )
}

function Stack({
  issues,
  onOpen,
}: {
  issues: (MagazineIssue | null)[]
  onOpen: (issue: MagazineIssue | null) => void
}) {
  // Ordem de exibição (frente primeiro). Muda só quando a lista muda.
  const key = issues.map((i) => i?.id ?? '-').join(',')
  const [order, setOrder] = useState<number[]>(() => issues.map((_, i) => i))
  useEffect(() => {
    setOrder(issues.map((_, i) => i))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const drag = useRef<{ x: number; moved: boolean } | null>(null)
  const justSwiped = useRef(false)

  function sendFrontToBack() {
    setOrder((o) => (o.length > 1 ? [...o.slice(1), o[0]] : o))
  }

  const n = issues.length
  return (
    <ul className="mag2-stack" style={{ ['--mag-n' as string]: n }}>
      {issues.map((issue, idx) => {
        const pos = order.indexOf(idx)
        const isFront = pos === 0
        return (
          <li
            key={issue?.id ?? `blank-${idx}`}
            className="mag2-stack-item"
            style={{ ['--mag-pos' as string]: pos, zIndex: n - pos }}
          >
            <button
              type="button"
              className="mag-cover"
              aria-label={issue ? `Ler a revista ${issue.title}` : 'Revista em breve'}
              onPointerDown={(e) => {
                if (!isFront) return
                drag.current = { x: e.clientX, moved: false }
              }}
              onPointerUp={(e) => {
                const d = drag.current
                drag.current = null
                if (!d || !isFront) return
                if (e.clientX - d.x < -40) {
                  justSwiped.current = true
                  sendFrontToBack()
                }
              }}
              onClick={() => {
                if (justSwiped.current) {
                  justSwiped.current = false
                  return
                }
                onOpen(issue)
              }}
            >
              <Cover path={issue?.cover_path ?? null} title={issue?.title ?? ''} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

interface HomeMagazineStripProps {
  issues: MagazineIssue[]
  /** Fundo (já assinado) do Escritório Editorial. */
  officeImage: string | null
  /** Cadastro das edições dentro do escritório (só a profissional). */
  manager?: ReactNode
}

export function HomeMagazineStrip({ issues, officeImage, manager }: HomeMagazineStripProps) {
  // `reading`: undefined = fechado; null = leitor de edição em branco.
  const [reading, setReading] = useState<MagazineIssue | null | undefined>(undefined)
  const [office, setOffice] = useState(false)

  const stacked: (MagazineIssue | null)[] =
    issues.length > 0
      ? issues.slice(0, MAGAZINE_STACK_MAX)
      : Array.from({ length: MAGAZINE_STACK_MAX }, () => null)

  return (
    <section className="mag-strip" aria-labelledby="mag-strip-title">
      <h2 id="mag-strip-title" className="circ-strip-title">
        Revista Círcula Magazine
      </h2>

      <div className="mag2-viewport">
        <Stack issues={stacked} onOpen={setReading} />
      </div>

      {reading !== undefined && (
        <MagazineReader
          issue={reading}
          onClose={() => setReading(undefined)}
          onOffice={() => {
            setReading(undefined)
            setOffice(true)
          }}
        />
      )}
      {office && (
        <EditorialOffice
          image={officeImage}
          issues={issues}
          manager={manager}
          onRead={(issue) => setReading(issue)}
          onClose={() => setOffice(false)}
        />
      )}
    </section>
  )
}
