import { useMemo, useState } from 'react'
import { HELP_CATEGORIES } from '../lib/helpContent'
import type { HelpCategory, HelpItem } from '../lib/helpContent'
import { searchHelp } from '../lib/helpSearch'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

// Central de Ajuda: busca que filtra enquanto a pessoa digita, categorias e
// perguntas expansíveis (accordion). A pesquisa fica guardada ao abrir uma
// categoria ou voltar, para a pessoa não perder o que digitou.

interface HelpPageProps {
  /** Abre a conversa com a nutricionista (só para a membro). */
  onTalkToNutri?: () => void
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.500-3.500" />
    </svg>
  )
}

function Accordion({ items, openIds, onToggle }: { items: HelpItem[]; openIds: Set<string>; onToggle: (id: string) => void }) {
  return (
    <ul className="help-list">
      {items.map((item) => {
        const open = openIds.has(item.id)
        return (
          <li key={item.id} className={'help-item' + (open ? ' is-open' : '')}>
            <button
              type="button"
              className="help-q"
              aria-expanded={open}
              aria-controls={`help-a-${item.id}`}
              onClick={() => onToggle(item.id)}
            >
              <span>{item.q}</span>
              <span className="help-chevron" aria-hidden="true">
                +
              </span>
            </button>
            <div id={`help-a-${item.id}`} className="help-a" role="region" hidden={!open}>
              <p>{item.a}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function HelpPage({ onTalkToNutri }: HelpPageProps) {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  const hits = useMemo(() => searchHelp(query), [query])
  const searching = query.trim().length > 0
  const category: HelpCategory | null = HELP_CATEGORIES.find((c) => c.id === categoryId) ?? null

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="help-page">
      <header className="help-hero">
        <h2>Como podemos ajudar você?</h2>
        <p>Digite uma palavra ou uma dúvida para encontrar a resposta.</p>
        <label className="help-search">
          <span className="help-search-icon">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquise sua dúvida aqui…"
            aria-label="Pesquisar na central de ajuda"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
      </header>

      {searching ? (
        <div className="help-results" aria-live="polite">
          <p className="help-count">
            {hits.length === 0
              ? 'Nenhuma resposta encontrada.'
              : hits.length === 1
                ? '1 resposta encontrada'
                : `${hits.length} respostas encontradas`}
          </p>
          {hits.length === 0 ? (
            <div className="help-empty">
              <p>Não achamos nada para &ldquo;{query.trim()}&rdquo;. Tente outra palavra ou veja as categorias abaixo.</p>
              <button type="button" className="help-link" onClick={() => setQuery('')}>
                Ver todas as categorias
              </button>
              {onTalkToNutri && (
                <button type="button" className="help-link" onClick={onTalkToNutri}>
                  Falar com a nutri
                </button>
              )}
            </div>
          ) : (
            <Accordion items={hits.map((h) => h.item)} openIds={openIds} onToggle={toggle} />
          )}
        </div>
      ) : category ? (
        <div className="help-category-view">
          <button type="button" className="help-back" onClick={() => setCategoryId(null)}>
            <ChevronLeftIcon size={18} /> Todas as categorias
          </button>
          <h3>{category.title}</h3>
          <p className="help-category-desc">{category.description}</p>
          <Accordion items={category.items} openIds={openIds} onToggle={toggle} />
        </div>
      ) : (
        <ul className="help-categories">
          {HELP_CATEGORIES.map((c) => (
            <li key={c.id}>
              <button type="button" className="help-category" onClick={() => setCategoryId(c.id)}>
                <span className="help-category-text">
                  <strong>{c.title}</strong>
                  <span>{c.description}</span>
                </span>
                <span className="help-category-count">{c.items.length}</span>
                <ChevronRightIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {onTalkToNutri && !searching && (
        <p className="help-footer">
          Não encontrou o que procurava?{' '}
          <button type="button" className="help-link" onClick={onTalkToNutri}>
            Fale com a nutricionista
          </button>
        </p>
      )}
    </section>
  )
}
