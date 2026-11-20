import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useManagedContent } from '../hooks/useManagedContent'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { CoverImageInput } from './CoverImageInput'
import { PriceEditor } from './PriceEditor'
import { AGE_RATINGS, PLATFORMS, SERIES_GENRES, ageLabel, filterPicks, safeWatchLink } from '../lib/seriesCatalog'
import type { PickKind, SeriesPick } from '../lib/seriesCatalog'
import { PRODUCTS, formatBrl } from '../lib/plansCatalog'

// Dicas de Séries / Filmes: curadoria da nutricionista. A leitura é travada no
// banco pelo pacote; o link abre a plataforma (o Círcula não vende streaming).

interface Preview {
  series_count: number
  movie_count: number
  genres: string[]
  samples: string[]
}

function usePreview(communityId: string | null) {
  const [data, setData] = useState<Preview | null>(null)
  useEffect(() => {
    if (!communityId) return
    let cancelled = false
    void supabase.rpc('series_preview', { p_community: communityId }).then(({ data: d, error }) => {
      if (!cancelled && !error) setData(d as Preview)
    })
    return () => {
      cancelled = true
    }
  }, [communityId])
  return data
}

function PickCard({ p }: { p: SeriesPick }) {
  const { url } = useSignedImageUrl(p.cover_path)
  const link = safeWatchLink(p.platform_url)
  const age = ageLabel(p.age_rating)
  return (
    <article className="sf-card">
      {url ? <img className="sf-cover" src={url} alt={`Capa de ${p.title}`} loading="lazy" decoding="async" /> : <span className="sf-cover sf-cover--ph" aria-hidden="true" />}
      <div className="sf-info">
        <h3>{p.title}</h3>
        <p className="sf-meta">
          {p.genres.join(' · ')}
          {age && <span className={`sf-age sf-age--${p.age_rating}`}>{age}</span>}
        </p>
        {p.description && <p>{p.description}</p>}
        {p.platform && <p className="home-muted">Onde assistir: {p.platform}</p>}
        {link && (
          <a className="water-primary sf-link" href={link} target="_blank" rel="noopener noreferrer">
            Abrir {p.platform ? `no ${p.platform}` : 'o link'}
          </a>
        )}
        {p.status === 'draft' && <span className="reading-draft">Rascunho</span>}
      </div>
    </article>
  )
}

const EMPTY = { id: null as string | null, kind: 'serie' as PickKind, title: '', description: '', genres: [] as string[], platform: '', url: '', age: '', cover: '', status: 'draft' as 'draft' | 'published' }

