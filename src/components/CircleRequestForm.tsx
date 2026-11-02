import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCircleRequests } from '../hooks/useCircleRequests'
import { CIRCLE_REQUEST_STATUS_LABEL } from '../types/circleRequest'
import { CoverImageInput } from './CoverImageInput'
import { ChevronLeftIcon } from './icons'

// Etapa 5.1/5.2 (evolução/experiência/gamificação) — formulário de
// solicitação de um novo Círculo, aberto pelo card "Novo Círculo" da
// faixa editorial de Círculos (<HomeCirclesSection>). A decisão final é
// sempre da Profissional (ver Etapa 5.3 / CircleRequestReview.tsx) —
// isto aqui NUNCA cria um Círculo publicado.
//
// Só o nome sugerido é obrigatório — pedido explícito do usuário ("Não
// exigir que todos os campos sejam obrigatoriamente preenchidos.
// Tornar obrigatórios apenas os dados essenciais"). Imagem de
// referência via CoverImageInput (mesmo componente/bucket de qualquer
// outra capa do app — community-media, pasta `covers`, já liberado para
// qualquer membro ativa por policy existente).

interface CircleRequestFormProps {
  communityId: string
  profileId: string
  onBack: () => void
}

export function CircleRequestForm({ communityId, profileId, onBack }: CircleRequestFormProps) {
  const { myPendingRequest, createRequest } = useCircleRequests(communityId, profileId)

  const [suggestedName, setSuggestedName] = useState('')
  const [topic, setTopic] = useState('')
  const [reason, setReason] = useState('')
  const [activities, setActivities] = useState('')
  const [visualIdea, setVisualIdea] = useState('')
  const [notes, setNotes] = useState('')
  const [referenceImage, setReferenceImage] = useState('')
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
      reason: reason || null,
      activities: activities || null,
      visual_idea: visualIdea || null,
      notes: notes || null,
      reference_image_path: referenceImage || null,
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
        <p className="circle-request-intro">
          Conte pra gente qual Círculo você gostaria de ver por aqui. A
          Profissional lê todas as sugestões e decide quais entram no ar —
          enviar uma solicitação não cria o Círculo automaticamente.
        </p>

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
            <label htmlFor="cr-name">Qual nome você sugere para o novo círculo? *</label>
            <input
              id="cr-name"
              type="text"
              value={suggestedName}
              onChange={(e) => setSuggestedName(e.target.value)}
              maxLength={80}
              required
            />

            <label htmlFor="cr-topic">Sobre qual assunto seria esse círculo?</label>
            <textarea
              id="cr-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
            />

            <label htmlFor="cr-reason">Por que você gostaria de participar dele?</label>
            <textarea
              id="cr-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />

            <label htmlFor="cr-activities">
              Que tipo de conversas ou atividades gostaria de encontrar?
            </label>
            <textarea
              id="cr-activities"
              value={activities}
              onChange={(e) => setActivities(e.target.value)}
              rows={2}
            />

            <label htmlFor="cr-visual">
              Como imagina a imagem ou identidade visual desse círculo?
            </label>
            <textarea
              id="cr-visual"
              value={visualIdea}
              onChange={(e) => setVisualIdea(e.target.value)}
              rows={2}
            />

            <label htmlFor="cr-notes">Deseja deixar alguma observação adicional?</label>
            <textarea
              id="cr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />

            <CoverImageInput
              value={referenceImage}
              communityId={communityId}
              uid={profileId}
              label="Imagem de referência (opcional)"
              onChange={setReferenceImage}
              aspectRatio="4 / 5"
            />

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
