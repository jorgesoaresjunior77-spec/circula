import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BR_STATES } from '../lib/travel'
import { CityGroupsAdmin, ImageField } from './CityGroupsAdmin'

// Painel → Imagens → Na minha cidade. Tudo o que tem imagem na área da cidade, num só lugar:
// grupos e categorias, estados, cidades, lugares e autônomos.

type Sub = 'grupos' | 'estados' | 'cidades' | 'lugares'
const SUBS: { key: Sub; label: string; hint: string }[] = [
  { key: 'grupos', label: 'Grupos e categorias', hint: 'Cards de cada grupo e de cada categoria (imagem e descrição).' },
  { key: 'estados', label: 'Estados', hint: 'Uma imagem para cada estado.' },
  { key: 'cidades', label: 'Cidades', hint: 'Uma imagem para cada cidade já escolhida por alguma participante.' },
  { key: 'lugares', label: 'Lugares e autônomos', hint: 'Logo e fachada de qualquer lugar ou profissional cadastrado.' },
]

export const STATE_IMAGE_SPEC = '1600 × 800 px (2:1, horizontal). Aparece no topo da página da cidade.'
export const CITY_IMAGE_SPEC = '1600 × 800 px (2:1, horizontal). Aparece no topo da página da cidade.'
export const LOGO_IMAGE_SPEC = '800 × 800 px (quadrada, de preferência com fundo transparente). Aparece no card do lugar.'
export const FACADE_IMAGE_SPEC = '1600 × 900 px (16:9, horizontal). Aparece no topo do card do lugar.'

function StatesAdmin() {
  const [images, setImages] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('city_state_images').select('uf, imagem')
    const map: Record<string, string> = {}
    for (const r of (data ?? []) as { uf: string; imagem: string }[]) map[r.uf] = r.imagem
    setImages(map)
  }, [])

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('city_state_images')
      .select('uf, imagem')
      .then(({ data }) => {
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const r of (data ?? []) as { uf: string; imagem: string }[]) map[r.uf] = r.imagem
        setImages(map)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function set(uf: string, url: string | null) {
    setError(null)
    const { error: rpcError } = await supabase.rpc('city_state_image_set', { p_uf: uf, p_url: url })
    if (rpcError) setError('Não foi possível salvar agora.')
    else await load()
  }

  return (
    <div className="cty-admin">
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {BR_STATES.map((s) => (
        <article key={s.uf} className="cty-admin-item">
          <p>
            <strong>{s.name}</strong> ({s.uf})
          </p>
          <ImageField value={images[s.uf] ?? null} spec={STATE_IMAGE_SPEC} onChange={(u) => void set(s.uf, u)} />
        </article>
      ))}
    </div>
  )
}

interface CityRow {
  id: string
  nome: string
  estado: string
  imagem: string | null
}

function CitiesAdmin() {
  const [rows, setRows] = useState<CityRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: qError } = await supabase.from('cidades').select('id, nome, estado, imagem').order('estado').order('nome')
    if (qError) setError('Não foi possível carregar as cidades.')
    else setRows((data ?? []) as CityRow[])
  }, [])

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('cidades')
      .select('id, nome, estado, imagem')
      .order('estado')
      .order('nome')
      .then(({ data, error: qError }) => {
        if (cancelled) return
        if (qError) setError('Não foi possível carregar as cidades.')
        else setRows((data ?? []) as CityRow[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function set(id: string, url: string | null) {
    setError(null)
    const { error: rpcError } = await supabase.rpc('city_image_set', { p_city: id, p_url: url })
    if (rpcError) setError('Não foi possível salvar agora.')
    else await load()
  }

  return (
    <div className="cty-admin">
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {!rows && !error && <p className="home-muted">Carregando…</p>}
      {rows && rows.length === 0 && <p className="home-muted">Nenhuma participante escolheu uma cidade ainda.</p>}
      {rows?.map((c) => (
        <article key={c.id} className="cty-admin-item">
          <p>
            <strong>{c.nome}</strong> / {c.estado}
          </p>
          <ImageField value={c.imagem} spec={CITY_IMAGE_SPEC} onChange={(u) => void set(c.id, u)} />
        </article>
      ))}
    </div>
  )
}

interface ListingRow {
  id: string
  titulo: string
  tipo: 'lugar' | 'profissional'
  cidade: string
  estado: string
  logo: string | null
  foto: string | null
}

function ListingsAdmin() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<ListingRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (term: string) => {
    const { data, error: rpcError } = await supabase.rpc('city_admin_listings', { p_q: term || null })
    if (rpcError) setError('Não foi possível carregar agora.')
    else {
      setError(null)
      setRows((data ?? []) as ListingRow[])
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => void load(q), 250)
    return () => window.clearTimeout(t)
  }, [q, load])

  async function set(l: ListingRow, change: Partial<Pick<ListingRow, 'logo' | 'foto'>>) {
    const next = { logo: l.logo, foto: l.foto, ...change }
    const { error: rpcError } = await supabase.rpc('city_listing_images_set', { p_listing: l.id, p_logo: next.logo, p_foto: next.foto })
    if (rpcError) setError('Não foi possível salvar agora.')
    else await load(q)
  }

  return (
    <div className="cty-admin">
      <input type="search" className="cty-search" placeholder="Buscar lugar ou profissional pelo nome" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar lugar ou profissional" />
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {rows && rows.length === 0 && <p className="home-muted">Nada encontrado.</p>}
      {rows?.map((l) => (
        <article key={l.id} className="cty-admin-item">
          <p>
            <strong>{l.titulo}</strong> · {l.tipo === 'lugar' ? 'Lugar' : 'Profissional'} · {l.cidade}/{l.estado}
          </p>
          <div className="cty-photos">
            <div>
              <p className="cty-label">Logo</p>
              <ImageField value={l.logo} spec={LOGO_IMAGE_SPEC} onChange={(u) => void set(l, { logo: u })} />
            </div>
            <div>
              <p className="cty-label">Fachada ou outra foto</p>
              <ImageField value={l.foto} spec={FACADE_IMAGE_SPEC} onChange={(u) => void set(l, { foto: u })} />
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

export function CityImagesAdmin() {
  const [sub, setSub] = useState<Sub>('grupos')
  const current = SUBS.find((s) => s.key === sub)
  return (
    <div className="cty-admin">
      <div className="cty-tabs" role="tablist" aria-label="Imagens de Na minha cidade">
        {SUBS.map((s) => (
          <button key={s.key} type="button" role="tab" aria-selected={sub === s.key} className={`cty-tab${sub === s.key ? ' cty-tab--on' : ''}`} onClick={() => setSub(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="home-muted">{current?.hint}</p>
      {sub === 'grupos' && <CityGroupsAdmin />}
      {sub === 'estados' && <StatesAdmin />}
      {sub === 'cidades' && <CitiesAdmin />}
      {sub === 'lugares' && <ListingsAdmin />}
    </div>
  )
}
