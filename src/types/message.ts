export interface ConversationOverview {
  conversation_id: string
  other_profile_id: string
  other_full_name: string | null
  other_avatar_url: string | null
  last_message_body: string | null
  last_message_at: string
  last_message_sender_id: string | null
  unread_count: number
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

export interface ConversationPeer {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export type StartConversationResult = { id: string | null; error: string | null }
export type MessageResult = { error: string | null }
