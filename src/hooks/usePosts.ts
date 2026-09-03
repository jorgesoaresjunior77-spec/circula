import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildCommentTree } from '../lib/commentTree'
import type {
  Comment,
  CreateCommentResult,
  CreatePostResult,
  Post,
  ToggleReactionResult,
} from '../types/post'

const POST_SELECT =
  'id,community_id,circle_id,author_id,content,image_url,created_at,post_type,question_id,title,engagement_command_id,author:profiles(id,full_name,avatar_url)'

const COMMENT_SELECT =
  'id,post_id,author_id,content,created_at,parent_comment_id,author:profiles(id,full_name,avatar_url)'

/** Quantos comentários-raiz aparecem no card antes de "Ver mais comentários". */
const PREVIEW_COMMENTS = 3

interface UsePostsOptions {
  /**
   * Quando definido, o feed pagina de `pageSize` em `pageSize` (Feed).
   * Sem isso, traz todos os posts do escopo — comportamento usado pela
   * Home, que garimpa a pergunta/comando do dia na lista completa.
   */
  pageSize?: number
  /**
   * Quando true, além das contagens o hook busca EM LOTE (uma consulta
   * por página, nunca por post) os comentários de preview e as
   * contagens de resposta por comentário — para o Feed de Conversa.
   */
  inlineConversation?: boolean
}

