import { useState } from 'react'
import { useCircleRequests } from '../hooks/useCircleRequests'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { CIRCLE_REQUEST_STATUS_LABEL } from '../types/circleRequest'
import type { CircleRequest, CircleRequestStatus } from '../types/circleRequest'
import { EmptyState } from './EmptyState'

// Etapa 5.3 (evolução/experiência/gamificação) — revisão das
// solicitações de novo Círculo, dentro do Painel → Círculos (mesma aba
// de sempre, CircleManager.tsx, que monta este componente acima do
// formulário de criação). A notificação do sino já leva até aqui (ver
// NotificationBell TYPE_TO_NAV — 'circle_request' -> 'painel', e a
// Profissional abre a aba Círculos).
//
// "Aprovar" NUNCA cria um Círculo publicado sozinho — pedido explícito
// do usuário ("a decisão final pertence à profissional"). Aprovar só
// marca o status; criar o Círculo de verdade continua sendo o form
// de sempre, logo abaixo nesta mesma aba, usando a sugestão como
// inspiração.

const REVIEW_ORDER: CircleRequestStatus[] = ['pending', 'reviewing', 'approved', 'rejected']

function RequestImage({ path }: { path: string | null }) {
  const { url } = useSignedImageUrl(path)
  if (!url) return null
  return <img loading="lazy" decoding="async" src={url} alt="Imagem de referência sugerida" className="circle-request-review-image" />
}

function RequestRow({
  request,
  reviewerId,
  onUpdateStatus,
}: {
  request: CircleRequest
  reviewerId: string
  onUpdateStatus: ReturnType<typeof useCircleRequests>['updateStatus']
}) {
  const [note, setNote] = useState(request.professional_note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStatus(status: CircleRequestStatus) {
    setBusy(true)
    setError(null)
    const result = await onUpdateStatus(request.id, status, reviewerId, note)
    setBusy(false)
    if (result.error) setError('Não foi possível salvar agora. Tente novamente.')
  }

  const fields: [string, string | null][] = [
    ['Assunto', request.topic],
    ['Por que participar', request.reason],
    ['Conversas/atividades desejadas', request.activities],
    ['Identidade visual imaginada', request.visual_idea],
    ['Observações', request.notes],
  ]

  return (
    <li className={`circle-request-review-row circle-request-review-row--${request.status}`}>
      <div className="circle-request-review-head">
        <div>
          <span className="circle-request-review-name">{request.suggested_name}</span>
          <span className="circle-request-review-author">
            sugerido por {request.profile?.full_name ?? 'uma participante'}
          </span>
        </div>
        <span className="circle-request-review-status">
          {CIRCLE_REQUEST_STATUS_LABEL[request.status]}
        </span>
      </div>

      <RequestImage path={request.reference_image_path} />

      <dl className="circle-request-review-fields">
        {fields
          .filter(([, value]) => value && value.trim())
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>

      <label htmlFor={`cr-note-${request.id}`}>Observação / resposta (opcional)</label>
      <textarea
        id={`cr-note-${request.id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
      />

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <div className="circle-request-review-actions">
        {request.status === 'pending' && (
          <button type="button" onClick={() => handleStatus('reviewing')} disabled={busy}>
            Marcar como em análise
          </button>
        )}
        {request.status !== 'approved' && (
          <button
            type="button"
            className="panel-content-action panel-content-action--primary"
            onClick={() => handleStatus('approved')}
            disabled={busy}
          >
            Aprovar
          </button>
        )}
        {request.status !== 'rejected' && (
          <button
            type="button"
            className="panel-content-action panel-content-action--delete"
            onClick={() => handleStatus('rejected')}
            disabled={busy}
          >
            Recusar
          </button>
        )}
      </div>
    </li>
  )
}

interface CircleRequestReviewProps {
  communityId: string
  profileId: string
}

export function CircleRequestReview({ communityId, profileId }: CircleRequestReviewProps) {
  const { requests, loading, error, updateStatus } = useCircleRequests(communityId, profileId)

  if (loading) return <p className="home-muted">Carregando solicitações…</p>
  if (error) {
    // Até a migration 20261030130000 ser aplicada no banco remoto, esta
    // consulta falha (tabela ainda não existe) — mesma UX amigável de
    // qualquer outra falha de carregamento, nunca a mensagem crua do
    // Postgres (ex.: "Could not find the table...").
    return <p className="auth-error">Solicitações de Círculo indisponíveis no momento.</p>
  }
  if (requests.length === 0) {
    return (
      <EmptyState message="Nenhuma solicitação de Círculo ainda — quando uma participante sugerir um novo Círculo pela Home, a solicitação aparece aqui." />
    )
  }

  const sorted = [...requests].sort(
    (a, b) => REVIEW_ORDER.indexOf(a.status) - REVIEW_ORDER.indexOf(b.status),
  )

  return (
    <div className="circle-request-review">
      <h4 className="card-images-title">Solicitações de novo Círculo</h4>
      <ul className="circle-request-review-list">
        {sorted.map((request) => (
          <RequestRow
            key={request.id}
            request={request}
            reviewerId={profileId}
            onUpdateStatus={updateStatus}
          />
        ))}
      </ul>
    </div>
  )
}
