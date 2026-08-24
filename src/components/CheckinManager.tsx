import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCheckins } from '../hooks/useCheckins'
import { CheckinResponseForm } from './CheckinResponseForm'
import type { CheckinMood } from '../types/checkin'

const MOOD_EMOJI: Record<CheckinMood, string> = {
  great: '😊',
  good: '🙂',
  okay: '😐',
  hard: '😔',
}

interface CheckinManagerProps {
  communityId: string
  profileId: string
  canManage: boolean
  canParticipate: boolean
  onShared?: () => void
}

export function CheckinManager({
  communityId,
  profileId,
  canManage,
  canParticipate,
  onShared,
}: CheckinManagerProps) {
  const {
    checkins,
    instances,
    responsesByInstance,
    loading,
    error,
    createCheckin,
    updateCheckin,
    toggleActive,
    deleteCheckin,
    publishCheckin,
    respondCheckin,
    shareCheckin,
  } = useCheckins(communityId)

  const [newContent, setNewContent] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [publishing, setPublishing] = useState(false)
  const [publishMessage, setPublishMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const activeCount = checkins.filter((checkin) => checkin.is_active).length

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)

    const { error: createErr } = await createCheckin(profileId, newContent)

    setCreating(false)

    if (createErr) {
      setCreateError('Não foi possível salvar o check-in agora. Tente novamente.')
      return
    }

    setNewContent('')
  }

  function startEdit(id: string, content: string) {
    setEditingId(id)
    setEditContent(content)
  }

  async function handleSaveEdit(event: FormEvent, id: string) {
    event.preventDefault()
    setSavingEdit(true)

    const { error: updateErr } = await updateCheckin(id, editContent)

    setSavingEdit(false)

    if (!updateErr) {
      setEditingId(null)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    setPublishMessage(null)

    const { error: publishError } = await publishCheckin()

    setPublishing(false)

    if (publishError) {
      setPublishMessage({ type: 'error', text: publishError })
      return
    }

    setPublishMessage({ type: 'success', text: 'Check-in publicado para a comunidade.' })
  }

  async function handleShare(content: string) {
    const result = await shareCheckin(profileId, content)
    if (!result.error) onShared?.()
    return result
  }

  return (
    <section className="community-card checkin-manager">
      <h3>Check-ins da comunidade</h3>

      {canManage && (
        <>
          <button type="button" onClick={handlePublish} disabled={publishing || activeCount === 0}>
            {publishing ? 'Publicando...' : 'Publicar check-in agora'}
          </button>

          {activeCount === 0 && !loading && (
            <p className="question-empty">
              Cadastre pelo menos um check-in ativo para poder publicar.
            </p>
          )}

          {publishMessage && (
            <p className={publishMessage.type === 'success' ? 'auth-success' : 'auth-error'}>
              {publishMessage.text}
            </p>
          )}

          <form onSubmit={handleCreate} className="question-form">
            <label htmlFor="new-checkin">Novo check-in</label>
            <textarea
              id="new-checkin"
              value={newContent}
              onChange={(event) => setNewContent(event.target.value)}
              rows={2}
              placeholder="Ex.: Como você está?"
              required
            />
            {createError && <p className="auth-error">{createError}</p>}
            <button type="submit" disabled={creating || !newContent.trim()}>
              {creating ? 'Salvando...' : 'Adicionar check-in'}
            </button>
          </form>

          {!loading && !error && checkins.length === 0 && (
            <p className="question-empty">Nenhum check-in cadastrado ainda.</p>
          )}

          {!loading && !error && checkins.length > 0 && (
            <ul className="question-list">
              {checkins.map((checkin) => (
                <li key={checkin.id} className="question-item">
                  {editingId === checkin.id ? (
                    <form
                      className="question-edit-form"
                      onSubmit={(event) => handleSaveEdit(event, checkin.id)}
                    >
                      <textarea
                        value={editContent}
                        onChange={(event) => setEditContent(event.target.value)}
                        rows={2}
                        required
                      />
                      <div className="question-item-actions">
                        <button type="button" className="auth-link" onClick={() => setEditingId(null)}>
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="question-save-button"
                          disabled={savingEdit || !editContent.trim()}
                        >
                          {savingEdit ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p
                        className={`question-content${
                          checkin.is_active ? '' : ' question-content--inactive'
                        }`}
                      >
                        {checkin.content}
                      </p>
                      <div className="question-item-actions">
                        <button type="button" onClick={() => startEdit(checkin.id, checkin.content)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(checkin.id, !checkin.is_active)}
                        >
                          {checkin.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          className="question-delete-button"
                          onClick={() => deleteCheckin(checkin.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {loading && <p>Carregando check-ins...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && instances.length === 0 && (
        <p className="checkin-empty">Nenhum check-in publicado ainda.</p>
      )}

      {!loading &&
        !error &&
        instances.map((instance) => {
          const responses = responsesByInstance[instance.id] ?? []
          const myResponse = responses.find((response) => response.profile_id === profileId)

          return (
            <div key={instance.id} className="checkin-block">
              <p className="checkin-prompt">{instance.content}</p>

              {canParticipate && (
                <CheckinResponseForm
                  myResponse={myResponse}
                  onRespond={(mood, wantsToShare) =>
                    respondCheckin(instance.id, profileId, mood, wantsToShare)
                  }
                  onShare={handleShare}
                />
              )}

              {canManage && (
                <div className="checkin-roster">
                  {responses.length === 0 ? (
                    <p className="checkin-empty">Ninguém respondeu ainda.</p>
                  ) : (
                    <ul className="checkin-roster-list">
                      {responses.map((response) => (
                        <li key={response.id}>
                          {MOOD_EMOJI[response.mood]} {response.profile?.full_name ?? 'Participante'}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
    </section>
  )
}
