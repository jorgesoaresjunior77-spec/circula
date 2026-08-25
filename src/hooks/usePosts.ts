import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Comment,
  CreateCommentResult,
  CreatePostResult,
  Post,
  ToggleReactionResult,
} from '../types/post'

const POST_SELECT =
  'id,community_id,author_id,content,created_at,post_type,question_id,title,engagement_command_id,author:profiles(id,full_name,avatar_url)'

const COMMENT_SELECT =
  'id,post_id,author_id,content,created_at,author:profiles(id,full_name,avatar_url)'

export function usePosts(
  communityId: string | null,
  viewerId: string | null,
  refreshToken?: number,
) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({})
  const [reactedPostIds, setReactedPostIds] = useState<Set<string>>(new Set())
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({})

  const fetchEngagement = useCallback(async (postIds: string[]) => {
    if (postIds.length === 0) {
      setReactionCounts({})
      setReactedPostIds(new Set())
      setCommentCounts({})
      return
    }

    const [reactionsResult, commentsResult] = await Promise.all([
      supabase.from('post_reactions').select('post_id, profile_id').in('post_id', postIds),
      supabase.from('post_comments').select('post_id').in('post_id', postIds),
    ])

    const rCounts: Record<string, number> = {}
    const reacted = new Set<string>()
    for (const row of reactionsResult.data ?? []) {
      rCounts[row.post_id] = (rCounts[row.post_id] ?? 0) + 1
      if (viewerId && row.profile_id === viewerId) reacted.add(row.post_id)
    }

    const cCounts: Record<string, number> = {}
    for (const row of commentsResult.data ?? []) {
      cCounts[row.post_id] = (cCounts[row.post_id] ?? 0) + 1
    }

    setReactionCounts(rCounts)
    setReactedPostIds(reacted)
    setCommentCounts(cCounts)
  }, [viewerId])

  const fetchPosts = useCallback(async () => {
    if (!communityId) {
      setPosts([])
      setReactionCounts({})
      setReactedPostIds(new Set())
      setCommentCounts({})
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setPosts([])
      setLoading(false)
      return
    }

    const list = (data as unknown as Post[] | null) ?? []
    setPosts(list)
    await fetchEngagement(list.map((post) => post.id))

    setLoading(false)
  }, [communityId, fetchEngagement])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts, refreshToken])

  async function createPost(authorId: string, content: string): Promise<CreatePostResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: insertError } = await supabase.from('posts').insert({
      community_id: communityId,
      author_id: authorId,
      content,
    })

    if (insertError) {
      return { error: insertError.message }
    }

    await fetchPosts()
    return { error: null }
  }

  async function fetchComments(postId: string): Promise<CreateCommentResult> {
    const { data, error: fetchError } = await supabase
      .from('post_comments')
      .select(COMMENT_SELECT)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (fetchError) {
      return { error: fetchError.message }
    }

    setCommentsByPost((prev) => ({ ...prev, [postId]: (data as unknown as Comment[]) ?? [] }))
    return { error: null }
  }

  async function addComment(
    postId: string,
    authorId: string,
    content: string,
  ): Promise<CreateCommentResult> {
    const { error: insertError } = await supabase.from('post_comments').insert({
      post_id: postId,
      author_id: authorId,
      content,
    })

    if (insertError) {
      return { error: insertError.message }
    }

    setCommentCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }))
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
    reactionCounts,
    reactedPostIds,
    commentCounts,
    commentsByPost,
    toggleReaction,
    fetchComments,
    addComment,
    refresh: fetchPosts,
  }
}