export function usePosts(
  communityId: string | null,
  viewerId: string | null,
  refreshToken?: number,
  // Escopo opcional: quando definido, o feed é de um círculo — busca
  // só posts daquele círculo e novos posts recebem esse circle_id.
  // Sem circleId => feed da comunidade (posts com circle_id null),
  // comportamento idêntico ao anterior.
  circleId?: string | null,
  options?: UsePostsOptions,
) {
  const pageSize = options?.pageSize ?? null
  const inlineConversation = options?.inlineConversation ?? false

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({})
  const [reactedPostIds, setReactedPostIds] = useState<Set<string>>(new Set())
  // commentCounts = TOTAL de comentários (raízes + respostas) — número
  // mostrado no botão 💬. topLevelCounts = só as raízes — usado para o
  // "(N)" de "Ver mais comentários".
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [topLevelCounts, setTopLevelCounts] = useState<Record<string, number>>({})
  const [replyCountByComment, setReplyCountByComment] = useState<Record<string, number>>({})
  const [previewCommentsByPost, setPreviewCommentsByPost] = useState<Record<string, Comment[]>>({})
  // Árvore completa de um post (raízes com `replies`), carregada sob
  // demanda ao clicar em "Ver mais comentários" / responder.
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({})

  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const pageRef = useRef(0)

  const fetchEngagement = useCallback(
    async (postIds: string[], mode: 'replace' | 'append') => {
      if (postIds.length === 0) {
        if (mode === 'replace') {
          setReactionCounts({})
          setReactedPostIds(new Set())
          setCommentCounts({})
          setTopLevelCounts({})
          setReplyCountByComment({})
          setPreviewCommentsByPost({})
        }
        return
      }

      const [reactionsResult, metaResult] = await Promise.all([
        supabase.from('post_reactions').select('post_id, profile_id').in('post_id', postIds),
        supabase
          .from('post_comments')
          .select('post_id, parent_comment_id')
          .in('post_id', postIds),
      ])

      const rCounts: Record<string, number> = {}
      const reacted = new Set<string>()
      for (const row of (reactionsResult.data ?? []) as {
        post_id: string
        profile_id: string
      }[]) {
        rCounts[row.post_id] = (rCounts[row.post_id] ?? 0) + 1
        if (viewerId && row.profile_id === viewerId) reacted.add(row.post_id)
      }

      const cCounts: Record<string, number> = {}
      const tlCounts: Record<string, number> = {}
      const rcByComment: Record<string, number> = {}
      for (const row of (metaResult.data ?? []) as {
        post_id: string
        parent_comment_id: string | null
      }[]) {
        cCounts[row.post_id] = (cCounts[row.post_id] ?? 0) + 1
        if (row.parent_comment_id) {
          rcByComment[row.parent_comment_id] = (rcByComment[row.parent_comment_id] ?? 0) + 1
        } else {
          tlCounts[row.post_id] = (tlCounts[row.post_id] ?? 0) + 1
        }
      }
      // zera explicitamente os posts sem comentário, para o merge do
      // "append" não deixar buracos e o "Ver mais" sumir corretamente.
      for (const id of postIds) {
        cCounts[id] = cCounts[id] ?? 0
        tlCounts[id] = tlCounts[id] ?? 0
      }

      let previews: Record<string, Comment[]> = {}
      if (inlineConversation) {
        const { data: previewRows } = await supabase
          .from('post_comments')
          .select(COMMENT_SELECT)
          .in('post_id', postIds)
          .is('parent_comment_id', null)
          .order('created_at', { ascending: false })

        const grouped: Record<string, Comment[]> = {}
        for (const row of (previewRows as unknown as Comment[] | null) ?? []) {
          const bucket = grouped[row.post_id] ?? (grouped[row.post_id] = [])
          if (bucket.length < PREVIEW_COMMENTS) bucket.push(row)
        }
        previews = {}
        for (const id of postIds) previews[id] = (grouped[id] ?? []).slice().reverse()
      }

      if (mode === 'replace') {
        setReactionCounts(rCounts)
        setReactedPostIds(reacted)
        setCommentCounts(cCounts)
        setTopLevelCounts(tlCounts)
        setReplyCountByComment(rcByComment)
        if (inlineConversation) setPreviewCommentsByPost(previews)
      } else {
        setReactionCounts((prev) => ({ ...prev, ...rCounts }))
        setReactedPostIds((prev) => {
          const next = new Set(prev)
          for (const id of reacted) next.add(id)
          return next
        })
        setCommentCounts((prev) => ({ ...prev, ...cCounts }))
        setTopLevelCounts((prev) => ({ ...prev, ...tlCounts }))
        setReplyCountByComment((prev) => ({ ...prev, ...rcByComment }))
        if (inlineConversation) setPreviewCommentsByPost((prev) => ({ ...prev, ...previews }))
      }
    },
    [viewerId, inlineConversation],
  )

  const buildScopedQuery = useCallback(() => {
    let query = supabase.from('posts').select(POST_SELECT).eq('community_id', communityId)
    query = circleId ? query.eq('circle_id', circleId) : query.is('circle_id', null)
    return query.order('created_at', { ascending: false })
  }, [communityId, circleId])

  const fetchPosts = useCallback(async () => {
    if (!communityId) {
      setPosts([])
      setReactionCounts({})
      setReactedPostIds(new Set())
      setCommentCounts({})
      setTopLevelCounts({})
      setReplyCountByComment({})
      setPreviewCommentsByPost({})
      setCommentsByPost({})
      setHasMore(false)
      pageRef.current = 0
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    pageRef.current = 0

    let query = buildScopedQuery()
    if (pageSize) query = query.range(0, pageSize - 1)

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      setPosts([])
      setHasMore(false)
      setLoading(false)
      return
    }

    const list = (data as unknown as Post[] | null) ?? []
    setPosts(list)
    setCommentsByPost({}) // descarta árvores expandidas ao recarregar o feed
    setHasMore(pageSize ? list.length === pageSize : false)
    await fetchEngagement(
      list.map((post) => post.id),
      'replace',
    )

    setLoading(false)
  }, [communityId, pageSize, buildScopedQuery, fetchEngagement])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts, refreshToken])

  const loadMore = useCallback(async () => {
    if (!communityId || !pageSize || loadingMore || !hasMore) return

    setLoadingMore(true)
    const nextPage = pageRef.current + 1
    const from = nextPage * pageSize
    const to = from + pageSize - 1

    const { data, error: fetchError } = await buildScopedQuery().range(from, to)

    if (fetchError) {
      setLoadingMore(false)
      return
    }

    const more = (data as unknown as Post[] | null) ?? []
    pageRef.current = nextPage
    setPosts((prev) => {
      const seen = new Set(prev.map((p) => p.id))
      return [...prev, ...more.filter((p) => !seen.has(p.id))]
    })
    setHasMore(more.length === pageSize)
    await fetchEngagement(
      more.map((post) => post.id),
      'append',
    )
    setLoadingMore(false)
  }, [communityId, pageSize, hasMore, loadingMore, buildScopedQuery, fetchEngagement])

  async function createPost(
    authorId: string,
    content: string,
    imageUrl?: string | null,
  ): Promise<CreatePostResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: insertError } = await supabase.from('posts').insert({
      community_id: communityId,
      circle_id: circleId ?? null,
      author_id: authorId,
      content,
      image_url: imageUrl ?? null,
    })

    if (insertError) {
      return { error: insertError.message }
    }

    await fetchPosts()
    return { error: null }
  }

  // Upload de UMA imagem para o post, reaproveitando o bucket "avatars"
  // já existente (path por uid — a policy de insert do bucket autoriza
  // exatamente ${uid}/...). Mesmo padrão de useAuth.uploadAvatar.
  async function uploadPostImage(
    file: File,
  ): Promise<{ url: string | null; error: string | null }> {
    if (!viewerId) return { url: null, error: 'Sem sessão ativa.' }

    const extension = file.name.split('.').pop() ?? 'jpg'
    const path = `${viewerId}/posts/${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: false })

    if (uploadError) return { url: null, error: uploadError.message }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return { url: data.publicUrl, error: null }
  }

  // Carrega a conversa INTEIRA de um post em UMA consulta e monta a
  // árvore rasa (raízes com `replies`) no cliente — nunca uma consulta
  // por comentário.
  async function fetchComments(postId: string): Promise<CreateCommentResult> {
    const { data, error: fetchError } = await supabase
      .from('post_comments')
      .select(COMMENT_SELECT)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (fetchError) {
      return { error: fetchError.message }
    }

    const flat = (data as unknown as Comment[]) ?? []
    const tree = buildCommentTree(flat)
    setCommentsByPost((prev) => ({ ...prev, [postId]: tree }))

    // mantém as contagens coerentes com o que acabou de chegar
    setCommentCounts((prev) => ({ ...prev, [postId]: flat.length }))
    setTopLevelCounts((prev) => ({ ...prev, [postId]: tree.length }))
    const rc: Record<string, number> = {}
    for (const root of tree) rc[root.id] = root.reply_count ?? 0
    setReplyCountByComment((prev) => ({ ...prev, ...rc }))

    return { error: null }
  }

  async function addComment(
    postId: string,
    authorId: string,
    content: string,
    parentCommentId: string | null = null,
  ): Promise<CreateCommentResult> {
    const { error: insertError } = await supabase.from('post_comments').insert({
      post_id: postId,
      author_id: authorId,
      content,
      parent_comment_id: parentCommentId,
    })

    if (insertError) {
      return { error: insertError.message }
    }

    setCommentCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }))
    if (!parentCommentId) {
      setTopLevelCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }))
    }
    // recarrega a árvore desse post (1 consulta) — cobre comentário-raiz
    // e resposta, e deixa o card em modo "expandido".
    await fetchComments(postId)
    return { error: null }
  }

  async function toggleReaction(postId: string, profileId: string): Promise<ToggleReactionResult> {
    const hasReacted = reactedPostIds.has(postId)

    if (hasReacted) {
      const { error: deleteError } = await supabase
        .from('post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('profile_id', profileId)

      if (deleteError) return { error: deleteError.message }

      setReactedPostIds((prev) => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
      setReactionCounts((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] ?? 1) - 1) }))
      return { error: null }
    }

    const { error: insertError } = await supabase.from('post_reactions').insert({
      post_id: postId,
      profile_id: profileId,
    })

    if (insertError) return { error: insertError.message }

    setReactedPostIds((prev) => new Set(prev).add(postId))
    setReactionCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }))
    return { error: null }
  }

  return {
    posts,
    loading,
    error,
    createPost,
    uploadPostImage,
    reactionCounts,
    reactedPostIds,
    commentCounts,
    topLevelCounts,
    replyCountByComment,
    commentsByPost,
    previewCommentsByPost,
    toggleReaction,
    fetchComments,
    addComment,
    hasMore,
    loadMore,
    loadingMore,
    refresh: fetchPosts,
  }
}
