import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { checkPreparedImage, compressImage, UPLOAD_CACHE_CONTROL, validateImageFile } from '../lib/imageUpload'
import { cityErrorMessage } from '../lib/city'
import { FALLBACK_GROUPS } from '../lib/city'
import type { CityCategory, CityGroup, CityInfo, CityListing, CityReview, CityTag } from '../lib/city'

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
      supabase.from('city_categories').select('id, nome, nome_normalizado, grupo, status, unida_a, descricao, imagem, grupo_sugerido').order('nome'),
      supabase.from('city_tags').select('id, nome, tipo').order('nome'),
    ])
    if (!cats.error) setCategories((cats.data ?? []) as CityCategory[])
    if (!tgs.error) setTags((tgs.data ?? []) as CityTag[])
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      supabase.from('city_categories').select('id, nome, nome_normalizado, grupo, status, unida_a, descricao, imagem, grupo_sugerido').order('nome'),
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
    async (nome: string, grupo: string, grupoSugerido?: string): Promise<{ error: string | null; id: string | null; existing: boolean }> => {
      const { data, error } = await supabase.rpc('create_city_category', { p_nome: nome, p_grupo: grupo, p_grupo_sugerido: grupoSugerido?.trim() || null })
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
  horarios: Record<string, string> | null
  foto: string | null
  logo: string | null
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

// ---- Avaliações (estrelas e comentários) ------------------------------------------
export async function fetchReviews(listingId: string): Promise<CityReview[]> {
  const { data, error } = await supabase.rpc('city_reviews_list', { p_listing: listingId })
  return error ? [] : ((data ?? []) as CityReview[])
}

export async function saveReview(listingId: string, nota: number, comentario: string): Promise<Result> {
  const { error } = await supabase.rpc('city_review_set', { p_listing: listingId, p_nota: nota, p_comentario: comentario.trim() || null })
  return { error: error ? cityErrorMessage(error.message) : null }
}

export async function deleteReview(listingId: string): Promise<Result> {
  const { error } = await supabase.rpc('city_review_delete', { p_listing: listingId })
  return { error: error ? 'Não foi possível apagar agora.' : null }
}

export async function adminDeleteReview(listingId: string, userId: string): Promise<Result> {
  const { error } = await supabase.rpc('city_review_admin_delete', { p_listing: listingId, p_user: userId })
  return { error: error ? 'Não foi possível apagar agora.' : null }
}

// ---- Imagens dos grupos de categorias (cadastradas pela administração) ---------------
export function useGroupImages() {
  const [images, setImages] = useState<Record<string, string>>({})
  const reload = useCallback(async () => {
    const { data } = await supabase.from('city_group_images').select('grupo, image_url')
    const map: Record<string, string> = {}
    for (const r of (data ?? []) as { grupo: string; image_url: string }[]) map[r.grupo] = r.image_url
    setImages(map)
  }, [])
  useEffect(() => {
    let cancelled = false
    void supabase
      .from('city_group_images')
      .select('grupo, image_url')
      .then(({ data }) => {
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const r of (data ?? []) as { grupo: string; image_url: string }[]) map[r.grupo] = r.image_url
        setImages(map)
      })
    return () => {
      cancelled = true
    }
  }, [])
  return { images, reload }
}

export async function setGroupImage(grupo: string, url: string | null): Promise<Result> {
  const { error } = url
    ? await supabase.from('city_group_images').upsert({ grupo, image_url: url, atualizado_em: new Date().toISOString() })
    : await supabase.from('city_group_images').delete().eq('grupo', grupo)
  return { error: error ? 'Não foi possível salvar a imagem agora.' : null }
}

// ---- Reivindicar o negócio e destaque pago da capa -------------------------------------
export async function createClaim(listingId: string, whatsapp: string, mensagem: string): Promise<Result> {
  const { error } = await supabase.rpc('city_claim_create', { p_listing: listingId, p_whatsapp: whatsapp, p_mensagem: mensagem.trim() || null })
  return { error: error ? cityErrorMessage(error.message) : null }
}

async function functionError(error: unknown, fallback: string): Promise<{ message: string; code?: string }> {
  let message = fallback
  let code: string | undefined
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const parsed = (await ctx.json()) as { error?: string; code?: string }
      if (typeof parsed?.error === 'string') message = parsed.error
      if (typeof parsed?.code === 'string') code = parsed.code
    } catch {
      /* mantém a mensagem genérica */
    }
  }
  return { message, code }
}

const API_CYCLE = { monthly: 'MONTHLY', semiannual: 'SEMIANNUALLY', annual: 'YEARLY' } as const

/** Contrata o destaque da capa (só a dona aprovada). Devolve o link da fatura do Asaas. */
export async function subscribeHighlight(listingId: string, cycle: keyof typeof API_CYCLE): Promise<{ error: string | null; code?: string; invoiceUrl: string | null }> {
  const { data, error } = await supabase.functions.invoke('asaas-create-highlight-subscription', {
    body: { listing_id: listingId, billing_cycle: API_CYCLE[cycle] },
  })
  if (error) {
    const f = await functionError(error, 'Não foi possível assinar agora. Tente novamente em instantes.')
    return { error: f.message, code: f.code, invoiceUrl: null }
  }
  return { error: null, invoiceUrl: (data?.invoiceUrl as string | undefined) ?? null }
}

