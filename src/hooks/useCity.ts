import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { checkPreparedImage, compressImage, UPLOAD_CACHE_CONTROL, validateImageFile } from '../lib/imageUpload'
import { cityErrorMessage } from '../lib/city'
import type { CityCategory, CityInfo, CityListing, CityTag } from '../lib/city'

// "Na minha cidade": a cidade da participante, o catálogo global (categorias e
// tags) e os cadastros da cidade. Tudo passa pelas funções/regras do banco —
// aqui só ficam as chamadas.

export interface Result {
  error: string | null
}

// ---- A cidade da participante ------------------------------------------------
export function useMyCity(enabled = true) {
  const [city, setCity] = useState<CityInfo | null>(null)
  const [loading, setLoading] = useState(enabled)

  const reload = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_city')
    setCity(!error && data ? (data as CityInfo) : null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void supabase.rpc('my_city').then(({ data, error }) => {
      if (cancelled) return
      setCity(!error && data ? (data as CityInfo) : null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  const choose = useCallback(
    async (uf: string, ibgeId: number, nome: string): Promise<Result> => {
      const { error } = await supabase.rpc('choose_city', { p_ibge_id: ibgeId, p_uf: uf, p_nome: nome })
      if (error) return { error: 'Não foi possível salvar a cidade agora. Tente de novo.' }
      await reload()
      return { error: null }
    },
    [reload],
  )

  return { city, loading, reload, choose }
}

/** Dados de qualquer cidade (modo leitura de outras cidades). */
export async function fetchCityInfo(cityId: string): Promise<CityInfo | null> {
  const { data, error } = await supabase.rpc('city_info', { p_city: cityId })
  return !error && data ? (data as CityInfo) : null
}

/** Cidade (por código IBGE) já cadastrada no Círcula, se houver — para "ver outras cidades". */
export async function findCityByIbge(ibgeId: number): Promise<CityInfo | null> {
  const { data } = await supabase.from('cidades').select('id').eq('ibge_id', ibgeId).maybeSingle()
  return data ? fetchCityInfo((data as { id: string }).id) : null
}

// ---- Catálogo global: categorias e tags ---------------------------------------
export function useCityCatalog() {
  const [categories, setCategories] = useState<CityCategory[]>([])
  const [tags, setTags] = useState<CityTag[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const [cats, tgs] = await Promise.all([
      supabase.from('city_categories').select('id, nome, nome_normalizado, grupo, status, unida_a').order('nome'),
      supabase.from('city_tags').select('id, nome, tipo').order('nome'),
    ])
    if (!cats.error) setCategories((cats.data ?? []) as CityCategory[])
    if (!tgs.error) setTags((tgs.data ?? []) as CityTag[])
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      supabase.from('city_categories').select('id, nome, nome_normalizado, grupo, status, unida_a').order('nome'),
      supabase.from('city_tags').select('id, nome, tipo').order('nome'),
    ]).then(([cats, tgs]) => {
      if (cancelled) return
      if (!cats.error) setCategories((cats.data ?? []) as CityCategory[])
      if (!tgs.error) setTags((tgs.data ?? []) as CityTag[])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /** Cria a categoria (fica disponível na hora). Devolve o id e se já existia uma igual. */
  const createCategory = useCallback(
    async (nome: string, grupo: string): Promise<{ error: string | null; id: string | null; existing: boolean }> => {
      const { data, error } = await supabase.rpc('create_city_category', { p_nome: nome, p_grupo: grupo })
      if (error) return { error: cityErrorMessage(error.message), id: null, existing: false }
      await reload()
      const r = data as { id: string; existing: boolean }
      return { error: null, id: r.id, existing: r.existing }
    },
    [reload],
  )

  return { categories, tags, loading, reload, createCategory }
}

// ---- Cadastros ------------------------------------------------------------------
export interface ListingInput {
  tipo: CityListing['tipo']
  categoria_id: string | null
  titulo: string
  descricao: string | null
  bairro: string | null
  endereco: string | null
  contato: string | null
  instagram: string | null
  faixa_preco: CityListing['faixa_preco']
  horario: string | null
  foto: string | null
  e_proprio_negocio: boolean
  atende_toda_cidade: boolean
  starts_at: string | null
  local_nome: string | null
  valor: string | null
  link: string | null
  atividade: string | null
  vagas: number | null
  nivel: CityListing['nivel']
  tags: string[]
}

export function useCityListings(cityId: string | null, onlySaved = false) {
  const [listings, setListings] = useState<CityListing[]>([])
  const [loading, setLoading] = useState(!!cityId || onlySaved)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!cityId && !onlySaved) return
    const { data, error: rpcError } = await supabase.rpc('list_city_listings', {
      p_city: cityId,
      p_only_saved: onlySaved,
    })
    if (rpcError) {
      setError('Não foi possível carregar agora. Tente de novo.')
    } else {
      setError(null)
      setListings((data ?? []) as CityListing[])
    }
    setLoading(false)
  }, [cityId, onlySaved])

  useEffect(() => {
    if (!cityId && !onlySaved) return
    let cancelled = false
    void supabase
      .rpc('list_city_listings', { p_city: cityId, p_only_saved: onlySaved })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return
        if (rpcError) {
          setError('Não foi possível carregar agora. Tente de novo.')
        } else {
          setError(null)
          setListings((data ?? []) as CityListing[])
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cityId, onlySaved])

  const patch = useCallback((id: string, change: Partial<CityListing>) => {
    setListings((list) => list.map((l) => (l.id === id ? { ...l, ...change } : l)))
  }, [])

  /** Cria ou edita um cadastro (e as tags dele). */
  const save = useCallback(
    async (id: string | null, input: ListingInput): Promise<Result> => {
      if (!cityId) return { error: 'Escolha uma cidade primeiro.' }
      const { tags, ...fields } = input
      let listingId = id
      if (id) {
        const { error: upError } = await supabase.from('city_listings').update(fields).eq('id', id)
        if (upError) return { error: cityErrorMessage(upError.message) }
      } else {
        const { data, error: inError } = await supabase
          .from('city_listings')
          .insert({ ...fields, city_id: cityId })
          .select('id')
          .single()
        if (inError || !data) return { error: cityErrorMessage(inError?.message) }
        listingId = (data as { id: string }).id
      }
      if (listingId) {
        await supabase.from('city_listing_tags').delete().eq('listing_id', listingId)
        if (tags.length > 0) {
          await supabase.from('city_listing_tags').insert(tags.map((tag_id) => ({ listing_id: listingId, tag_id })))
        }
      }
      await reload()
      return { error: null }
    },
    [cityId, reload],
  )

  const remove = useCallback(
    async (id: string): Promise<Result> => {
      const { error: delError } = await supabase.from('city_listings').delete().eq('id', id)
      if (delError) return { error: 'Não foi possível excluir agora. Tente de novo.' }
      setListings((list) => list.filter((l) => l.id !== id))
      return { error: null }
    },
    [],
  )

  /** Administração: oculta ou volta a mostrar um cadastro. */
  const setHidden = useCallback(
    async (id: string, hidden: boolean): Promise<Result> => {
      const { error: upError } = await supabase.from('city_listings').update({ status: hidden ? 'oculto' : 'ativo' }).eq('id', id)
      if (upError) return { error: 'Não foi possível alterar agora. Tente de novo.' }
      patch(id, { status: hidden ? 'oculto' : 'ativo' })
      return { error: null }
    },
    [patch],
  )

  const toggleVote = useCallback(
    async (l: CityListing, uid: string): Promise<Result> => {
      if (l.votei) {
        const { error: e } = await supabase.from('city_listing_votes').delete().eq('listing_id', l.id).eq('user_id', uid)
        if (e) return { error: 'Não foi possível alterar agora.' }
        patch(l.id, { votei: false, votos: Math.max(0, l.votos - 1) })
      } else {
        const { error: e } = await supabase.from('city_listing_votes').insert({ listing_id: l.id, user_id: uid })
        if (e && e.code !== '23505') return { error: 'Não foi possível indicar agora.' }
        if (!e) patch(l.id, { votei: true, votos: l.votos + 1 })
      }
      return { error: null }
    },
    [patch],
  )

  const toggleSave = useCallback(
    async (l: CityListing, uid: string): Promise<Result> => {
      if (l.salvei) {
        const { error: e } = await supabase.from('city_saved').delete().eq('listing_id', l.id).eq('user_id', uid)
        if (e) return { error: 'Não foi possível alterar agora.' }
        patch(l.id, { salvei: false })
      } else {
        const { error: e } = await supabase.from('city_saved').insert({ listing_id: l.id, user_id: uid })
        if (e && e.code !== '23505') return { error: 'Não foi possível salvar agora.' }
        patch(l.id, { salvei: true })
      }
      return { error: null }
    },
    [patch],
  )

  const toggleGo = useCallback(
    async (l: CityListing): Promise<Result> => {
      const { data, error: e } = await supabase.rpc('city_meetup_toggle', { p_listing: l.id })
      if (e) return { error: cityErrorMessage(e.message) }
      const r = data as { going: boolean; count: number }
      patch(l.id, { vou: r.going, confirmadas: r.count })
      return { error: null }
    },
    [patch],
  )

  const report = useCallback(async (l: CityListing, uid: string, motivo: string): Promise<Result> => {
    const { error: e } = await supabase
      .from('city_reports')
      .insert({ listing_id: l.id, reported_by: uid, motivo: motivo.trim() || null })
    if (e && e.code !== '23505') return { error: 'Não foi possível enviar a denúncia agora. Tente de novo.' }
    return { error: null }
  }, [])

  return { listings, loading, error, reload, save, remove, setHidden, toggleVote, toggleSave, toggleGo, report }
}

/** Foto do cadastro: sobe para o bucket `avatars` (pasta da própria participante) e devolve a URL. */
export async function uploadCityPhoto(uid: string, originalFile: File): Promise<{ url: string | null; error: string | null }> {
  const invalid = validateImageFile(originalFile)
  if (invalid) return { url: null, error: invalid }
  const file = await compressImage(originalFile)
  const unusable = checkPreparedImage(file)
  if (unusable) return { url: null, error: unusable }
  const extension = file.name.split('.').pop() ?? 'jpg'
  const path = `${uid}/city/${Date.now()}.${extension}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: false, cacheControl: UPLOAD_CACHE_CONTROL })
  if (error) return { url: null, error: 'Não foi possível enviar a foto agora.' }
  return { url: supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl, error: null }
}

/** Quem confirmou "Quero ir" (só primeiro nome) — só a criadora do convite e a administração. */
export async function fetchAttendees(listingId: string): Promise<{ nome: string; avatar: string | null }[]> {
  const { data, error } = await supabase.rpc('city_meetup_attendees', { p_listing: listingId })
  return error ? [] : ((data ?? []) as { nome: string; avatar: string | null }[])
}
