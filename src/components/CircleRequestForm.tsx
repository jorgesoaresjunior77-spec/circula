import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCircleRequests } from '../hooks/useCircleRequests'
import { CIRCLE_REQUEST_STATUS_LABEL } from '../types/circleRequest'
import { ChevronLeftIcon } from './icons'

// Solicitação de um novo Círculo, aberta pelo card "Novo Círculo" da faixa de
// Círculos. Formulário bem simples (pedido da Profissional): só o nome e o
// assunto. A decisão final é sempre da Profissional (CircleRequestReview.tsx);
// isto aqui NUNCA cria um Círculo publicado. Só o nome é obrigatório.

interface CircleRequestFormProps {
  communityId: string
  profileId: string
  onBack: () => void
}

export function CircleRequestForm({ communityId, profileId, onBack }: CircleRequestFormProps) {
  const { myPendingRequest, createRequest } = useCircleRequests(communityId, profileId)

  const [suggestedName, setSuggestedName] = useState('')
  const [topic, setTopic] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSubmitted, setJustSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!suggestedName.trim() || submitting) return

    setSubmitting(true)
    setError(null)

    const result = await createRequest(profileId, {
      suggested_name: suggestedName,
      topic: topic || null,
      reason: null,
      activities: null,
      visual_idea: null,
      notes: null,
      reference_image_path: null,
    })

    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setJustSubmitted(true)
  }

  const pending = justSubmitted ? null : myPendingRequest

  return (
    <section className="circle-detail">
      <button type="button" className="circle-detail-back" onClick={onBack}>
        <ChevronLeftIcon size={16} />
        Voltar para círculos
      </button>

      <div className="community-card circle-request-card">
        <h2 className="circle-request-title">Novo Círculo</h2>

        {(justSubmitted || pending) && (
          <div className="circle-request-confirmation" role="status">
            <p className="circle-request-confirmation-title">
              {justSubmitted ? 'Solicitação enviada!' : 'Você já tem uma solicitação em análise'}
            </p>
            <p>
              {justSubmitted
                ? 'Obrigada por sugerir — a Profissional foi avisada e vai dar uma olhada.'
                : `Status atual: ${CIRCLE_REQUEST_STATUS_LABEL[pending!.status]}.`}
            </p>
            {!justSubmitted && pending && (
              <p className="circle-request-confirmation-name">“{pending.suggested_name}”</p>
            )}
          </div>
        )}

        {!justSubmitted && !pending && (
          <form className="circle-request-form" onSubmit={handleSubmit}>
            <label htmlFor="cr-name">Que nome sugere para o novo Círculo?</label>
            <input
              id="cr-name"
              type="text"
              value={suggestedName}
              onChange={(e) => setSuggestedName(e.target.value)}
              maxLength={80}
              required
            />

            <label htmlFor="cr-topic">Qual assunto seria?</label>
            <input
              id="cr-topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={160}
            />

            <p className="circle-request-note">
              Criando um novo círculo, esperamos que você convide pessoas para nossa comunidade.
            </p>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting || !suggestedName.trim()}>
              {submitting ? 'Enviando…' : 'Enviar solicitação'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
