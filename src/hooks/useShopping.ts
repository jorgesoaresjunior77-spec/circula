import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { guessCategory, mergeIntoList } from '../lib/shopping'
import type { DraftItem, ListItem, ShoppingList } from '../lib/shopping'

// Minha Lista: listas, itens e compartilhamento. Tudo passa pela RLS: a dona
// vê e altera as dela; quem recebeu um compartilhamento vê (ou edita, se a
// dona permitiu) só aquela lista.

type Result = { error: string | null }
const FAIL = 'Não foi possível salvar agora. Tente novamente.'

const LIST_COLS = 'id,community_id,owner_id,name,description,planned_for,notes,status,source,created_at,completed_at'
const ITEM_COLS =
  'id,list_id,name,category,quantity,unit,est_price_cents,paid_price_cents,notes,bought,position,source_recipe_id,source_recipe_title'

export interface ListShare {
  id: string
  list_id: string
  profile_id: string
  permission: 'view' | 'edit'
  full_name?: string | null
}

export interface ListInput {
  name: string
  description?: string | null
  planned_for?: string | null
  notes?: string | null
  source?: ShoppingList['source']
}

function toRow(listId: string, d: DraftItem, position: number) {
  return {
    list_id: listId,
    name: d.name.trim(),
    category: d.category,
    quantity: d.quantity,
    unit: d.unit,
    notes: d.notes,
    position,
    source_recipe_id: d.source_recipe_id ?? null,
    source_recipe_title: d.source_recipe_title ?? null,
  }
}

