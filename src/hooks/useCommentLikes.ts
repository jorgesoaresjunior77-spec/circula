import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface CommentLikesApi {
  counts: Record<string, number>
  mine: Set<string>
  toggle: (commentId: string) => void
}

export const CommentLikesContext = createContext<CommentLikesApi | null>(null)
export const useCommentLikesContext = () => useContext(CommentLikesContext)

// Curtidas dos comentários visíveis de UM post: uma consulta só.
export function useCommentLikes(ids: string[], viewerId: string | null): CommentLikesApi {
  const key = ids.join(',')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [mine, setMine] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (ids.length === 0) return
    let active = true
    supabase
      .from('comment_likes')
      .select('comment_id,profile_id')
      .in('comment_id', ids)
      .then(({ data }) => {
        if (!active) return
        const c: Record<string, number> = {}
        const m = new Set<string>()
        for (const row of (data as { comment_id: string; profile_id: string }[] | null) ?? []) {
          c[row.comment_id] = (c[row.comment_id] ?? 0) + 1
          if (row.profile_id === viewerId) m.add(row.comment_id)
        }
        setCounts(c)
        setMine(m)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, viewerId])

  const toggle = useCallback(
    (commentId: string) => {
      if (!viewerId) return
      const liked = mine.has(commentId)
      setMine((prev) => {
        const next = new Set(prev)
        if (liked) next.delete(commentId)
        else next.add(commentId)
        return next
      })
      setCounts((prev) => ({ ...prev, [commentId]: Math.max(0, (prev[commentId] ?? 0) + (liked ? -1 : 1)) }))
      if (liked) {
        void supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('profile_id', viewerId)
      } else {
        void supabase.from('comment_likes').insert({ comment_id: commentId, profile_id: viewerId })
      }
    },
    [mine, viewerId],
  )

  return { counts, mine, toggle }
}
