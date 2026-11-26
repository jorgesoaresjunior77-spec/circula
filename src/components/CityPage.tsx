import { useEffect, useMemo, useState } from 'react'
import { CategoryIcon } from './CategoryIcon'
import type { Profile } from '../types/profile'
import {
  HEALTH_NOTE,
  MEETUP_SAFETY_NOTE,
  PRICE_RANGES,
  RECOMMENDATION_NOTE,
  groupLabel,
} from '../lib/city'
import type { CityInfo, CityListing, CityListingType } from '../lib/city'
import { countByCategory, countByGroup, filterGuide, splitUpcoming } from '../lib/cityFilter'
import type { GuideSort } from '../lib/cityFilter'
import { BR_STATES } from '../lib/travel'
import { supabase } from '../lib/supabase'
import { takeCityRequest } from '../lib/carro'
import { fetchCityInfo, findCityByIbge, useCityCatalog, useCityGroups, useCityListings, useMyCity } from '../hooks/useCity'
import type { ListingInput } from '../hooks/useCity'
import { CityPicker } from './CityPicker'
import { CityListingForm } from './CityListingForm'
import { CityListingCard } from './CityListingCard'

// "Na minha cidade": cadastros locais (guia de lugares e profissionais, eventos
// e convites "Vamos juntas?"). NÃO tem chat. A página da cidade nasce quando a
// primeira participante a escolhe.

type Tab = 'guia' | 'acontece' | 'juntas'
const TABS: { key: Tab; label: string }[] = [
  { key: 'guia', label: 'Guia da cidade' },
  { key: 'acontece', label: 'Acontece na minha cidade' },
  { key: 'juntas', label: 'Vamos juntas?' },
]

interface FormState {
  tipo: CityListingType
  editing: CityListing | null
}