export function useShopping(communityId: string | null, profileId: string | null) {
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [items, setItems] = useState<Record<string, ListItem[]>>({})
  const [loading, setLoading] = useState(!!communityId)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(0)
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    if (!communityId || !profileId) return
    let cancelled = false
    void (async () => {
      const l = await supabase
        .from('shopping_lists')
        .select(LIST_COLS)
        .eq('community_id', communityId)
        .order('created_at', { ascending: false })
        .limit(500)
      if (cancelled) return
      if (l.error) {
        setError('Não foi possível carregar suas listas agora.')
        setLoading(false)
        return
      }
      const rows = (l.data as ShoppingList[] | null) ?? []
      const ids = rows.map((r) => r.id)
      const map: Record<string, ListItem[]> = Object.fromEntries(ids.map((id) => [id, []]))
      if (ids.length > 0) {
        const it = await supabase.from('shopping_list_items').select(ITEM_COLS).in('list_id', ids).order('position').limit(20000)
        if (cancelled) return
        for (const row of (it.data as unknown as ListItem[] | null) ?? []) {
          row.quantity = Number(row.quantity)
          map[row.list_id]?.push(row)
        }
      }
      setError(null)
      setLists(rows)
      setItems(map)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [communityId, profileId, token])

  const reload = useCallback(() => setToken((n) => n + 1), [])

  const createList = useCallback(
    async (input: ListInput, drafts: DraftItem[] = [], recipes: { id: string; portions: number }[] = []): Promise<Result & { id?: string }> => {
      if (!communityId) return { error: 'Sem comunidade selecionada.' }
      const { data, error: e } = await supabase
        .from('shopping_lists')
        .insert({
          community_id: communityId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          planned_for: input.planned_for || null,
          notes: input.notes?.trim() || null,
          source: input.source ?? 'manual',
        })
        .select('id')
        .single()
      if (e || !data) return { error: FAIL }
      const id = (data as { id: string }).id
      if (drafts.length > 0) {
        const ins = await supabase.from('shopping_list_items').insert(drafts.map((d, i) => toRow(id, d, i)))
        if (ins.error) return { error: FAIL, id }
      }
      if (recipes.length > 0) {
        await supabase.from('shopping_list_recipes').insert(recipes.map((r) => ({ list_id: id, recipe_id: r.id, portions: r.portions })))
      }
      reload()
      return { error: null, id }
    },
    [communityId, reload],
  )

  const updateList = useCallback(
    async (id: string, patch: Partial<Pick<ShoppingList, 'name' | 'description' | 'planned_for' | 'notes' | 'status'>>): Promise<Result> => {
      const row: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() }
      if (patch.status === 'concluida') row.completed_at = new Date().toISOString()
      if (patch.status === 'em_andamento') row.completed_at = null
      const { error: e } = await supabase.from('shopping_lists').update(row).eq('id', id)
      if (e) return { error: FAIL }
      setLists((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch, completed_at: (row.completed_at as string | null | undefined) ?? l.completed_at } : l)))
      return { error: null }
    },
    [],
  )

  const deleteList = useCallback(
    async (id: string): Promise<Result> => {
      const { error: e } = await supabase.from('shopping_lists').delete().eq('id', id)
      if (e) return { error: FAIL }
      setLists((cur) => cur.filter((l) => l.id !== id))
      return { error: null }
    },
    [],
  )

  /** Copia a lista (e os itens, todos como "não comprados", sem o preço pago). */
  const duplicateList = useCallback(
    async (list: ShoppingList): Promise<Result & { id?: string }> => {
      const source = itemsRef.current[list.id] ?? []
      const drafts: DraftItem[] = source.map((i) => ({
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        unit: i.unit,
        notes: i.notes,
        source_recipe_id: i.source_recipe_id,
        source_recipe_title: i.source_recipe_title,
      }))
      const r = await createList({ name: `${list.name} (cópia)`, description: list.description, notes: list.notes, source: 'duplicada' }, drafts)
      if (r.id && source.some((i) => i.est_price_cents != null)) {
        // mantém o preço estimado (útil para planejar de novo); o pago começa vazio
        const { data } = await supabase.from('shopping_list_items').select('id,name,unit').eq('list_id', r.id).order('position')
        const rows = (data as { id: string }[] | null) ?? []
        await Promise.all(
          rows.map((row, idx) =>
            source[idx]?.est_price_cents != null
              ? supabase.from('shopping_list_items').update({ est_price_cents: source[idx].est_price_cents }).eq('id', row.id)
              : Promise.resolve(),
          ),
        )
        reload()
      }
      return r
    },
    [createList, reload],
  )

  /** Atualiza um item na hora na tela e salva em seguida (salvamento automático). */
  const updateItem = useCallback(
    async (item: ListItem, patch: Partial<Pick<ListItem, 'name' | 'category' | 'quantity' | 'unit' | 'est_price_cents' | 'paid_price_cents' | 'notes' | 'bought'>>): Promise<Result> => {
      const full: Record<string, unknown> = { ...patch }
      if ('bought' in patch) full.bought_at = patch.bought ? new Date().toISOString() : null
      setItems((cur) => ({ ...cur, [item.list_id]: (cur[item.list_id] ?? []).map((i) => (i.id === item.id ? { ...i, ...patch } : i)) }))
      const { error: e } = await supabase.from('shopping_list_items').update(full).eq('id', item.id)
      if (e) {
        setItems((cur) => ({ ...cur, [item.list_id]: (cur[item.list_id] ?? []).map((i) => (i.id === item.id ? item : i)) }))
        return { error: FAIL }
      }
      return { error: null }
    },
    [],
  )

  const addItem = useCallback(
    async (listId: string, d: DraftItem & { est_price_cents?: number | null }): Promise<Result> => {
      const pos = (itemsRef.current[listId] ?? []).reduce((m, i) => Math.max(m, i.position), -1) + 1
      const { error: e } = await supabase.from('shopping_list_items').insert({ ...toRow(listId, d, pos), est_price_cents: d.est_price_cents ?? null })
      if (e) return { error: FAIL }
      reload()
      return { error: null }
    },
    [reload],
  )

  const removeItem = useCallback(
    async (item: ListItem): Promise<Result> => {
      const { error: e } = await supabase.from('shopping_list_items').delete().eq('id', item.id)
      if (e) return { error: FAIL }
      setItems((cur) => ({ ...cur, [item.list_id]: (cur[item.list_id] ?? []).filter((i) => i.id !== item.id) }))
      return { error: null }
    },
    [],
  )

  /** Importa ingredientes numa lista que já existe, somando o que for compatível. */
  const importDrafts = useCallback(
    async (listId: string, drafts: DraftItem[], recipes: { id: string; portions: number }[] = []): Promise<Result & { added: number; merged: number }> => {
      const existing = itemsRef.current[listId] ?? []
      const plan = mergeIntoList(existing, drafts)
      for (const u of plan.updates) {
        const { error: e } = await supabase
          .from('shopping_list_items')
          .update({ quantity: u.quantity, unit: u.unit, source_recipe_title: u.source_recipe_title })
          .eq('id', u.id)
        if (e) return { error: FAIL, added: 0, merged: 0 }
      }
      if (plan.inserts.length > 0) {
        const start = existing.reduce((m, i) => Math.max(m, i.position), -1) + 1
        const { error: e } = await supabase.from('shopping_list_items').insert(plan.inserts.map((d, i) => toRow(listId, d, start + i)))
        if (e) return { error: FAIL, added: 0, merged: plan.updates.length }
      }
      for (const r of recipes) {
        await supabase.from('shopping_list_recipes').upsert({ list_id: listId, recipe_id: r.id, portions: r.portions }, { onConflict: 'list_id,recipe_id' })
      }
      reload()
      return { error: null, added: plan.inserts.length, merged: plan.updates.length }
    },
    [reload],
  )

  // ------------------------------------------------------ compartilhamento
  const loadShares = useCallback(async (listId: string): Promise<ListShare[]> => {
    const { data } = await supabase
      .from('shopping_list_shares')
      .select('id,list_id,profile_id,permission,profile:profiles(full_name)')
      .eq('list_id', listId)
    return ((data as unknown as (ListShare & { profile: { full_name: string | null } | null })[] | null) ?? []).map((r) => ({
      id: r.id,
      list_id: r.list_id,
      profile_id: r.profile_id,
      permission: r.permission,
      full_name: r.profile?.full_name ?? null,
    }))
  }, [])

  const share = useCallback(async (listId: string, toProfile: string, permission: 'view' | 'edit'): Promise<Result> => {
    const { error: e } = await supabase
      .from('shopping_list_shares')
      .upsert({ list_id: listId, profile_id: toProfile, permission }, { onConflict: 'list_id,profile_id' })
    return { error: e ? 'Não foi possível compartilhar agora.' : null }
  }, [])

  const unshare = useCallback(async (shareId: string): Promise<Result> => {
    const { error: e } = await supabase.from('shopping_list_shares').delete().eq('id', shareId)
    return { error: e ? FAIL : null }
  }, [])

  /** Participantes da comunidade com quem dá para compartilhar. */
  const loadPeople = useCallback(async (): Promise<{ id: string; full_name: string | null }[]> => {
    if (!communityId) return []
    const { data } = await supabase
      .from('community_members')
      .select('profile:profiles(id,full_name)')
      .eq('community_id', communityId)
      .eq('status', 'active')
      .limit(1000)
    const rows = (data as unknown as { profile: { id: string; full_name: string | null } | null }[] | null) ?? []
    return rows
      .map((r) => r.profile)
      .filter((p): p is { id: string; full_name: string | null } => !!p && p.id !== profileId)
      .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'pt-BR'))
  }, [communityId, profileId])

  return {
    lists,
    items,
    loading,
    error,
    reload,
    createList,
    updateList,
    deleteList,
    duplicateList,
    updateItem,
    addItem,
    removeItem,
    importDrafts,
    loadShares,
    share,
    unshare,
    loadPeople,
  }
}

