import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { recordView } from '../lib/itemViews'
import { ViewCount } from './ViewCount'
import type { FormEvent, ReactNode } from 'react'
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

function PickTile({ p, onOpen }: { p: SeriesPick; onOpen: () => void }) {
  const { url } = useSignedImageUrl(p.cover_path)
  return (
    <button type="button" className="sf-tile" onClick={onOpen} aria-label={`${p.title}: ver detalhes`}>
      {url ? <img className="sf-tile-cover" src={url} alt="" loading="lazy" decoding="async" /> : <span className="sf-tile-cover sf-tile-cover--ph" aria-hidden="true" />}
      <span className="sf-tile-title">{p.title}</span>
      <span className="sf-tile-kind">{p.kind === 'serie' ? 'Série' : 'Filme'}</span>
      {p.status === 'draft' && <span className="reading-draft">Rascunho</span>}
    </button>
  )
}

function PickDetail({ p, communityId, isOwner, onClose, children }: { p: SeriesPick; communityId: string; isOwner: boolean; onClose: () => void; children?: ReactNode }) {
  useEffect(() => {
    if (!isOwner) recordView(communityId, 'series', p.id)
  }, [communityId, isOwner, p.id])
  const { url } = useSignedImageUrl(p.cover_path)
  const link = safeWatchLink(p.platform_url)
  const trailer = safeWatchLink(p.trailer_url)
  const age = ageLabel(p.age_rating)
  // Portal no body: a janela fica sobre a tela inteira (acima do cabeçalho) e mais para baixo.
  return createPortal(
    <div className="reading-detail-backdrop sf-detail-backdrop" role="dialog" aria-modal="true" aria-label={p.title} onClick={onClose}>
      <article className="reading-detail sf-detail" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="reading-detail-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        {url && <img className="reading-detail-cover" src={url} alt={`Capa de ${p.title}`} decoding="async" />}
        <h4 className="reading-title">{p.title}</h4>
        <p className="sf-meta">
          {p.kind === 'serie' ? 'Série' : 'Filme'}
          {p.genres.length > 0 && ` · ${p.genres.join(' · ')}`}
          {age && <span className={`sf-age sf-age--${p.age_rating}`}>{age}</span>}
        </p>
        {p.description && <p className="reading-summary">{p.description}</p>}
        {p.platform && <p className="home-muted">Onde assistir: {p.platform}</p>}
        {trailer && (
          <a className="water-primary sf-trailer" href={trailer} target="_blank" rel="noopener noreferrer">
            Assista ao Trailer
          </a>
        )}
        {link && (
          <a className="water-primary sf-link" href={link} target="_blank" rel="noopener noreferrer">
            Abrir {p.platform ? `no ${p.platform}` : 'o link'}
          </a>
        )}
        {p.status === 'draft' && <span className="reading-draft">Rascunho — só você vê</span>}
        {isOwner && <ViewCount communityId={communityId} kind="series" itemId={p.id} />}
        {children}
      </article>
    </div>,
    document.body,
  )
}

const EMPTY = { id: null as string | null, kind: 'serie' as PickKind, title: '', description: '', genres: [] as string[], platform: '', url: '', trailer: '', age: '', cover: '', status: 'draft' as 'draft' | 'published' }

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
  const [openId, setOpenId] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.title.trim()) return setMsg('Dê um título.')
    if (form.url.trim() && !safeWatchLink(form.url)) return setMsg('O link precisa começar com https://.')
    if (form.trailer.trim() && !safeWatchLink(form.trailer)) return setMsg('O link do trailer precisa começar com https://.')
    const r = await save(form.id, {
      kind: form.kind,
      title: form.title.trim(),
      description: form.description.trim() || null,
      genres: form.genres,
      platform: form.platform.trim() || null,
      platform_url: form.url.trim() || null,
      trailer_url: form.trailer.trim() || null,
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
  const openPick = items.find((i) => i.id === openId) ?? null
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
          <div className="sf-grid">
            {shown.map((p) => (
              <PickTile key={p.id} p={p} onOpen={() => setOpenId(p.id)} />
            ))}
          </div>
          {openPick && (
            <PickDetail p={openPick} communityId={communityId} isOwner={isOwner} onClose={() => setOpenId(null)}>
              {isOwner && (
                <div className="pn-actions sf-owner-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenId(null)
                      setForm({ id: openPick.id, kind: openPick.kind, title: openPick.title, description: openPick.description ?? '', genres: openPick.genres, platform: openPick.platform ?? '', url: openPick.platform_url ?? '', trailer: openPick.trailer_url ?? '', age: openPick.age_rating ?? '', cover: openPick.cover_path ?? '', status: openPick.status })
                    }}
                  >
                    Editar
                  </button>
                  <button type="button" onClick={() => void save(openPick.id, { status: openPick.status === 'published' ? 'draft' : 'published' })}>
                    {openPick.status === 'published' ? 'Despublicar' : 'Publicar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Remover esta dica?')) {
                        setOpenId(null)
                        void remove(openPick.id)
                      }
                    }}
                  >
                    Remover
                  </button>
                </div>
              )}
            </PickDetail>
          )}

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
                  <label className="sf-field sf-field--full">
                    Link do trailer (https://, opcional)
                    <input value={form.trailer} maxLength={500} placeholder="https://www.youtube.com/..." onChange={(e) => setForm({ ...form, trailer: e.target.value })} />
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
