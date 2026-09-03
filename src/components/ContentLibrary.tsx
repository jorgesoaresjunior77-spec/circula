import { useMemo, useState } from 'react'
import type { CommunityContent, ContentType } from '../types/content'
import { CONTENT_TYPE_LABEL } from '../types/content'
import type { CircleWithMembers } from '../types/circle'
import { ContentCard } from './ContentCard'
import { EmptyState } from './EmptyState'

interface ContentLibraryProps {
  items: CommunityContent[]
  loading: boolean
  error: string | null
  profileId: string
  circles: CircleWithMembers[]
  canLike: boolean
  communityName?: string
  /** Rótulo da seção. Default "Biblioteca". A Fase 1 usa "Receitas". */
  heading?: string
  /** Fixa um único tipo e esconde os filtros de tipo (destino Receitas). */
  lockType?: ContentType
  onToggleLike: (
    contentId: string,
    liked: boolean,
  ) => Promise<{ error: string | null }>
  /** Módulo 7 — ids já salvos pela usuária logada; omitido = botão oculto. */
  savedContentIds?: Set<string>
  onToggleSave?: (contentId: string, saved: boolean) => Promise<{ error: string | null }>
}

const TYPE_FILTERS: ('all' | ContentType)[] = [
  'all',
  'recipe',
  'article',
  'tip',
  'material',
  'video',
  'educational',
]

export function ContentLibrary({
  items,
  loading,
  error,
  profileId,
  circles,
  canLike,
  communityName,
  heading = 'Biblioteca',
  lockType,
  onToggleLike,
  savedContentIds,
  onToggleSave,
}: ContentLibraryProps) {
  const [type, setType] = useState<'all' | ContentType>(lockType ?? 'all')
  const [query, setQuery] = useState('')
  const effectiveType: 'all' | ContentType = lockType ?? type

  const circleName = useMemo(() => {
    const map = new Map<string, string>()
    for (const circle of circles) map.set(circle.id, circle.name)
    return map
  }, [circles])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (item.status !== 'published' && item.created_by !== profileId) return false
      if (effectiveType !== 'all' && item.type !== effectiveType) return false
      if (!q) return true
      return (
        item.title.toLowerCase().includes(q) ||
        (item.summary ?? '').toLowerCase().includes(q) ||
        (item.body ?? '').toLowerCase().includes(q) ||
        (item.category ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, effectiveType, query, profileId])

  return (
    <section className="content-library">
      <p className="section-label">
        {heading}
        {communityName ? ` · ${communityName}` : ''}
      </p>

      <input
        type="search"
        className="content-search"
        placeholder="Buscar por título, resumo, categoria..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {!lockType && (
        <div className="circle-list-filters" role="tablist" aria-label="Filtrar por tipo">
          {TYPE_FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={type === key}
              className={`circle-list-filter${type === key ? ' circle-list-filter--active' : ''}`}
              onClick={() => setType(key)}
            >
              {key === 'all' ? 'Tudo' : CONTENT_TYPE_LABEL[key]}
            </button>
          ))}
        </div>
      )}

      {loading && <p>Carregando...</p>}
      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && visible.length === 0 && (
        <EmptyState message="Nenhum conteúdo por aqui ainda." />
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="content-library-items">
          {visible.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              profileId={profileId}
              circleName={item.circle_id ? circleName.get(item.circle_id) : null}
              canLike={canLike}
              onToggleLike={(liked) => onToggleLike(item.id, liked)}
              isSaved={savedContentIds?.has(item.id)}
              onToggleSave={
                onToggleSave ? (saved) => onToggleSave(item.id, saved) : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}