/**
 * Nutricionista: cria uma lista de compras a partir de um plano alimentar e a
 * compartilha com a paciente (que já é participante da comunidade). A lista é
 * da nutricionista; só os nomes e as quantidades do plano entram, nenhum dado
 * clínico, e a paciente recebe com permissão de editar para ir marcando.
 */
export async function createListFromPlan(input: {
  communityId: string
  name: string
  notes: string | null
  lines: { name: string; grams: number | null }[]
  shareWith: string | null
}): Promise<{ error: string | null; id?: string }> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .insert({ community_id: input.communityId, name: input.name.slice(0, 120), notes: input.notes, source: 'nutricionista' })
    .select('id')
    .single()
  if (error || !data) return { error: FAIL }
  const id = (data as { id: string }).id
  if (input.lines.length > 0) {
    const rows = input.lines.map((l, i) => ({
      list_id: id,
      name: l.name.slice(0, 160),
      category: guessCategory(l.name),
      quantity: l.grams ? l.grams : 1,
      unit: l.grams ? (l.grams >= 1000 ? 'kg' : 'g') : 'un',
      position: i,
    }))
    for (const r of rows) if (r.unit === 'kg') r.quantity = Math.round((r.quantity / 1000) * 1000) / 1000
    const ins = await supabase.from('shopping_list_items').insert(rows)
    if (ins.error) return { error: FAIL, id }
  }
  if (input.shareWith) {
    const sh = await supabase.from('shopping_list_shares').insert({ list_id: id, profile_id: input.shareWith, permission: 'edit' })
    if (sh.error) return { error: 'A lista foi criada, mas não foi possível compartilhar com a paciente.', id }
  }
  return { error: null, id }
}
