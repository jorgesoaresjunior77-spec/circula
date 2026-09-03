import type { Comment } from '../types/post'

/**
 * Agrupa uma lista PLANA de comentários (raízes + respostas de 1 nível)
 * em uma árvore rasa: cada comentário-raiz recebe `replies` (ordenadas
 * por data, ascendente) e `reply_count`.
 *
 * Respostas cujo pai não está na lista entram como raiz (defensivo — não
 * deve acontecer com a policy de insert vigente). As raízes saem em
 * ordem cronológica ascendente (leitura natural de conversa).
 *
 * Feito no cliente a partir de UMA consulta por post — nunca uma
 * consulta por comentário (evita N+1).
 */
export function buildCommentTree(flat: Comment[]): Comment[] {
  const nodes = new Map<string, Comment>()
  for (const c of flat) nodes.set(c.id, { ...c, replies: [], reply_count: 0 })

  const roots: Comment[] = []
  for (const c of flat) {
    const node = nodes.get(c.id)
    if (!node) continue
    const parent = c.parent_comment_id ? nodes.get(c.parent_comment_id) : undefined
    if (parent) parent.replies!.push(node)
    else roots.push(node)
  }

  const byDate = (a: Comment, b: Comment) => a.created_at.localeCompare(b.created_at)
  for (const root of roots) {
    root.replies!.sort(byDate)
    root.reply_count = root.replies!.length
  }
  roots.sort(byDate)
  return roots
}
