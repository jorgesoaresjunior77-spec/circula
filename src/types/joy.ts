// Fase 4 — MOMENTO DE ALEGRIA.
//
// Espaço leve e positivo, separado do Feed principal. Cada momento é
// compartilhado com a comunidade (isolamento por comunidade na RLS).

export interface JoyMoment {
  id: string
  community_id: string
  profile_id: string
  body: string
  image_url: string | null
  created_at: string
  updated_at: string
  author: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export interface JoyMomentInput {
  body: string
  image_url?: string | null
}

export type JoyResult = { error: string | null }

/** Ideias de abertura — linguagem simples e humana, sem tom de diário triste. */
export const JOY_PROMPTS: string[] = [
  'Hoje foi especial porque…',
  'Uma coisa boa que aconteceu hoje…',
  'Quero celebrar…',
  'Pequenas alegrias também contam:',
]
