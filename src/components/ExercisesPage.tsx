import { useState } from 'react'
import { useManagedContent } from '../hooks/useManagedContent'
import { useExercisePreview } from '../hooks/useExercises'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { ExerciseLibrary } from './ExerciseLibrary'
import { ExercisesAdmin } from './ExercisesAdmin'
import type { ExerciseArticle } from './ExercisesAdmin'
import { GENERAL_SAFETY } from '../lib/exerciseCatalog'
import { PRODUCTS, formatBrl } from '../lib/plansCatalog'

// Card "Exercícios": apresentação (com preço) antes da compra; depois da
// compra, matérias da nutricionista e o botão SE EXERCITE EM CASA. A leitura é
// travada no banco pelo pacote; aqui só mostramos o que o banco devolve.

function Cover({ path, className }: { path: string | null; className?: string }) {
  const { url } = useSignedImageUrl(path)
  return url ? <img className={className} src={url} alt="" loading="lazy" decoding="async" /> : <span className={`${className ?? ''} ex-cover-ph`} aria-hidden="true" />
}

function ArticleReader({ a, onBack }: { a: ExerciseArticle; onBack: () => void }) {
  return (
    <article className="ex-article">
      <button type="button" className="water-link" onClick={onBack}>
        ‹ Matérias
      </button>
      <Cover path={a.cover_path} className="ex-article-cover" />
      <h2>{a.title}</h2>
      {a.category && <p className="home-muted">{a.category}</p>}
      {a.description && <p className="ex-lede">{a.description}</p>}
      {a.body?.split(/\n{2,}/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {a.guidance && (
        <>
          <h3>Orientações</h3>
          <p>{a.guidance}</p>
        </>
      )}
      <p className="water-note">{GENERAL_SAFETY}</p>
    </article>
  )
}

export function ExercisesPage({
  communityId,
  profileId,
  isOwner,
  isMaster,
  canUse,
  onOpenPlans,
}: {
  communityId: string
  profileId: string
  isOwner: boolean
  isMaster: boolean
  canUse: boolean
  onOpenPlans: () => void
}) {
  const [view, setView] = useState<'home' | 'library' | 'admin'>('home')
  const [openId, setOpenId] = useState<string | null>(null)
  const unlocked = canUse || isOwner
  const preview = useExercisePreview(unlocked ? null : communityId)
  const { items: articles, loading } = useManagedContent<ExerciseArticle>('exercise_articles', unlocked ? communityId : null, 'created_at')
  const price = PRODUCTS.find((p) => p.key === 'exercicios')?.monthlyCents ?? 590
  const open = openId ? articles.find((a) => a.id === openId) ?? null : null

  if (view === 'library') return <ExerciseLibrary communityId={communityId} profileId={profileId} onBack={() => setView('home')} />
  if (view === 'admin') {
    return (
      <section>
        <button type="button" className="water-link" onClick={() => setView('home')}>
          ‹ Exercícios
        </button>
        <h2>Administrar Exercícios</h2>
        <ExercisesAdmin communityId={communityId} profileId={profileId} isMaster={isMaster} priceCents={price} />
      </section>
    )
  }
  if (open) return <ArticleReader a={open} onBack={() => setOpenId(null)} />

  return (
    <section className="ex-page">
      <h2>Exercícios</h2>
      <p className="ex-lede">Matérias e uma biblioteca para se mexer em casa, só com o peso do corpo, no seu ritmo.</p>

      {!unlocked && (
        <article className="water-panel ex-offer">
          <h3>Conheça antes de assinar</h3>
          <p>
            Acesso à biblioteca completa de exercícios, às matérias e aos treinos por <strong>{formatBrl(price)} por mês</strong>. Uma assinatura só libera tudo: você não paga exercício por exercício.
          </p>
          {preview && (
            <ul className="ex-offer-list">
              {preview.exercise_count > 0 && <li>{preview.exercise_count} exercícios com desenho passo a passo</li>}
              {preview.categories.length > 0 && <li>Categorias: {preview.categories.join(', ')}</li>}
              {preview.samples.length > 0 && <li>Alguns deles: {preview.samples.join(', ')}</li>}
              {preview.articles.length > 0 && <li>{preview.articles.length} matérias: {preview.articles.slice(0, 3).map((a) => a.title).join(' · ')}</li>}
              <li>Treinos rápidos de 5 a 30 minutos, treinos montados por você e programa da semana</li>
            </ul>
          )}
          <p className="home-muted">O acesso é liberado depois que o pagamento é confirmado.</p>
          <button type="button" className="water-primary water-primary--big" onClick={onOpenPlans}>
            Assinar por {formatBrl(price)}/mês
          </button>
          <p className="water-note">{GENERAL_SAFETY}</p>
        </article>
      )}

      {unlocked && (
        <>
          <button type="button" className="ex-cta" onClick={() => setView('library')}>
            SE EXERCITE EM CASA
          </button>
          <h3>Matérias</h3>
          {loading && <p className="home-muted">Carregando…</p>}
          {!loading && articles.length === 0 && <p className="home-muted">As matérias ainda não foram publicadas. Em breve, por aqui.</p>}
          <div className="ex-articles">
            {articles.map((a) => (
              <button key={a.id} type="button" className="ex-article-tile" onClick={() => setOpenId(a.id)}>
                <Cover path={a.cover_path} className="ex-article-thumb" />
                <span className="ex-article-title">{a.title}</span>
                {a.category && <span className="home-muted">{a.category}</span>}
                {a.status === 'draft' && <span className="reading-draft">Rascunho</span>}
              </button>
            ))}
          </div>
          {isOwner && (
            <button type="button" className="water-primary" onClick={() => setView('admin')}>
              Administrar matérias e exercícios
            </button>
          )}
          <p className="water-note">{GENERAL_SAFETY}</p>
        </>
      )}
    </section>
  )
}
