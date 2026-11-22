import { useEffect, useMemo, useState } from 'react'
import { recordView } from '../lib/itemViews'
import { ViewCount } from './ViewCount'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useManagedContent } from '../hooks/useManagedContent'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { useTravelImages } from '../hooks/useTravelImages'
import type { TravelImageKind } from '../hooks/useTravelImages'
import { CoverImageInput } from './CoverImageInput'
import { PriceEditor } from './PriceEditor'
import { PRODUCTS, formatBrl } from '../lib/plansCatalog'
import { BR_STATES, TRAVEL_AUDIENCES, audienceLabel, cityKey, distinctCities, filterPlaces, stateName } from '../lib/travel'
import type { TravelPlace } from '../lib/travel'

// Dicas de Viagem: a profissional cadastra os destinos; a membro escolhe por
// estado, cidade e "para quem" e chega à página do destino. Tudo é conteúdo
// dela (textos e fotos): o app não inventa nada. Leitura travada no banco
// pelo pacote 'viagens' (ou Premium).

interface Preview {
  place_count: number
  states: string[]
  samples: string[]
}

function usePreview(communityId: string | null) {
  const [data, setData] = useState<Preview | null>(null)
  useEffect(() => {
    if (!communityId) return
    let cancelled = false
    void supabase.rpc('travel_preview', { p_community: communityId }).then(({ data: d, error }) => {
      if (!cancelled && !error) setData(d as Preview)
    })
    return () => {
      cancelled = true
    }
  }, [communityId])
  return data
}

type Step = 'estado' | 'cidade' | 'publico' | 'lista'

interface FormState {
  id: string | null
  title: string
  state: string
  city: string
  audiences: string[]
  description: string
  whatToDo: string
  points: string
  images: string[]
  status: 'draft' | 'published'
}

const EMPTY_FORM: FormState = {
  id: null,
  title: '',
  state: '',
  city: '',
  audiences: [],
  description: '',
  whatToDo: '',
  points: '',
  images: ['', '', ''],
  status: 'draft',
}

interface CardProps {
  label: string
  sub?: string
  path: string | null
  onOpen: () => void
  /** Dona: mostra "Trocar imagem". */
  editable?: { communityId: string; uid: string; onSave: (path: string) => Promise<{ error: string | null }> }
}

