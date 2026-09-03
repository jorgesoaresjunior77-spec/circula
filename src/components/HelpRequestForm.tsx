import { useState } from 'react'
import type { FormEvent } from 'react'
import type { HelpAudience, HelpRequestInput, HelpResult } from '../types/help'
import { HELP_AUDIENCE_LABEL } from '../types/help'
import { HeartIcon, CommunitiesIcon } from './icons'

// Fase 5 — formulário do Pedido de ajuda.
// Simples e acolhedor: escreva o pedido, escolha o destino (a Nutri ou
// a comunidade) em dois botões grandes, e envie.

interface HelpRequestFormProps {
  onSubmit: (input: HelpRequestInput) => Promise<HelpResult>
  onCancel?: () => void
  busy?: boolean
}

export function HelpRequestForm({ onSubmit, onCancel, busy = false }: HelpRequestFormProps) {
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<HelpAudience>('nutri')
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) {
      setError('Escreva o seu pedido antes de enviar.')
      return
    }
    setWorking(true)
    setError(null)
    const { error: opError } = await onSubmit({ body, audience })
    setWorking(false)
    if (opError) {
      setError('Não foi possível enviar agora. Tente novamente.')
      return
    }
    setBody('')
  }

  const disabled = busy || working

  return (
    <form className="help-form" onSubmit={handleSubmit}>
      <label className="help-form-label" htmlFor="help-body">
        O que você precisa?
      </label>
      <textarea
        id="help-body"
        className="help-form-text"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Conte com as suas palavras. Estamos aqui por você."
      />

      <p className="help-form-label">Para quem você quer pedir?</p>
      <div className="help-audience" role="radiogroup" aria-label="Destino do pedido">
        <button
          type="button"
          role="radio"
          aria-checked={audience === 'nutri'}
          className={`help-audience-option${audience === 'nutri' ? ' help-audience-option--on' : ''}`}
          onClick={() => setAudience('nutri')}
        >
          <HeartIcon size={20} />
          <span className="help-audience-title">{HELP_AUDIENCE_LABEL.nutri}</span>
          <span className="help-audience-sub">Uma conversa privada com a anfitriã.</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={audience === 'community'}
          className={`help-audience-option${
            audience === 'community' ? ' help-audience-option--on' : ''
          }`}
          onClick={() => setAudience('community')}
        >
          <CommunitiesIcon size={20} />
          <span className="help-audience-title">{HELP_AUDIENCE_LABEL.community}</span>
          <span className="help-audience-sub">Outras mulheres do Círcula podem responder.</span>
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="help-form-actions">
        {onCancel && (
          <button type="button" className="auth-link" onClick={onCancel} disabled={disabled}>
            Cancelar
          </button>
        )}
        <button type="submit" className="help-primary-button" disabled={disabled}>
          {working ? 'Enviando…' : 'Enviar meu pedido'}
        </button>
      </div>
    </form>
  )
}
