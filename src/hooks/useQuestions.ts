import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  CommunityQuestion,
  PublishQuestionResult,
  QuestionResult,
} from '../types/question'

const QUESTION_SELECT = 'id,community_id,content,is_active,created_by,created_at'

export function useQuestions(communityId: string | null) {
  const [questions, setQuestions] = useState<CommunityQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchQuestions = useCallback(async () => {
    if (!communityId) {
      setQuestions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('community_questions')
      .select(QUESTION_SELECT)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setQuestions([])
      setLoading(false)
      return
    }

    setQuestions((data as CommunityQuestion[] | null) ?? [])
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  async function createQuestion(createdBy: string, content: string): Promise<QuestionResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: insertError } = await supabase.from('community_questions').insert({
      community_id: communityId,
      created_by: createdBy,
      content,
    })

    if (insertError) return { error: insertError.message }

    await fetchQuestions()
    return { error: null }
  }

  async function updateQuestion(questionId: string, content: string): Promise<QuestionResult> {
    const { error: updateError } = await supabase
      .from('community_questions')
      .update({ content })
      .eq('id', questionId)

    if (updateError) return { error: updateError.message }

    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, content } : q)))
    return { error: null }
  }

  async function toggleActive(questionId: string, isActive: boolean): Promise<QuestionResult> {
    const { error: updateError } = await supabase
      .from('community_questions')
      .update({ is_active: isActive })
      .eq('id', questionId)

    if (updateError) return { error: updateError.message }

    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, is_active: isActive } : q)),
    )
    return { error: null }
  }

  async function deleteQuestion(questionId: string): Promise<QuestionResult> {
    const { error: deleteError } = await supabase
      .from('community_questions')
      .delete()
      .eq('id', questionId)

    if (deleteError) return { error: deleteError.message }

    setQuestions((prev) => prev.filter((q) => q.id !== questionId))
    return { error: null }
  }

  async function publishDailyQuestion(): Promise<PublishQuestionResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: publishError } = await supabase.rpc('publish_daily_question', {
      p_community_id: communityId,
    })

    if (publishError) return { error: publishError.message }

    return { error: null }
  }

  return {
    questions,
    loading,
    error,
    createQuestion,
    updateQuestion,
    toggleActive,
    deleteQuestion,
    publishDailyQuestion,
    refresh: fetchQuestions,
  }
}
