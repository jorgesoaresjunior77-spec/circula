import { useState } from 'react'
import type { FormEvent } from 'react'
import { useChallenges } from '../hooks/useChallenges'
import { ChallengeCard } from './ChallengeCard'
import { EmptyState } from './EmptyState'

interface ChallengeManagerProps {
  communityId: string
  profileId: string
  canManage: boolean
  canParticipate: boolean
}

export function ChallengeManager({
  communityId,
  profileId,
  canManage,
  canParticipate,
}: ChallengeManagerProps) {
  const {
    challenges,
    participantCounts,
    todayCompletedCounts,
    currentDays,
    myParticipation,
    commentCounts,
    commentsByChallenge,
    loading,
    error,
    createChallenge,
    updateChallenge,
    toggleActive,
    deleteChallenge,
    joinChallenge,
    refreshCounts,
    fetchComments,
    addComment,
  } = useChallenges(communityId, profileId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [activityDrafts, setActivityDrafts] = useState<{ day_number: number; content: string }[]>([
    { day_number: 1, content: '' },
  ])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  function addActivityDraft() {
    setActivityDrafts((prev) => [...prev, { day_number: prev.length + 1, content: '' }])
  }

  function removeLastActivityDraft() {
    setActivityDrafts((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }

  function updateActivityDraft(index: number, content: string) {
    setActivityDrafts((prev) => prev.map((activity, i) => (i === index ? { ...activity, content } : activity)))
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()

    if (activityDrafts.some((activity) => !activity.content.trim())) {
      setCreateError('Preencha o texto de todos os dias antes de salvar.')
      return
    }

    setCreating(true)
    setCreateError(null)

    const { error: createErr } = await createChallenge(profileId, title, description, activityDrafts)

    setCreating(false)

    if (createErr) {
      setCreateError('Não foi possível salvar o desafio agora. Tente novamente.')
      return
    }

    setTitle('')
    setDescription('')
    setActivityDrafts([{ day_number: 1, content: '' }])
  }

  function startEdit(id: string, currentTitle: string, currentDescription: string | null) {
    setEditingId(id)
    setEditTitle(currentTitle)
    setEditDescription(currentDescription ?? '')
  }

  async function handleSaveEdit(event: FormEvent, id: string) {
    event.preventDefault()
    setSavingEdit(true)

    const { error: updateErr } = await updateChallenge(id, {
      title: editTitle,
      description: editDescription,
    })

    setSavingEdit(false)

    if (!updateErr) {
      setEditingId(null)
    }
  }

  const visibleChallenges =
    !canManage && canParticipate ? challenges.filter((challenge) => challenge.is_active) : challenges

  return (
    <section className="community-card community-card--quiet challenge-manager">
      <h3>Desafios da comunidade</h3>

      {canManage && (
        <form onSubmit={handleCreate} className="challenge-form">
          <label htmlFor="challenge-title">Título do desafio</label>
          <input
            id="challenge-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />

          <label htmlFor="challenge-description">Descrição (opcional)</label>
          <textarea
            id="challenge-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
          />

          <p className="challenge-form-label">Atividades por dia</p>
          {activityDrafts.map((activity, index) => (
            <div key={index} className="challenge-activity-draft">
              <label htmlFor={`challenge-day-${index}`}>Dia {activity.day_number}</label>
              <input
                id={`challenge-day-${index}`}
                type="text"
                value={activity.content}
                onChange={(event) => updateActivityDraft(index, event.target.value)}
                placeholder="Ex.: Faça algo que você gosta."
                required
              />
            </div>
          ))}

          <div className="challenge-form-actions">
            <button type="button" onClick={addActivityDraft}>
              + Adicionar dia
            </button>
            {activityDrafts.length > 1 && (
              <button type="button" className="challenge-remove-day" onClick={removeLastActivityDraft}>
                Remover último dia
              </button>
            )}
          </div>

          {createError && <p className="auth-error">{createError}</p>}

          <button type="submit" disabled={creating || !title.trim()}>
            {creating ? 'Salvando...' : 'Criar desafio'}
          </button>
        </form>
      )}

      {loading && <p>Carregando desafios...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && visibleChallenges.length === 0 && (
        <EmptyState message="Nenhum desafio cadastrado ainda." />
      )}

      {!loading &&
        !error &&
        visibleChallenges.map((challenge) => (
          <div key={challenge.id} className="challenge-block">
            {editingId === challenge.id ? (
              <form
                className="challenge-edit-form"
                onSubmit={(event) => handleSaveEdit(event, challenge.id)}
              >
                <label htmlFor={`edit-title-${challenge.id}`}>Título</label>
                <input
                  id={`edit-title-${challenge.id}`}
                  type="text"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  required
                />
                <label htmlFor={`edit-description-${challenge.id}`}>Descrição</label>
                <textarea
                  id={`edit-description-${challenge.id}`}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  rows={2}
                />
                <div className="challenge-item-actions">
                  <button type="button" className="auth-link" onClick={() => setEditingId(null)}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="challenge-save-button"
                    disabled={savingEdit || !editTitle.trim()}
                  >
                    {savingEdit ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <ChallengeCard
                  challenge={challenge}
                  currentDay={currentDays[challenge.id] ?? 1}
                  participantCount={participantCounts[challenge.id] ?? 0}
                  todayCompletedCount={todayCompletedCounts[challenge.id] ?? 0}
                  isParticipating={myParticipation.has(challenge.id)}
                  canParticipate={canParticipate}
                  profileId={profileId}
                  commentCount={commentCounts[challenge.id] ?? 0}
                  comments={commentsByChallenge[challenge.id]}
                  onJoin={() => joinChallenge(challenge.id, profileId)}
                  onProgressChange={() => refreshCounts(challenge.id)}
                  onOpenComments={() => fetchComments(challenge.id)}
                  onAddComment={(content) => addComment(challenge.id, profileId, content)}
                />

                {canManage && (
                  <div className="challenge-item-actions">
                    <button
                      type="button"
                      onClick={() => startEdit(challenge.id, challenge.title, challenge.description)}
                    >
                      Editar
                    </button>
                    <button type="button" onClick={() => toggleActive(challenge.id, !challenge.is_active)}>
                      {challenge.is_active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      type="button"
                      className="challenge-delete-button"
                      onClick={() => deleteChallenge(challenge.id)}
                    >
                      Excluir
                    </button>
                  </div>
                )}

                {!challenge.is_active && (
                  <p className="challenge-inactive-note">Este desafio está desativado.</p>
                )}
              </>
            )}
          </div>
        ))}
    </section>
  )
}