export function SeriesPage({
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
  const unlocked = canUse || isOwner
  const price = PRODUCTS.find((p) => p.key === 'series_filmes')?.monthlyCents ?? 290
  const preview = usePreview(unlocked ? null : communityId)
  const { items, loading, error, save, remove } = useManagedContent<SeriesPick>('series_picks', unlocked ? communityId : null, 'created_at')
  const [kind, setKind] = useState<PickKind | ''>('')
  const [genre, setGenre] = useState('')
  const [age, setAge] = useState('')
  const [platform, setPlatform] = useState('')
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.title.trim()) return setMsg('Dê um título.')
    if (form.url.trim() && !safeWatchLink(form.url)) return setMsg('O link precisa começar com https://.')
    const r = await save(form.id, {
      kind: form.kind,
      title: form.title.trim(),
      description: form.description.trim() || null,
      genres: form.genres,
      platform: form.platform.trim() || null,
      platform_url: form.url.trim() || null,
      age_rating: form.age || null,
      cover_path: form.cover || null,
      status: form.status,
    })
    if (r.error) return setMsg(r.error)
    setForm(null)
    setMsg(null)
  }

  const shown = filterPicks(items, { kind, genre: genre || null, age: age || null, platform: platform || null })
  const platformsInUse = Array.from(new Set(items.map((p) => p.platform).filter((x): x is string => !!x))).sort()
  const hasFilter = !!(kind || genre || age || platform)

  return (
    <section className="sf-page">
      <h2>Dicas de Séries / Filmes</h2>
      <p className="ex-lede">Curadoria para assistir com calma. O Círcula indica; você assiste na plataforma que já assina.</p>

      {!unlocked && (
        <article className="water-panel ex-offer">
          <h3>Conheça antes de assinar</h3>
          <p>
            Acesso a toda a coleção de dicas por <strong>{formatBrl(price)} por mês</strong>, em uma assinatura só. Você paga pela curadoria e pelas recomendações, não pelos serviços de streaming: para assistir, é preciso ter a assinatura de cada plataforma.
          </p>
          {preview && (
            <ul className="ex-offer-list">
              {preview.series_count > 0 && <li>{preview.series_count} séries</li>}
              {preview.movie_count > 0 && <li>{preview.movie_count} filmes</li>}
              {preview.genres.length > 0 && <li>Gêneros: {preview.genres.join(', ')}</li>}
              {preview.samples.length > 0 && <li>Algumas dicas: {preview.samples.join(' · ')}</li>}
            </ul>
          )}
          <p className="home-muted">O acesso é liberado depois que o pagamento é confirmado.</p>
          <button type="button" className="water-primary water-primary--big" onClick={onOpenPlans}>
            Assinar por {formatBrl(price)}/mês
          </button>
        </article>
      )}

      {unlocked && (
        <>
          <div className="sf-filters" role="search" aria-label="Filtrar dicas">
            <label>
              Tipo
              <select value={kind} onChange={(e) => setKind(e.target.value as PickKind | '')}>
                <option value="">Séries e filmes</option>
                <option value="serie">Séries</option>
                <option value="filme">Filmes</option>
              </select>
            </label>
            <label>
              Classificação (gênero)
              <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">Todas</option>
                {SERIES_GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Faixa etária
              <select value={age} onChange={(e) => setAge(e.target.value)}>
                <option value="">Todas</option>
                {AGE_RATINGS.map((a) => (
                  <option key={a} value={a}>
                    {ageLabel(a)}
                  </option>
                ))}
              </select>
            </label>
            {platformsInUse.length > 0 && (
              <label>
                Plataforma
                <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  <option value="">Todas</option>
                  {platformsInUse.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {hasFilter && (
              <button
                type="button"
                className="water-link"
                onClick={() => {
                  setKind('')
                  setGenre('')
                  setAge('')
                  setPlatform('')
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
          {loading && <p className="home-muted">Carregando…</p>}
          {error && <p className="auth-error">{error}</p>}
          {!loading && shown.length === 0 && <p className="home-muted">Nenhuma dica por aqui ainda.</p>}
          <div className="sf-list">
            {shown.map((p) => (
              <div key={p.id}>
                <PickCard p={p} />
                {isOwner && (
                  <div className="pn-actions">
                    <button type="button" onClick={() => setForm({ id: p.id, kind: p.kind, title: p.title, description: p.description ?? '', genres: p.genres, platform: p.platform ?? '', url: p.platform_url ?? '', age: p.age_rating ?? '', cover: p.cover_path ?? '', status: p.status })}>
                      Editar
                    </button>
                    <button type="button" onClick={() => void save(p.id, { status: p.status === 'published' ? 'draft' : 'published' })}>
                      {p.status === 'published' ? 'Despublicar' : 'Publicar'}
                    </button>
                    <button type="button" onClick={() => window.confirm('Remover esta dica?') && void remove(p.id)}>
                      Remover
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {isOwner && !form && (
            <button type="button" className="water-primary" onClick={() => setForm({ ...EMPTY, kind: kind || 'serie' })}>
              Nova dica
            </button>
          )}
          {isOwner && form && (
            <form className="sf-form" onSubmit={(e) => void submit(e)}>
              <h3>{form.id ? 'Editar dica' : 'Nova dica'}</h3>
              {msg && <p className="auth-error">{msg}</p>}

              <section className="sf-form-section">
                <h4>Sobre o título</h4>
                <div className="sf-form-grid">
                  <label className="sf-field">
                    Tipo
                    <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as PickKind })}>
                      <option value="serie">Série</option>
                      <option value="filme">Filme</option>
                    </select>
                  </label>
                  <label className="sf-field">
                    Classificação indicativa
                    <select value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })}>
                      <option value="">Não informada</option>
                      {AGE_RATINGS.map((a) => (
                        <option key={a} value={a}>
                          {ageLabel(a)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="sf-field sf-field--full">
                    Título
                    <input value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </label>
                  <label className="sf-field sf-field--full">
                    Descrição (o que é, por que indico, para quem serve)
                    <textarea rows={8} value={form.description} maxLength={1200} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    <small>{form.description.length}/1200 caracteres</small>
                  </label>
                </div>
              </section>

              <section className="sf-form-section">
                <h4>Onde assistir</h4>
                <div className="sf-form-grid">
                  <label className="sf-field">
                    Plataforma
                    <input list="sf-platforms" value={form.platform} maxLength={60} onChange={(e) => setForm({ ...form, platform: e.target.value })} />
                    <datalist id="sf-platforms">
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </label>
                  <label className="sf-field">
                    Link para assistir (https://)
                    <input value={form.url} maxLength={500} onChange={(e) => setForm({ ...form, url: e.target.value })} />
                  </label>
                </div>
              </section>

              <section className="sf-form-section">
                <h4>Classificação por gênero (até 6)</h4>
                <div className="sf-genres">
                  {SERIES_GENRES.map((g) => (
                    <label key={g} className={`sf-genre${form.genres.includes(g) ? ' is-on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={form.genres.includes(g)}
                        onChange={() => setForm({ ...form, genres: form.genres.includes(g) ? form.genres.filter((x) => x !== g) : form.genres.length < 6 ? [...form.genres, g] : form.genres })}
                      />
                      {g}
                    </label>
                  ))}
                </div>
              </section>

              <section className="sf-form-section">
                <h4>Capa e publicação</h4>
                <CoverImageInput value={form.cover} onChange={(p) => setForm({ ...form, cover: p })} communityId={communityId} uid={profileId} label="Capa" aspectRatio="2 / 3" />
                <label className="sf-field">
                  Situação
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'draft' | 'published' })}>
                    <option value="draft">Rascunho</option>
                    <option value="published">Publicada</option>
                  </select>
                </label>
              </section>

              <div className="sf-form-actions">
                <button type="submit" className="water-primary">
                  Salvar dica
                </button>
                <button type="button" className="auth-link" onClick={() => setForm(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
          {isMaster && <PriceEditor planKey="series_filmes" label="Dicas de Séries / Filmes" current={price} />}
          <p className="water-note">O Círcula vende o acesso à curadoria, não aos serviços de streaming. A disponibilidade e a assinatura de cada plataforma são por conta de quem assiste.</p>
        </>
      )}
    </section>
  )
}