export function CityPage({ profile, onOpenCarro }: { profile: Profile; onOpenCarro?: (carCategoryId: string) => void }) {
  const { city: myCity, loading: loadingCity, choose } = useMyCity()
  const [other, setOther] = useState<CityInfo | null>(null)
  const [picker, setPicker] = useState<null | 'mine' | 'other'>(null)
  const [pickerBusy, setPickerBusy] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)

  const city = other ?? myCity
  const readOnly = !!other && other.id !== myCity?.id
  const isAdmin = profile.role === 'master' || profile.role === 'professional'

  const { categories, tags, createCategory } = useCityCatalog()
  const { groups } = useCityGroups()

  // Abrir a página limpa a bolinha de "cadastros novos" do card da Home.
  useEffect(() => {
    try {
      localStorage.setItem(`circula:city-seen:${profile.id}`, new Date().toISOString())
    } catch {
      /* sem storage */
    }
  }, [profile.id])
  const listingsApi = useCityListings(city?.id ?? null)
  const { listings, loading, error } = listingsApi

  const [tab, setTab] = useState<Tab>('guia')
  const [form, setForm] = useState<FormState | null>(null)
  const [group, setGroup] = useState<string | null>(null)
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showAllList, setShowAllList] = useState(false)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [price, setPrice] = useState<string | null>(null)
  const [sort, setSort] = useState<GuideSort>('indicados')
  const [showPast, setShowPast] = useState(false)
  // vindo do Carro em Dia ("Encontrar na minha cidade"): abre a categoria que combina
  const [pedidoCarro] = useState(() => takeCityRequest())
  const [carCat, setCarCat] = useState<string | null>(null)
  const [pedidoAplicado, setPedidoAplicado] = useState(false)
  if (pedidoCarro && !pedidoAplicado && categories.length > 0) {
    // ajuste durante a renderização (as categorias chegam depois da tela abrir)
    setPedidoAplicado(true)
    const c = categories.find((x) => pedidoCarro.includes(x.id))
    if (c) {
      setGroup(c.grupo)
      setCategoryId(c.id)
    }
  }
  // atalho de volta: esta categoria combina com alguma categoria do Carro em Dia?
  useEffect(() => {
    if (!categoryId || !onOpenCarro) return
    let cancelled = false
    void supabase
      .from('car_categories')
      .select('id')
      .eq('ativa', true)
      .contains('cidade_categorias', [categoryId])
      .limit(1)
      .then(({ data }) => {
        if (!cancelled) setCarCat((data as { id: string }[] | null)?.[0]?.id ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [categoryId, onOpenCarro])

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const guideAll = useMemo(() => listings.filter((l) => l.tipo === 'lugar' || l.tipo === 'profissional'), [listings])
  const featured = useMemo(() => guideAll.filter((l) => l.destaque), [guideAll])
  const events = useMemo(() => listings.filter((l) => l.tipo === 'evento'), [listings])
  const meetups = useMemo(() => listings.filter((l) => l.tipo === 'convite'), [listings])
  const groupCounts = useMemo(() => countByGroup(guideAll, categories), [guideAll, categories])

  const guideScope = useMemo(
    () => filterGuide(guideAll, categories, { group, categoryId: null, query: '', tagIds: [], price: null, sort }),
    [guideAll, categories, group, sort],
  )
  const categoryCounts = useMemo(() => countByCategory(guideScope), [guideScope])
  const guideShown = useMemo(
    () => filterGuide(guideAll, categories, { group, categoryId, query, tagIds, price, sort }),
    [guideAll, categories, group, categoryId, query, tagIds, price, sort],
  )

  async function confirmCity(uf: string, c: { ibge_id: number; nome: string }) {
    setPickerBusy(true)
    setPickerError(null)
    if (picker === 'other') {
      const found = await findCityByIbge(c.ibge_id)
      setPickerBusy(false)
      if (!found) {
        setPickerError(`Ainda não há ninguém em ${c.nome}. Se for a sua cidade, escolha “Mudar cidade” para criar a página dela.`)
        return
      }
      setOther(found)
      setPicker(null)
      resetFilters()
      return
    }
    const r = await choose(uf, c.ibge_id, c.nome)
    setPickerBusy(false)
    if (r.error) {
      setPickerError(r.error)
      return
    }
    setOther(null)
    setPicker(null)
    resetFilters()
  }

  function resetFilters() {
    setGroup(null)
    setCategoryId(null)
    setQuery('')
    setTagIds([])
    setPrice(null)
    setShowAllGroups(false)
    setShowAllCategories(false)
    setShowFilters(false)
    setShowAllList(false)
  }

  async function saveListing(input: ListingInput) {
    return listingsApi.save(form?.editing?.id ?? null, input)
  }

  async function refreshOther() {
    if (other) setOther(await fetchCityInfo(other.id))
  }

  if (loadingCity) return <p className="home-muted">Carregando…</p>

  // ---- Escolher a cidade (primeira vez, "Mudar cidade" ou ver outra) ----
  if (picker || !city) {
    const mode = picker ?? 'mine'
    return (
      <section className="cty-page">
        <p className="cty-eyebrow">Conexão · Proximidade</p>
        <h2 className="cty-title">Na minha cidade</h2>
        {mode === 'mine' && !city && (
          <p className="cty-lead">
            Encontre mulheres da sua cidade, descubra lugares, serviços e eventos, e combine caminhadas e cafés. Escolha o seu estado e a sua cidade para começar.
          </p>
        )}
        {mode === 'mine' && city && <p className="cty-lead">Escolha a nova cidade. Ela fica salva no seu perfil.</p>}
        {mode === 'other' && <p className="cty-lead">Escolha uma cidade para ver os cadastros dela (somente leitura).</p>}
        <CityPicker
          initialUf={mode === 'mine' ? (myCity?.estado ?? null) : null}
          confirmLabel={mode === 'mine' ? 'Salvar minha cidade' : 'Ver esta cidade'}
          busy={pickerBusy}
          error={pickerError}
          onConfirm={(uf, c) => void confirmCity(uf, c)}
          onCancel={city ? () => { setPicker(null); setPickerError(null) } : undefined}
        />
      </section>
    )
  }

  const stateName = BR_STATES.find((s) => s.uf === city.estado)?.name ?? city.estado
  const totalListings = listings.length
  const meetupSplit = splitUpcoming(meetups)
  const eventSplit = splitUpcoming(events)

  const cardProps = {
    tags,
    uid: profile.id,
    isAdmin,
    readOnly,
    onVote: (l: CityListing) => listingsApi.toggleVote(l, profile.id),
    onSave: (l: CityListing) => listingsApi.toggleSave(l, profile.id),
    onGo: (l: CityListing) => listingsApi.toggleGo(l),
    onEdit: (l: CityListing) => setForm({ tipo: l.tipo, editing: l }),
    onDelete: async (l: CityListing) => {
      const r = await listingsApi.remove(l.id)
      if (!r.error) await refreshOther()
      return r
    },
    onHide: (l: CityListing, hidden: boolean) => listingsApi.setHidden(l.id, hidden),
    onReport: (l: CityListing, motivo: string) => listingsApi.report(l, profile.id, motivo),
    onReload: () => void listingsApi.reload(),
  }

  const addButtons = (tipos: { tipo: CityListingType; label: string }[]) =>
    !readOnly && (
      <div className="cty-actions">
        {tipos.map((t) => (
          <button key={t.tipo} type="button" className="cty-btn cty-btn--primary" onClick={() => setForm({ tipo: t.tipo, editing: null })}>
            {t.label}
          </button>
        ))}
      </div>
    )

  const emptyHero = (tipos: { tipo: CityListingType; label: string }[]) => (
    <div className="cty-empty">
      <p className="cty-empty-title">Seja a primeira a cadastrar em {city.nome}</p>
      <p className="cty-lead">Ainda não há nada por aqui. O que você cadastrar ajuda outras mulheres da sua cidade, e dá para convidar amigas para entrarem no Círculo.</p>
      {addButtons(tipos)}
    </div>
  )

  return (
    <section className="cty-page">
      <header className="cty-head">
        <div className="cty-head-row">
          <h2 className="cty-title">
            Minha cidade
            <span className="cty-title-uf">{city.nome}/{city.estado}</span>
          </h2>
        </div>
        <p className="cty-stats">
          {city.mulheres} {city.mulheres === 1 ? 'mulher' : 'mulheres'} · {totalListings} {totalListings === 1 ? 'cadastro' : 'cadastros'} · {stateName}
        </p>
        <div className="cty-head-links">
          {readOnly ? (
            <button type="button" className="cty-link" onClick={() => { setOther(null); resetFilters() }}>
              Voltar para a minha cidade
            </button>
          ) : (
            <button type="button" className="cty-link" onClick={() => { setPickerError(null); setPicker('mine') }}>
              Mudar cidade
            </button>
          )}
          <span aria-hidden="true">·</span>
          <button type="button" className="cty-link" onClick={() => { setPickerError(null); setPicker('other') }}>
            Ver outra cidade
          </button>
        </div>
        {readOnly && <p className="cty-note">Você está vendo {city.nome} em modo leitura. Para cadastrar, use a sua cidade.</p>}
      </header>

      <div className="cty-tabs" role="tablist" aria-label="Seções da cidade">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`cty-tab${tab === t.key ? ' cty-tab--on' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="home-muted">Carregando…</p>}

      {form && (
        <CityListingForm
          key={form.editing?.id ?? form.tipo}
          tipo={form.tipo}
          uid={profile.id}
          cityName={city.nome}
          editing={form.editing}
          listings={guideAll}
          categories={categories}
          groups={groups}
          tags={tags}
          onCreateCategory={createCategory}
          onSave={saveListing}
          onAlsoRecommend={(l) => { if (!l.votei) void listingsApi.toggleVote(l, profile.id) }}
          onClose={() => { setForm(null); void refreshOther() }}
        />
      )}

      {!loading && !form && tab === 'guia' && (
        <div className="cty-section">
          {totalListings === 0 && guideAll.length === 0 && events.length === 0 && meetups.length === 0 ? (
            emptyHero([
              { tipo: 'lugar', label: 'Indicar um lugar' },
              { tipo: 'profissional', label: 'Divulgar uma profissional' },
            ])
          ) : (
            <>
              <input
                type="search"
                className="cty-search"
                placeholder="Buscar lugares e profissionais"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar no guia"
              />

              {!group && !query.trim() ? (
                <>
                  {featured.length > 0 && (
                    <div className="cty-featured" aria-label="Em destaque">
                      <p className="cty-block-title">★ Em destaque</p>
                      <div className="cty-featured-row">
                        {featured.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            className="cty-featured-tile"
                            onClick={() => { setGroup(null); setCategoryId(null); setQuery(l.titulo) }}
                          >
                            {l.foto ? <img src={l.foto} alt="" loading="lazy" decoding="async" /> : <span className="cty-featured-ph" aria-hidden="true" />}
                            <span className="cty-featured-name">{l.titulo}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="cty-block-title">Explorar por grupo</p>
                  <div className="cty-group-grid">
                    {groups.filter((g) => showAllGroups || (groupCounts.get(g.slug) ?? 0) > 0).map((g) => (
                      <button key={g.slug} type="button" className="cty-group" onClick={() => { setGroup(g.slug); setCategoryId(null) }}>
                        <span className="cty-group-icon" aria-hidden="true"><CategoryIcon grupo={g.slug} nome={g.nome} size={30} /></span>
                        <span className="cty-group-name">{g.nome}</span>
                        <span className="cty-group-count">{groupCounts.get(g.slug) ?? 0}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="cty-link cty-link--center" onClick={() => setShowAllGroups((v) => !v)}>
                    {showAllGroups ? 'Mostrar só os grupos com cadastros' : 'Ver todos os grupos'}
                  </button>
                </>
              ) : (
                <>
                  {group && (
                    <div className="cty-crumb">
                      <button type="button" className="cty-link" onClick={() => { setGroup(null); setCategoryId(null); setTagIds([]); setPrice(null); setShowFilters(false) }}>
                        ← Todos os grupos
                      </button>
                      <strong>{groupLabel(group, groups)}</strong>
                    </div>
                  )}
                  {group && groups.find((g) => g.slug === group)?.descricao && <p className="cty-lead">{groups.find((g) => g.slug === group)?.descricao}</p>}
                  {(group === 'saude' || group === 'beleza') && <p className="cty-note">{HEALTH_NOTE}</p>}

                  {group && (
                    <div className="cty-cats" role="group" aria-label="Categorias">
                      <div className="cty-chip-scroll">
                        <button type="button" className={`cty-pill${!categoryId ? ' cty-pill--on' : ''}`} onClick={() => setCategoryId(null)}>
                          Todas <span className="cty-pill-count">{guideScope.length}</span>
                        </button>
                        {categories
                          .filter((c) => c.grupo === group && c.status !== 'unida' && (showAllCategories || (categoryCounts.get(c.id) ?? 0) > 0))
                          .map((c) => (
                            <button key={c.id} type="button" className={`cty-pill${categoryId === c.id ? ' cty-pill--on' : ''}`} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>
                              <CategoryIcon grupo={c.grupo} nome={c.nome} size={18} />
                              {c.nome}
                              <span className="cty-pill-count">{categoryCounts.get(c.id) ?? 0}</span>
                            </button>
                          ))}
                      </div>
                      <button type="button" className="cty-link" onClick={() => setShowAllCategories((v) => !v)}>
                        {showAllCategories ? 'Só as com cadastros' : 'Ver todas as categorias'}
                      </button>
                    </div>
                  )}

                  <button type="button" className="cty-filter-toggle" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
                    Filtros e ordem{tagIds.length + (price ? 1 : 0) > 0 ? ` (${tagIds.length + (price ? 1 : 0)})` : ''}
                    <span aria-hidden="true">{showFilters ? '−' : '+'}</span>
                  </button>
                  {showFilters && (
                    <div className="cty-filters">
                      <div className="cty-chip-bar" role="group" aria-label="Filtros">
                        {tags
                          .filter((t) => t.tipo !== 'alimentacao' || group === 'comer')
                          .map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              className={`cty-chip cty-chip--soft${tagIds.includes(t.id) ? ' cty-chip--on' : ''}`}
                              onClick={() => setTagIds((l) => (l.includes(t.id) ? l.filter((x) => x !== t.id) : [...l, t.id]))}
                            >
                              {t.nome}
                            </button>
                          ))}
                      </div>
                      <div className="cty-row">
                        <div className="cty-chip-bar" role="group" aria-label="Faixa de preço">
                          {PRICE_RANGES.map((p) => (
                            <button key={p} type="button" className={`cty-chip${price === p ? ' cty-chip--on' : ''}`} onClick={() => setPrice(price === p ? null : p)}>
                              {p}
                            </button>
                          ))}
                        </div>
                        <label className="cty-field cty-field--inline">
                          <span className="cty-label">Ordenar por</span>
                          <select value={sort} onChange={(e) => setSort(e.target.value as GuideSort)}>
                            <option value="indicados">Mais indicados</option>
                            <option value="recentes">Mais recentes</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  )}
                </>
              )}

              {categoryId && carCat && onOpenCarro && (
                <button type="button" className="car-city-link" onClick={() => onOpenCarro(carCat)}>
                  Dúvidas sobre carro? Veja as respostas
                </button>
              )}

              <div className="cty-results-head">
                <p className="cty-block-title">
                  {!group && !query.trim() ? 'Mais indicados' : `${guideShown.length} ${guideShown.length === 1 ? 'resultado' : 'resultados'}`}
                </p>
              </div>
              {guideShown.length === 0 ? (
                <p className="home-muted">Nada encontrado com esses filtros.</p>
              ) : (
                <div className="cty-list">
                  {(!group && !query.trim() && !showAllList ? guideShown.slice(0, 10) : guideShown).map((l) => (
                    <CityListingCard key={l.id} listing={l} category={l.categoria_id ? (catById.get(l.categoria_id) ?? null) : null} {...cardProps} />
                  ))}
                </div>
              )}
              {!group && !query.trim() && guideShown.length > 10 && (
                <button type="button" className="cty-link cty-link--center" onClick={() => setShowAllList((v) => !v)}>
                  {showAllList ? 'Ver só os mais indicados' : `Ver todos (${guideShown.length})`}
                </button>
              )}

              {addButtons([
                { tipo: 'lugar', label: '+ Indicar um lugar' },
                { tipo: 'profissional', label: '+ Indicar uma profissional' },
              ])}
              <p className="cty-note">{RECOMMENDATION_NOTE}</p>
            </>
          )}
        </div>
      )}

      {!loading && !form && tab === 'acontece' && (
        <div className="cty-section">
          {events.length === 0 ? (
            emptyHero([{ tipo: 'evento', label: 'Cadastrar um evento' }])
          ) : (
            <>
              {addButtons([{ tipo: 'evento', label: 'Cadastrar um evento' }])}
              <div className="cty-list">
                {eventSplit.upcoming.length === 0 && <p className="home-muted">Nenhum evento próximo.</p>}
                {eventSplit.upcoming.map((l) => (
                  <CityListingCard key={l.id} listing={l} category={l.categoria_id ? (catById.get(l.categoria_id) ?? null) : null} {...cardProps} />
                ))}
              </div>
              {eventSplit.past.length > 0 && (
                <>
                  <button type="button" className="cty-link" onClick={() => setShowPast((v) => !v)}>
                    {showPast ? 'Esconder eventos passados' : `Ver eventos passados (${eventSplit.past.length})`}
                  </button>
                  {showPast && (
                    <div className="cty-list">
                      {eventSplit.past.map((l) => (
                        <CityListingCard key={l.id} listing={l} category={l.categoria_id ? (catById.get(l.categoria_id) ?? null) : null} {...cardProps} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {!loading && !form && tab === 'juntas' && (
        <div className="cty-section">
          <p className="cty-safety" role="note">
            {MEETUP_SAFETY_NOTE}
          </p>
          {meetups.length === 0 ? (
            emptyHero([{ tipo: 'convite', label: 'Convidar para algo' }])
          ) : (
            <>
              {addButtons([{ tipo: 'convite', label: 'Convidar para algo' }])}
              <div className="cty-list">
                {meetupSplit.upcoming.length === 0 && <p className="home-muted">Nenhum convite próximo.</p>}
                {meetupSplit.upcoming.map((l) => (
                  <CityListingCard key={l.id} listing={l} category={null} {...cardProps} />
                ))}
              </div>
              {meetupSplit.past.length > 0 && (
                <>
                  <button type="button" className="cty-link" onClick={() => setShowPast((v) => !v)}>
                    {showPast ? 'Esconder convites passados' : `Ver convites passados (${meetupSplit.past.length})`}
                  </button>
                  {showPast && (
                    <div className="cty-list">
                      {meetupSplit.past.map((l) => (
                        <CityListingCard key={l.id} listing={l} category={null} {...cardProps} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
