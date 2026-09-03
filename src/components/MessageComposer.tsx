import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { MessageResult } from '../types/message'

interface MessageComposerProps {
  onSend: (body: string) => Promise<MessageResult>
  disabled?: boolean
}

export function MessageComposer({ onSend, disabled }: MessageComposerProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  async function submit() {
    const body = text.trim()
    if (!body || busy || disabled) return
    setBusy(true)
    setSendError(null)
    const { error } = await onSend(body)
    setBusy(false)
    if (error) {
      setSendError('Não foi possível enviar agora. Tente novamente.')
      return
    }
    setText('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="message-composer">
      {sendError && <p className="auth-error">{sendError}</p>}
      <div className="message-composer-row">
        <textarea
          className="message-composer-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva uma mensagem..."
          rows={1}
          disabled={disabled || busy}
        />
        <button
          type="button"
          className="message-composer-send"
          onClick={submit}
          disabled={disabled || busy || !text.trim()}
        >
          {busy ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
