import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildCommentTree } from '../lib/commentTree'
import type { CommunityContent } from '../types/content'
import type { Post, Comment } from '../types/post'
import type { EventWithParticipants } from '../types/event'
import type { SavedItemRow, SavedItemType, ToggleSaveResult } from '../types/saved'

// Módulo 7 — SALVOS.
//
// `saved_items` é polimórfica (item_type + item_id). Este hook busca as
// linhas da própria usuária e, para cada tipo com pelo menos 1 item,
// busca os itens de verdade em UM select por tipo — os mesmos formatos
// de SELECT que useContent/usePosts/useEvents já usam (para os cards
// existentes renderizarem sem adaptação). A RLS de cada tabela-alvo
// filtra sozinha o que não é mais visível (ex.: conteúdo despublicado
// depois de salvo) — o item some da lista, sem erro.
//
// Único dado extra que não vem embutido no SELECT: contagem de reações
// e comentários dos posts salvos (post_reactions/post_comments não são
// aninhadas em `posts` do jeito que content_likes/event_participants
// são). Sem isso os cards mostrariam "0" mesmo havendo reação/comentário
// real — por isso o fetch extra, só leitura, mesmo formato de
// usePosts.fetchEngagement.
//
// useSavedItems(null) não faz fetch (Master não tem Salvos).

const PERSON_SELECT = 'id,full_name,avatar_url'

const CONTENT_SELECT =
  `id,community_id,circle_id,created_by,type,title,summary,body,cover_image_url,` +
  `external_url,category,status,created_at,updated_at,` +
  `author:profiles(${PERSON_SELECT}),` +
  `likes:content_likes(id,content_id,profile_id,created_at)`

const POST_SELECT =
  `id,community_id,circle_id,author_id,content,image_url,created_at,post_type,` +
  `question_id,title,engagement_command_id,author:profiles(${PERSON_SELECT})`

const EVENT_SELECT =
  `id,community_id,circle_id,created_by,title,description,cover_image_url,` +
  `starts_at,ends_at,is_online,location,online_url,capacity,status,created_at,updated_at,` +
  `participants:event_participants(id,event_id,profile_id,joined_at,profile:profiles(${PERSON_SELECT}))`

const COMMENT_SELECT = `id,post_id,author_id,content,created_at,parent_comment_id,author:profiles(${PERSON_SELECT})`

function idsOf(rows: SavedItemRow[], type: SavedItemType): string[] {
  return rows.filter((r) => r.item_type === type).map((r) => r.item_id)
}

