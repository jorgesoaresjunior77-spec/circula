import { useState } from 'react'
import type { HelpRequest, HelpRequestReply, HelpResult, HelpStatus } from '../types/help'
import { HELP_AUDIENCE_LABEL, HELP_STATUS_LABEL } from '../types/help'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { CommentList } from './CommentList'
import { CommentForm } from './CommentForm'
import { MessageIcon } from './icons'

// Fase 5 — card de um pedido de ajuda.
// Status bem visível, linguagem acolhedora. Para 'nutri': botão que abre
// a conversa no sistema de Mensagens. Para 'community': respostas em
// thread reaproveitando CommentList/CommentForm.

interface HelpRequestCardProps {
  request: HelpRequest
  viewerId: string
  /** Nutri: mostra os botões de status. */
  canManageStatus?: boolean
  replies?: HelpRequestReply[]
  onFetchReplies: () => Promise<HelpResult>
  onReply: (body: string) => Promise<HelpResult>
  onSetStatus?: (status: HelpStatus) => Promise<HelpResult>
  onEdit?: (body: string) => Promise<HelpResult>
  onDelete?: () => Promise<HelpResult>
  onOpenConversation?: (conversationId: string) => void
}

export function HelpRequestCard({
  request,
  viewerId,
  canManageStatus = false,
  replies,
  onFetchReplies,
  onReply,
  onSetStatus,
  onEdit,
  onDelete,
  onOpenConversation,
}: HelpRequestCardProps) {
  const isOwn = request.profile_id === viewerId
  const authorName = request.author?.full_name ?? 'Uma mulher do Círcula'

  const [showReplies, setShowReplies] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(request.body)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openReplies() {
    const next = !showReplies
    setShowReplies(next)
    if (next && !replies) await onFetchReplies()
  }

  async function saveEdit() {
    if (!onEdit || !draft.trim()) return
    setBusy(true)
    setError(null)
    const { error: opError } = await onEdit(draft)
    setBusy(false)
    if (opError) {
      setError('Não foi possível salvar agora.')
      return
    }
    setEditing(false)
  }

  async function runStatus(status: HelpStatus) {
    if (!onSetStatus) return
    setBusy(true)
    setError(null)
    const { error: opError } = await onSetStatus(status)
    setBusy(false)
    if (opError) setError('Não foi possível atualizar o status agora.')
  }

  async function runDelete() {
    if (!onDelete) return
    setBusy(true)
    setError(null)
    const { error: opError } = await onDelete()
    if (opError) {
      setBusy(false)
      setError('Não foi possível remover agora.')
    }
  }

  const commentShaped = (replies ?? []).map((r) => ({
    id: r.id,
    content: r.body,
    created_at: r.created_at,
    author: r.author,
  }))

  return (
    <article className={`help-card help-card--${request.status}`}>
      <header className="help-card-head">
        <span className={`help-status help-status--${request.status}`}>
          {HELP_STATUS_LABEL[request.status]}
        </span>
        <span className="help-card-audience">{HELP_AUDIENCE_LABEL[request.audience]}</span>
        <span className="help-card-time">
          {authorName} · {formatRelativeTime(request.created_at)}
        </span>
      </header>

      {editing ? (
        <>
          <textarea
            className="help-form-text"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="help-form-actions">
            <button type="button" className="auth-link" onClick={() => setEditing(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="help-primary-button"
              onClick={saveEdit}
              disabled={busy || !draft.trim()}
            >
              {busy ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </>
      ) : (
        <p className="help-card-body">{request.body}</p>
      )}

      {error && <p className="auth-error">{error}</p>}

      <div className="help-card-actions">
        {request.audience === 'nutri' && request.related_conversation_id && onOpenConversation && (
          <button
            type="button"
            className="help-secondary-button"
            onClick={() => onOpenConversation(request.related_conversation_id as string)}
          >
            <MessageIcon size={16} />
            {canManageStatus ? 'Abrir conversa' : 'Abrir conversa com a Nutri'}
          </button>
        )}

        {request.audience === 'community' && (
          <button type="button" className="help-secondary-button" onClick={openReplies}>
            <MessageIcon size={16} />
            {showReplies ? 'Fechar respostas' : 'Respostas'}
          </button>
        )}

        {canManageStatus && onSetStatus && (
          <>
            {request.status === 'open' && (
              <button
                type="button"
                className="help-chip-button"
                onClick={() => runStatus('in_progress')}
                disabled={busy}
              >
                Marcar em andamento
              </button>
            )}
            {request.status !== 'resolved' && (
              <button
                type="button"
                className="help-chip-button"
                onClick={() => runStatus('resolved')}
                disabled={busy}
              >
                Marcar como respondido
              </button>
            )}
            {request.status === 'resolved' && (
              <button
                type="button"
                className="help-chip-button"
                onClick={() => runStatus('open')}
                disabled={busy}
              >
                Reabrir
              </button>
            )}
          </>
        )}

        {isOwn && !canManageStatus && !editing && (
          <>
            <button
              type="button"
              className="help-chip-button"
              onClick={() => setEditing(true)}
              disabled={busy}
            >
              Editar
            </button>
            <button
              type="button"
              className="help-chip-button help-chip-button--danger"
              onClick={runDelete}
              disabled={busy}
            >
              Excluir
            </button>
          </>
        )}
      </div>

      {request.audience === 'community' && showReplies && (
        <div className="help-replies">
          <CommentList comments={commentShaped} />
          <CommentForm onSubmit={(body) => onReply(body)} />
        </div>
      )}
    </article>
  )
}
