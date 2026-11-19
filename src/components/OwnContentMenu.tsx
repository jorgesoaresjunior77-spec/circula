import { useState } from 'react'
import { useContentActions } from '../hooks/useContentActions'
import { isBlockedText, MODERATION_MESSAGE } from '../lib/moderation'

// Editar / apagar o que é seu; "Remover" para a moderação (dona da comunidade).
interface Props {
  kind: 'post' | 'comment'
  id: string
  authorId: string | undefined
  content: string
}

export function OwnContentMenu({ kind, id, authorId, content }: Props) {
  const actions = useContentActions()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(content)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  if (!actions || !authorId) return null
  const mine = actions.viewerId === authorId
  const moderate = actions.isModerator && !mine
  if (!mine && !moderate) return null

  async function run(fn: () => Promise<{ error: string | null }>, ok?: () => void) {
    setBusy(true)
    setMessage(null)
    const { error } = await fn()
    setBusy(false)
    if (error) setMessage(error)
    else ok?.()
  }

  async function save() {
    if (!actions) return
    const next = text.trim()
    if (!next) return setMessage('Escreva algo antes de salvar.')
    if (isBlockedText(next)) return setMessage(MODERATION_MESSAGE)
    await run(() => (kind === 'post' ? actions.editPost(id, next) : actions.editComment(id, next)), () => setEditing(false))
  }

  function remove() {
    if (!actions) return
    const label = kind === 'post' ? 'esta publicação' : 'este comentário'
    if (!window.confirm(`Apagar ${label}? Não dá para desfazer.`)) return
    if (moderate) void run(() => (kind === 'post' ? actions.moderatePost(id) : actions.moderateComment(id)))
    else void run(() => (kind === 'post' ? actions.deletePost(id) : actions.deleteComment(id)))
  }

  if (editing) {
    return (
      <div className="own-edit">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-label="Editar mensagem" />
        <div className="own-edit-actions">
          <button type="button" disabled={busy} onClick={() => void save()}>
            Salvar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setEditing(false)
              setText(content)
              setMessage(null)
            }}
          >
            Cancelar
          </button>
        </div>
        {message && <p className="auth-error">{message}</p>}
      </div>
    )
  }

  return (
    <span className="own-menu">
      {mine && (
        <button type="button" className="own-menu-btn" onClick={() => setEditing(true)}>
          Editar
        </button>
      )}
      <button type="button" className="own-menu-btn" disabled={busy} onClick={remove}>
        {moderate ? 'Remover (moderação)' : 'Apagar'}
      </button>
      {message && <span className="auth-error">{message}</span>}
    </span>
  )
}
