export type MetricsPeriodDays = 1 | 7 | 30

export interface CommunityMetrics {
  total_members: number
  active_members: number
  inactive_members: number
  new_members: number
  posts_count: number
  comments_count: number
  reactions_count: number
  challenge_progress_count: number
  checkin_responses_count: number
  circle_joins_count: number
}