export function useSavedItems(profileId: string | null) {
  const [rows, setRows] = useState<SavedItemRow[]>([])
  const [contentItems, setContentItems] = useState<CommunityContent[]>([])
  const [postItems, setPostItems] = useState<Post[]>([])
  const [eventItems, setEventItems] = useState<EventWithParticipants[]>([])

  const [postReactionCounts, setPostReactionCounts] = useState<Record<string, number>>({})
  const [postReactedIds, setPostReactedIds] = useState<Set<string>>(new Set())
  const [postCommentCounts, setPostCommentCounts] = useState<Record<string, number>>({})
  const [postCommentsByPost, setPostCommentsByPost] = useState<Record<string, Comment[]>>({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!profileId) {
      setRows([])
      setContentItems([])
      setPostItems([])
      setEventItems([])
      setPostReactionCounts({})
      setPostReactedIds(new Set())
      setPostCommentCounts({})
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data: rowsData, error: rowsError } = await supabase
      .from('saved_items')
      .select('id,profile_id,item_type,item_id,created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })

    if (rowsError) {
      setError(rowsError.message)
      setRows([])
      setContentItems([])
      setPostItems([])
      setEventItems([])
      setLoading(false)
      return
    }

    const list = (rowsData as SavedItemRow[] | null) ?? []
    setRows(list)

    const contentIds = idsOf(list, 'content')
    const postIds = idsOf(list, 'post')
    const eventIds = idsOf(list, 'event')

    const [contentRes, postRes, eventRes] = await Promise.all([
      contentIds.length
        ? supabase.from('community_content').select(CONTENT_SELECT).in('id', contentIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length
        ? supabase.from('posts').select(POST_SELECT).in('id', postIds)
        : Promise.resolve({ data: [], error: null }),
      eventIds.length
        ? supabase.from('community_events').select(EVENT_SELECT).in('id', eventIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    // Tolerância por fonte: uma consulta que falhe só esvazia o próprio
    // grupo, não derruba a tela inteira.
    setContentItems(
      contentRes.error ? [] : ((contentRes.data as unknown as CommunityContent[]) ?? []),
    )
    setEventItems(
      eventRes.error ? [] : ((eventRes.data as unknown as EventWithParticipants[]) ?? []),
    )
    const posts = postRes.error ? [] : ((postRes.data as unknown as Post[]) ?? [])
    setPostItems(posts)

    if (posts.length > 0) {
      const postIdsFetched = posts.map((p) => p.id)
      const [reactionsRes, commentsRes] = await Promise.all([
        supabase.from('post_reactions').select('post_id, profile_id').in('post_id', postIdsFetched),
        supabase.from('post_comments').select('post_id').in('post_id', postIdsFetched),
      ])

      const rCounts: Record<string, number> = {}
      const reacted = new Set<string>()
      for (const row of reactionsRes.data ?? []) {
        rCounts[row.post_id] = (rCounts[row.post_id] ?? 0) + 1
        if (row.profile_id === profileId) reacted.add(row.post_id)
      }
      const cCounts: Record<string, number> = {}
      for (const row of commentsRes.data ?? []) {
        cCounts[row.post_id] = (cCounts[row.post_id] ?? 0) + 1
      }

      setPostReactionCounts(rCounts)
      setPostReactedIds(reacted)
      setPostCommentCounts(cCounts)
    } else {
      setPostReactionCounts({})
      setPostReactedIds(new Set())
      setPostCommentCounts({})
    }

    setLoading(false)
  }, [profileId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const savedContentIds = useMemo(() => new Set(idsOf(rows, 'content')), [rows])
  const savedPostIds = useMemo(() => new Set(idsOf(rows, 'post')), [rows])
  const savedEventIds = useMemo(() => new Set(idsOf(rows, 'event')), [rows])

  async function toggleSave(
    itemType: SavedItemType,
    itemId: string,
    currentlySaved: boolean,
  ): Promise<ToggleSaveResult> {
    if (!profileId) return { error: 'Sem sessão ativa.' }

    if (currentlySaved) {
      const { error: deleteError } = await supabase
        .from('saved_items')
        .delete()
        .eq('profile_id', profileId)
        .eq('item_type', itemType)
        .eq('item_id', itemId)

      if (deleteError) return { error: deleteError.message }
    } else {
      const { error: insertError } = await supabase
        .from('saved_items')
        .insert({ profile_id: profileId, item_type: itemType, item_id: itemId })

      if (insertError && !insertError.message.includes('duplicate key')) {
        return { error: insertError.message }
      }
    }

    await fetchAll()
    return { error: null }
  }

  async function fetchPostComments(postId: string): Promise<ToggleSaveResult> {
    const { data, error: fetchError } = await supabase
      .from('post_comments')
      .select(COMMENT_SELECT)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (fetchError) return { error: fetchError.message }

    // mesma árvore rasa do Feed: respostas agrupadas sob o comentário-raiz
    setPostCommentsByPost((prev) => ({
      ...prev,
      [postId]: buildCommentTree((data as unknown as Comment[]) ?? []),
    }))
    return { error: null }
  }

  return {
    rows,
    contentItems,
    postItems,
    eventItems,
    savedContentIds,
    savedPostIds,
    savedEventIds,
    postReactionCounts,
    postReactedIds,
    postCommentCounts,
    postCommentsByPost,
    loading,
    error,
    toggleSave,
    fetchPostComments,
    refresh: fetchAll,
  }
}
