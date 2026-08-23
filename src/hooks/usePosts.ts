import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CreatePostResult, Post } from '../types/post'

const POST_SELECT =
  'id,community_id,author_id,content,created_at,author:profiles(id,full_name,avatar_url)'

export function usePosts(communityId: string | null) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    if (!communityId) {
      setPosts([])
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
    } else {
      setPosts((data as unknown as Post[] | null) ?? [])
    }

    setLoading(false)
  }, [communityId])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

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

  return { posts, loading, error, createPost, refresh: fetchPosts }
}