function TravelCard({ label, sub, path, onOpen, editable }: CardProps) {
  const { url } = useSignedImageUrl(path)
  const [editing, setEditing] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className="tv-card">
      <button type="button" className="tv-card-main" onClick={onOpen}>
        <span className="tv-card-img">
          {url ? <img src={url} alt="" loading="lazy" decoding="async" /> : <span className="tv-card-ph" aria-hidden="true" />}
        </span>
        <span className="tv-card-label">{label}</span>
        {sub && <span className="tv-card-sub">{sub}</span>}
      </button>
      {editable && (
        <>
          <button type="button" className="tv-card-edit" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Fechar' : path ? 'Trocar imagem' : 'Colocar imagem'}
          </button>
          {editing && (
            <div className="tv-card-editor">
              <CoverImageInput
                value={path ?? ''}
                communityId={editable.communityId}
                uid={editable.uid}
                label={'Imagem de ' + label}
                aspectRatio="4 / 5"
                recommendedSize="1080 × 1350 px"
                onChange={(p) => {
                  void editable.onSave(p).then((r) => setMsg(r.error))
                }}
              />
              {msg && <p className="auth-error">{msg}</p>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PlaceTile({ place, onOpen }: { place: TravelPlace; onOpen: () => void }) {
  const { url } = useSignedImageUrl(place.image_paths[0] ?? null)
  return (
    <button type="button" className="tv-place-tile" onClick={onOpen}>
      <span className="tv-place-img">{url ? <img src={url} alt="" loading="lazy" decoding="async" /> : <span className="tv-card-ph" aria-hidden="true" />}</span>
      <span className="tv-place-title">{place.title}</span>
      <span className="tv-place-where">{[place.city, place.state].filter(Boolean).join(' · ')}</span>
      {place.status === 'draft' && <span className="reading-draft">Rascunho</span>}
    </button>
  )
}

function PlacePhoto({ path, title }: { path: string; title: string }) {
  const { url } = useSignedImageUrl(path)
  if (!url) return null
  return <img className="tv-photo" src={url} alt={'Foto de ' + title} loading="lazy" decoding="async" />
}

function PlaceDetail({ place, communityId, isOwner, onBack, onEdit }: { place: TravelPlace; communityId: string; isOwner: boolean; onBack: () => void; onEdit?: () => void }) {
  useEffect(() => {
    if (!isOwner) recordView(communityId, 'travel', place.id)
  }, [communityId, isOwner, place.id])
  return (
    <article className="tv-detail">
      <button type="button" className="tv-back" onClick={onBack}>
        ‹ Voltar
      </button>
      <h3 className="tv-detail-title">{place.title}</h3>
      <p className="tv-detail-where">{[place.city, stateName(place.state)].filter(Boolean).join(' · ')}</p>
      {place.audiences.length > 0 && (
        <ul className="tv-chips" aria-label="Indicado para">
          {place.audiences.map((a) => (
            <li key={a}>{audienceLabel(a)}</li>
          ))}
        </ul>
      )}
      {place.status === 'draft' && <p className="reading-draft">Rascunho — só você vê</p>}
      {isOwner && <ViewCount communityId={communityId} kind="travel" itemId={place.id} />}
      {place.description && (
        <section className="tv-section">
          <h4>Sobre o lugar</h4>
          <p>{place.description}</p>
        </section>
      )}
      {place.what_to_do && (
        <section className="tv-section">
          <h4>O que fazer</h4>
          <p>{place.what_to_do}</p>
        </section>
      )}
      {place.points_to_visit && (
        <section className="tv-section">
          <h4>Pontos a visitar</h4>
          <p>{place.points_to_visit}</p>
        </section>
      )}
      {place.image_paths.length > 0 && (
        <div className="tv-photos">
          {place.image_paths.map((p) => (
            <PlacePhoto key={p} path={p} title={place.title} />
          ))}
        </div>
      )}
      {onEdit && (
        <button type="button" className="water-primary" onClick={onEdit}>
          Editar destino
        </button>
      )}
    </article>
  )
}

export function TravelPage({
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
  const price = PRODUCTS.find((p) => p.key === 'viagens')?.monthlyCents ?? 590
  const preview = usePreview(unlocked ? null : communityId)
  const images = useTravelImages(unlocked ? communityId : null)
  const { items, loading, error, save, remove } = useManagedContent<TravelPlace>('travel_places', unlocked ? communityId : null, 'created_at')

  const [step, setStep] = useState<Step>('estado')
  const [uf, setUf] = useState<string | null>(null)
  const [city, setCity] = useState<string | null>(null)
  const [audience, setAudience] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [formMsg, setFormMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [bgOpen, setBgOpen] = useState(false)

  const bgPath = images.get('fundo', 'fundo')
  const { url: bgUrl } = useSignedImageUrl(bgPath)

  const inState = useMemo(() => filterPlaces(items, { state: uf }), [items, uf])
  const inCity = useMemo(() => filterPlaces(items, { state: uf, city }), [items, uf, city])
  const results = useMemo(() => filterPlaces(items, { state: uf, city, audience }), [items, uf, city, audience])
  const openPlace = items.find((p) => p.id === openId) ?? null

  const statesToShow = isOwner ? BR_STATES : BR_STATES.filter((s) => items.some((p) => p.state === s.uf))
  const citiesToShow = distinctCities(inState)
  const audiencesToShow = isOwner ? TRAVEL_AUDIENCES : TRAVEL_AUDIENCES.filter((a) => inCity.some((p) => p.audiences.includes(a.key)))

  function editable(kind: TravelImageKind, key: string) {
    return isOwner ? { communityId, uid: profileId, onSave: (p: string) => images.set(kind, key, p) } : undefined
  }

  function resetTo(next: Step) {
    setOpenId(null)
    if (next === 'estado') {
      setUf(null)
      setCity(null)
      setAudience(null)
    }
    if (next === 'cidade') {
      setCity(null)
      setAudience(null)
    }
    if (next === 'publico') setAudience(null)
    setStep(next)
  }

  function startEdit(p: TravelPlace) {
    setOpenId(null)
    setForm({
      id: p.id,
      title: p.title,
      state: p.state ?? '',
      city: p.city ?? '',
      audiences: p.audiences,
      description: p.description ?? '',
      whatToDo: p.what_to_do ?? '',
      points: p.points_to_visit ?? '',
      images: [p.image_paths[0] ?? '', p.image_paths[1] ?? '', p.image_paths[2] ?? ''],
      status: p.status,
    })
    setFormMsg(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.title.trim()) return setFormMsg('Dê um título ao destino.')
    if (!form.state) return setFormMsg('Escolha o estado.')
    setSaving(true)
    const r = await save(form.id, {
      title: form.title.trim(),
      state: form.state,
      city: form.city.trim() || null,
      audiences: form.audiences,
      description: form.description.trim() || null,
      what_to_do: form.whatToDo.trim() || null,
      points_to_visit: form.points.trim() || null,
      image_paths: form.images.filter(Boolean),
      status: form.status,
    })
    setSaving(false)
    if (r.error) return setFormMsg(r.error)
    setForm(null)
    setFormMsg(null)
  }

  async function removePlace() {
    if (!form?.id) return
    if (!window.confirm('Remover este destino?')) return
    setSaving(true)
    const r = await remove(form.id)
    setSaving(false)
    if (r.error) return setFormMsg(r.error)
    setForm(null)
  }

  const crumbs: { label: string; onClick: () => void }[] = [{ label: 'Brasil', onClick: () => resetTo('estado') }]
  if (uf) crumbs.push({ label: stateName(uf), onClick: () => resetTo('cidade') })
  if (city) crumbs.push({ label: city, onClick: () => resetTo('publico') })
  if (audience) crumbs.push({ label: audienceLabel(audience), onClick: () => setStep('lista') })

  return (
    <section className={'tv-page' + (bgUrl ? ' tv-page--bg' : '')} style={bgUrl ? { backgroundImage: 'url(' + bgUrl + ')' } : undefined}>
      <div className="tv-body">
        <h2 className="tv-title">Dicas de Viagem</h2>
        <p className="tv-lede">Escolha o destino do seu próximo passeio, com dicas do que fazer e o que visitar.</p>

        {!unlocked && (
          <article className="water-panel ex-offer">
            <h3>Conheça antes de assinar</h3>
            <p>
              Acesso a todos os roteiros e dicas por <strong>{formatBrl(price)} por mês</strong>, em uma assinatura só.
            </p>
            {preview && (
              <ul className="ex-offer-list">
                {preview.place_count > 0 && <li>{preview.place_count} destinos</li>}
                {preview.states.length > 0 && <li>Estados: {preview.states.join(', ')}</li>}
                {preview.samples.length > 0 && <li>Alguns destinos: {preview.samples.join(' · ')}</li>}
              </ul>
            )}
            <p className="home-muted">O acesso é liberado depois que o pagamento é confirmado.</p>
            <button type="button" className="water-primary water-primary--big" onClick={onOpenPlans}>
              Assinar por {formatBrl(price)}/mês
            </button>
          </article>
        )}

        {unlocked && !form && (
          <>
            {loading && <p className="home-muted">Carregando…</p>}
            {error && <p className="auth-error">{error}</p>}

            {openPlace ? (
              <PlaceDetail place={openPlace} communityId={communityId} isOwner={isOwner} onBack={() => setOpenId(null)} onEdit={isOwner ? () => startEdit(openPlace) : undefined} />
            ) : (
              <>
                <nav className="tv-crumbs" aria-label="Onde você está">
                  {crumbs.map((c, i) => (
                    <button key={c.label + i} type="button" className="tv-crumb" onClick={c.onClick} aria-current={i === crumbs.length - 1 ? 'step' : undefined}>
                      {c.label}
                    </button>
                  ))}
                </nav>

                {step === 'estado' && (
                  <>
                    <h3 className="tv-step">Escolha o estado</h3>
                    {!isOwner && statesToShow.length === 0 && !loading && <p className="home-muted">Os destinos ainda não foram publicados. Em breve, novidades por aqui.</p>}
                    <div className="tv-grid">
                      {statesToShow.map((s) => (
                        <TravelCard
                          key={s.uf}
                          label={s.name}
                          sub={s.uf}
                          path={images.get('estado', s.uf)}
                          editable={editable('estado', s.uf)}
                          onOpen={() => {
                            setUf(s.uf)
                            setStep('cidade')
                          }}
                        />
                      ))}
                    </div>
                    {items.length > 0 && (
                      <button type="button" className="tv-skip" onClick={() => setStep('lista')}>
                        Ver todos os destinos
                      </button>
                    )}
                  </>
                )}

                {step === 'cidade' && (
                  <>
                    <h3 className="tv-step">Escolha a cidade em {stateName(uf)}</h3>
                    {citiesToShow.length === 0 && <p className="home-muted">Ainda não há cidades neste estado.</p>}
                    <div className="tv-grid">
                      {citiesToShow.map((c) => (
                        <TravelCard
                          key={c}
                          label={c}
                          sub={uf ?? undefined}
                          path={images.get('cidade', cityKey(uf, c))}
                          editable={editable('cidade', cityKey(uf, c))}
                          onOpen={() => {
                            setCity(c)
                            setStep('publico')
                          }}
                        />
                      ))}
                    </div>
                    <button type="button" className="tv-skip" onClick={() => setStep('publico')}>
                      Todas as cidades
                    </button>
                  </>
                )}

                {step === 'publico' && (
                  <>
                    <h3 className="tv-step">Para quem é a viagem?</h3>
                    <div className="tv-grid">
                      {audiencesToShow.map((a) => (
                        <TravelCard
                          key={a.key}
                          label={a.label}
                          path={images.get('publico', a.key)}
                          editable={editable('publico', a.key)}
                          onOpen={() => {
                            setAudience(a.key)
                            setStep('lista')
                          }}
                        />
                      ))}
                    </div>
                    <button type="button" className="tv-skip" onClick={() => setStep('lista')}>
                      Qualquer tipo de viagem
                    </button>
                  </>
                )}

                {step === 'lista' && (
                  <>
                    <h3 className="tv-step">{results.length === 1 ? '1 destino encontrado' : results.length + ' destinos encontrados'}</h3>
                    {results.length === 0 && <p className="home-muted">Nenhum destino com essas escolhas. Volte e tente outra combinação.</p>}
                    <div className="tv-places">
                      {results.map((p) => (
                        <PlaceTile key={p.id} place={p} onOpen={() => setOpenId(p.id)} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {isOwner && !openPlace && (
              <div className="tv-owner">
                <button
                  type="button"
                  className="water-primary"
                  onClick={() => {
                    setForm({ ...EMPTY_FORM, state: uf ?? '', city: city ?? '', audiences: audience ? [audience] : [] })
                    setFormMsg(null)
                  }}
                >
                  Novo destino
                </button>
                <button type="button" className="water-link" onClick={() => setBgOpen((v) => !v)}>
                  {bgOpen ? 'Fechar imagem de fundo' : 'Imagem de fundo da página'}
                </button>
                {bgOpen && (
                  <div className="tv-card-editor">
                    <CoverImageInput
                      value={bgPath ?? ''}
                      communityId={communityId}
                      uid={profileId}
                      label="Imagem de fundo (9:16)"
                      aspectRatio="9 / 16"
                      recommendedSize="1080 × 1920 px"
                      onChange={(p) => void images.set('fundo', 'fundo', p)}
                    />
                  </div>
                )}
                {isMaster && <PriceEditor planKey="viagens" label="Dicas de Viagem" current={price} />}
              </div>
            )}
          </>
        )}

        {unlocked && isOwner && form && (
          <form className="wellness-form" onSubmit={(e) => void submit(e)} aria-label={form.id ? 'Editar destino' : 'Novo destino'}>
            <h3>{form.id ? 'Editar destino' : 'Novo destino'}</h3>
            {formMsg && <p className="auth-error">{formMsg}</p>}
            <label>
              Título
              <input value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label>
              Estado
              <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                <option value="">Escolha…</option>
                {BR_STATES.map((s) => (
                  <option key={s.uf} value={s.uf}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cidade
              <input value={form.city} maxLength={80} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </label>
            <fieldset className="tv-aud">
              <legend>Indicado para</legend>
              <div className="tv-aud-list">
                {TRAVEL_AUDIENCES.map((a) => (
                  <label key={a.key} className={'tv-aud-item' + (form.audiences.includes(a.key) ? ' is-on' : '')}>
                    <input
                      type="checkbox"
                      checked={form.audiences.includes(a.key)}
                      onChange={() =>
                        setForm({ ...form, audiences: form.audiences.includes(a.key) ? form.audiences.filter((x) => x !== a.key) : [...form.audiences, a.key] })
                      }
                    />
                    {a.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              Descrição do lugar
              <textarea rows={6} maxLength={4000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label>
              O que fazer
              <textarea rows={6} maxLength={4000} value={form.whatToDo} onChange={(e) => setForm({ ...form, whatToDo: e.target.value })} />
            </label>
            <label>
              Pontos a visitar
              <textarea rows={6} maxLength={4000} value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
            </label>
            {[0, 1, 2].map((i) => (
              <CoverImageInput
                key={i}
                id={'travel-photo-' + i}
                value={form.images[i]}
                communityId={communityId}
                uid={profileId}
                label={'Foto ' + (i + 1) + ' (4:5)'}
                aspectRatio="4 / 5"
                recommendedSize="1080 × 1350 px"
                onChange={(p) => setForm({ ...form, images: form.images.map((x, j) => (j === i ? p : x)) })}
              />
            ))}
            <label>
              Situação
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'draft' | 'published' })}>
                <option value="draft">Rascunho (só você vê)</option>
                <option value="published">Publicado para a comunidade</option>
              </select>
            </label>
            <div className="wellness-form-actions">
              <button type="submit" className="water-primary" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar destino'}
              </button>
              <button type="button" className="water-link" onClick={() => setForm(null)} disabled={saving}>
                Cancelar
              </button>
              {form.id && (
                <button type="button" className="agenda-danger" onClick={() => void removePlace()} disabled={saving}>
                  Excluir
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
