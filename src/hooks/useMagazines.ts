import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MagazineIssue } from '../types/magazine'

// Edições da revista da comunidade, da mais nova para a mais antiga. A RLS
// decide o que cada papel enxerga (membro: só edições já lançadas).

const SELECT =
  'id,community_id,title,cover_path,release_date,pages:magazine_pages(id,issue_id,position,image_path)'

type Result = { error: string | null }

export function useMagazines(communityId: string | null) {
  const [issues, setIssues] = useState<MagazineIssue[]>([])
  const [loading, setLoading] = useState(!!communityId)

  const refresh = useCallback(async () => {
    if (!communityId) {
      setIssues([])
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('magazine_issues')
      .select(SELECT)
      .eq('community_id', communityId)
      .order('release_date', { ascending: false })
      .order('created_at', { ascending: false })

    const rows = ((data as unknown as MagazineIssue[] | null) ?? []).map((issue) => ({
      ...issue,
      pages: [...(issue.pages ?? [])].sort((a, b) => a.position - b.position),
    }))
    setIssues(rows)
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = useCallback(
    async (op: PromiseLike<{ error: { message: string } | null }>): Promise<Result> => {
      const { error } = await op
      if (error) return { error: error.message }
      await refresh()
      return { error: null }
    },
    [refresh],
  )

  const createIssue = useCallback(
    (input: { title: string; release_date: string; created_by: string }): Promise<Result> => {
      if (!communityId) return Promise.resolve({ error: 'Sem comunidade selecionada.' })
      return run(
        supabase.from('magazine_issues').insert({
          community_id: communityId,
          title: input.title.trim(),
          release_date: input.release_date,
          created_by: input.created_by,
        }),
      )
    },
    [communityId, run],
  )

  const updateIssue = useCallback(
    (id: string, patch: { title?: string; release_date?: string; cover_path?: string | null }) =>
      run(supabase.from('magazine_issues').update(patch).eq('id', id)),
    [run],
  )

  const deleteIssue = useCallback(
    (id: string) => run(supabase.from('magazine_issues').delete().eq('id', id)),
    [run],
  )

  const addPage = useCallback(
    (issue: MagazineIssue, imagePath: string): Promise<Result> => {
      if (!communityId) return Promise.resolve({ error: 'Sem comunidade selecionada.' })
      const next = issue.pages.reduce((max, p) => Math.max(max, p.position), 0) + 1
      return run(
        supabase.from('magazine_pages').insert({
          issue_id: issue.id,
          community_id: communityId,
          position: next,
          image_path: imagePath,
        }),
      )
    },
    [communityId, run],
  )

  const replacePage = useCallback(
    (pageId: string, imagePath: string) =>
      run(supabase.from('magazine_pages').update({ image_path: imagePath }).eq('id', pageId)),
    [run],
  )

  const removePage = useCallback(
    (pageId: string) => run(supabase.from('magazine_pages').delete().eq('id', pageId)),
    [run],
  )

  return {
    issues,
    loading,
    refresh,
    createIssue,
    updateIssue,
    deleteIssue,
    addPage,
    replacePage,
    removePage,
  }
}