export async function cancelHighlight(highlightId: string): Promise<Result> {
  const { error } = await supabase.functions.invoke('asaas-cancel-highlight', { body: { highlight_id: highlightId } })
  if (error) return { error: (await functionError(error, 'Não foi possível cancelar agora. Tente novamente.')).message }
  return { error: null }
}

/** O CPF/CNPJ de cobrança já está cadastrado? (necessário para assinar) */
export async function hasBillingData(): Promise<boolean> {
  const { data } = await supabase.from('billing_customer_data').select('id').maybeSingle()
  return !!data
}

export async function saveBillingData(documentType: 'CPF' | 'CNPJ', documentNumber: string): Promise<Result> {
  const digits = documentNumber.replace(/\D/g, '')
  if (digits.length !== (documentType === 'CPF' ? 11 : 14)) return { error: `${documentType} deve ter ${documentType === 'CPF' ? 11 : 14} dígitos.` }
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return { error: 'Sem sessão ativa.' }
  const { error } = await supabase
    .from('billing_customer_data')
    .upsert({ profile_id: u.user.id, document_type: documentType, document_number: digits }, { onConflict: 'profile_id' })
  return { error: error ? 'Não foi possível salvar os dados agora.' : null }
}

// ---- Grupos de categorias (a profissional cria e edita) ---------------------------
export function useCityGroups() {
  const [groups, setGroups] = useState<CityGroup[]>(FALLBACK_GROUPS)

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('city_groups').select('slug, nome, icone, descricao, imagem, ordem').order('ordem').order('nome')
    if (!error && data && data.length > 0) setGroups(data as CityGroup[])
  }, [])

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('city_groups')
      .select('slug, nome, icone, descricao, imagem, ordem')
      .order('ordem')
      .order('nome')
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error && data && data.length > 0) setGroups(data as CityGroup[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { groups, reload }
}

export async function saveGroup(g: { slug?: string | null; nome: string; icone?: string | null; descricao?: string | null; imagem?: string | null }): Promise<Result & { slug: string | null }> {
  const { data, error } = await supabase.rpc('city_group_save', {
    p_slug: g.slug ?? null,
    p_nome: g.nome,
    p_icone: g.icone ?? null,
    p_descricao: g.descricao ?? null,
    p_imagem: g.imagem ?? null,
  })
  return { error: error ? cityErrorMessage(error.message) : null, slug: typeof data === 'string' ? data : null }
}

export async function deleteGroup(slug: string): Promise<Result> {
  const { error } = await supabase.rpc('city_group_delete', { p_slug: slug })
  if (error?.message?.includes('grupo_com_categorias')) return { error: 'Este grupo ainda tem categorias. Mova ou remova as categorias primeiro.' }
  return { error: error ? cityErrorMessage(error.message) : null }
}

export async function saveCategory(c: { id?: string | null; nome: string; grupo: string; descricao?: string | null; imagem?: string | null }): Promise<Result> {
  const { error } = await supabase.rpc('city_category_save', {
    p_id: c.id ?? null,
    p_nome: c.nome,
    p_grupo: c.grupo,
    p_descricao: c.descricao ?? null,
    p_imagem: c.imagem ?? null,
  })
  if (error?.message?.includes('categoria_ja_existe')) return { error: 'Já existe uma categoria com esse nome neste grupo.' }
  return { error: error ? cityErrorMessage(error.message) : null }
}

// ---- Bolinhas vermelhas do card "Na minha cidade" ----------------------------------------
const citySeenKey = (uid: string) => `circula:city-seen:${uid}`

export interface CityPendingCounts {
  claims: number
  categorias: number
  denuncias: number
  feedback?: number
}

/** Profissional: pedidos de reivindicação, de categoria e denúncias aguardando. Membro: cadastros novos na cidade desde a última visita. */
export function useCityBadge(uid: string | null, isAdmin: boolean, hasCity: boolean) {
  const [admin, setAdmin] = useState<CityPendingCounts>({ claims: 0, categorias: 0, denuncias: 0 })
  const [novos, setNovos] = useState(0)

  const reload = useCallback(async () => {
    if (!uid) return
    if (isAdmin) {
      const { data } = await supabase.rpc('city_pending_counts')
      if (data) setAdmin(data as CityPendingCounts)
      return
    }
    if (!hasCity) return
    let since = '1970-01-01T00:00:00.000Z'
    try {
      since = localStorage.getItem(citySeenKey(uid)) ?? since
    } catch {
      /* sem storage */
    }
    // primeira visita ao app: não enche de bolinhas por cadastros antigos
    if (since === '1970-01-01T00:00:00.000Z') since = new Date().toISOString()
    try {
      if (!localStorage.getItem(citySeenKey(uid))) localStorage.setItem(citySeenKey(uid), since)
    } catch {
      /* ignore */
    }
    const { data } = await supabase.rpc('city_new_count', { p_since: since })
    setNovos(typeof data === 'number' ? data : 0)
  }, [uid, isAdmin, hasCity])

  useEffect(() => {
    void reload()
  }, [reload])

  const markSeen = useCallback(() => {
    if (!uid) return
    try {
      localStorage.setItem(citySeenKey(uid), new Date().toISOString())
    } catch {
      /* ignore */
    }
    setNovos(0)
  }, [uid])

  const total = isAdmin ? admin.claims + admin.categorias + admin.denuncias : novos
  return { total, admin, novos, markSeen, reload }
}
