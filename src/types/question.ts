export interface CommunityQuestion {
  id: string
  community_id: string
  content: string
  is_active: boolean
  created_by: string
  created_at: string
}

export type QuestionResult = { error: string | null }
export type PublishQuestionResult = { error: string | null }
