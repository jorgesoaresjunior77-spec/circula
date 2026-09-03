export type SocialNotificationType =
  | 'post_comment'
  | 'post_reaction'
  | 'circle_join'
  | 'event_rsvp'
  | 'challenge_comment'
  | 'direct_message'
  | 'help_request'

export interface NotificationActor {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface SocialNotification {
  id: string
  profile_id: string
  actor_profile_id: string | null
  type: SocialNotificationType
  title: string
  body: string | null
  related_post_id: string | null
  related_comment_id: string | null
  related_circle_id: string | null
  related_event_id: string | null
  related_challenge_id: string | null
  related_conversation_id: string | null
  related_help_request_id: string | null
  read_at: string | null
  created_at: string
  actor: NotificationActor | null
}

export type NotificationResult = { error: string | null }
