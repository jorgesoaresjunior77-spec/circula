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

// A lista mostra só o que ainda espera decisão. Aprovada ou recusada sai daqui
// (a autora continua vendo o status da própria solicitação).
const OPEN_STATUSES: CircleRequestStatus[] = ['pending', 'reviewing']

function RequestImage({ path }: { path: string | null }) {
  const { url } = useSignedImageUrl(path)
  if (!url) return null
  return <img loading="lazy" decoding="async" src={url} alt="Imagem de referência sugerida" className="circle-request-review-image" />
}

function RequestRow({
  request,
  reviewerId,
  onUpdateStatus,
  onError,
}: {
  request: CircleRequest
  reviewerId: string
  onUpdateStatus: ReturnType<typeof useCircleRequests>['updateStatus']
  onError: (message: string | null) => void
}) {
  const [note, setNote] = useState(request.professional_note ?? '')
  const [busy, setBusy] = useState(false)

  async function handleStatus(status: CircleRequestStatus) {
    if (busy) return
    setBusy(true)
    onError(null)
    const result = await onUpdateStatus(request.id, status, reviewerId, note)
    setBusy(false)
    // Em erro a solicitação volta para a lista; o aviso fica na lista (esta linha pode ter sido remontada).
    if (result.error) onError('Não foi possível salvar agora. Tente novamente. A solicitação continua na lista.')
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
  const [actionError, setActionError] = useState<string | null>(null)

  if (loading) return <p className="home-muted">Carregando solicitações…</p>
  if (error) {
    // Até a migration 20261030130000 ser aplicada no banco remoto, esta
    // consulta falha (tabela ainda não existe) — mesma UX amigável de
    // qualquer outra falha de carregamento, nunca a mensagem crua do
    // Postgres (ex.: "Could not find the table...").
    return <p className="auth-error">Solicitações de Círculo indisponíveis no momento.</p>
  }
  const open = requests.filter((r) => OPEN_STATUSES.includes(r.status))
  if (open.length === 0) {
    return (
      <EmptyState message={requests.length === 0 ? 'Nenhuma solicitação de Círculo ainda — quando uma participante sugerir um novo Círculo pela Home, a solicitação aparece aqui.' : 'Nenhuma solicitação pendente.'} />
    )
  }

  const sorted = [...open].sort((a, b) => OPEN_STATUSES.indexOf(a.status) - OPEN_STATUSES.indexOf(b.status))

  return (
    <div className="circle-request-review">
      <h4 className="card-images-title">Solicitações de novo Círculo</h4>
      {actionError && (
        <p className="auth-error" role="alert">
          {actionError}
        </p>
      )}
      <ul className="circle-request-review-list">
        {sorted.map((request) => (
          <RequestRow
            key={request.id}
            request={request}
            reviewerId={profileId}
            onUpdateStatus={updateStatus}
            onError={setActionError}
          />
        ))}
      </ul>
    </div>
  )
}
