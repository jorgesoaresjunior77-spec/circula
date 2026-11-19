import { createContext, useContext } from 'react'

// Ações sobre o conteúdo já publicado: a autora edita e apaga o que é dela; a
// dona da comunidade (moderação) remove comentários e publicações de
// membros — o banco registra quem fez e quando.
export interface ContentActions {
  viewerId: string
  isModerator: boolean
  editPost: (postId: string, content: string) => Promise<{ error: string | null }>
  deletePost: (postId: string) => Promise<{ error: string | null }>
  editComment: (commentId: string, content: string) => Promise<{ error: string | null }>
  deleteComment: (commentId: string) => Promise<{ error: string | null }>
  moderatePost: (postId: string) => Promise<{ error: string | null }>
  moderateComment: (commentId: string) => Promise<{ error: string | null }>
}

const Ctx = createContext<ContentActions | null>(null)
export const ContentActionsProvider = Ctx.Provider
export function useContentActions(): ContentActions | null {
  return useContext(Ctx)
}
