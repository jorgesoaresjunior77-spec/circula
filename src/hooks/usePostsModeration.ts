import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ModeratePostAction, ModeratePostResult, ModerationPost } from '../types/panel'

// Fase 8 — moderação de publicações da PRÓPRIA comunidade.
//
// Separada da leitura normal do Feed (Feed.tsx / usePosts.ts NÃO são
// tocados). A listagem vem da RPC `community_posts_moderation` (traz
// inclusive os posts ocultos, só para a dona/Master); as ações passam
// pela RPC `moderate_post` — nunca DELETE direto pelo cliente.
//
// usePostsModeration(null) não busca.

function mapError(message: string): string {
  if (message.includes('not_authorized')) return 'Você não administra esta comunidade.'
  if (message.includes('post_not_found')) return 'Esta publicação não existe mais.'
  if (message.includes('acao invalida')) return 'Ação de moderação inválida.'
  return 'Não foi possível concluir a ação agora. Tente novamente.'
}

export function usePostsModeration(communityId: string | null) {
  const [posts, setPosts] = useState<ModerationPost[]>([])
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

    const { data, error: fetchError } = await supabase.rpc('community_posts_moderation', {
      p_community_id: communityId,
    })

    if (fetchError) {
      setError(fetchError.message)
      setPosts([])
      setLoading(false)
      return
    }

    setPosts((data as ModerationPost[] | null) ?? [])
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  async function moderate(postId: string, action: ModeratePostAction): Promise<ModeratePostResult> {
    const { error: rpcError } = await supabase.rpc('moderate_post', {
      p_post_id: postId,
      p_action: action,
    })

    if (rpcError) return { error: mapError(rpcError.message) }

    if (action === 'remove') {
      setPosts((prev) => prev.filter((post) => post.id !== postId))
    } else {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, hidden_at: action === 'hide' ? new Date().toISOString() : null }
            : post,
        ),
      )
    }
    return { error: null }
  }

  return { posts, loading, error, moderate, refresh: fetchPosts }
}
