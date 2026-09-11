import { useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { useChallenges } from '../hooks/useChallenges'
import { todayIsoDate } from '../lib/challengePeriod'
import type { ChallengeActivityDraft, ChallengeWithActivities } from '../types/challenge'
import { ChallengeCard } from './ChallengeCard'
import { CoverImageInput } from './CoverImageInput'
import { EmptyState } from './EmptyState'

interface ChallengeManagerProps {
  communityId: string
  profileId: string
  canManage: boolean
  canParticipate: boolean
}

type DraftSetter = Dispatch<SetStateAction<ChallengeActivityDraft[]>>

function addDayDraft(setDrafts: DraftSetter) {
  setDrafts((prev) => [...prev, { day_number: prev.length + 1, content: '' }])
}

function removeLastDayDraft(setDrafts: DraftSetter) {
  setDrafts((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
}

function updateDayDraft(setDrafts: DraftSetter, index: number, content: string) {
  setDrafts((prev) => prev.map((activity, i) => (i === index ? { ...activity, content } : activity)))
}

/** Renumera 1..N (garante day_number sequencial apos remocoes). */
function sequential(drafts: ChallengeActivityDraft[]): ChallengeActivityDraft[] {
  return drafts.map((draft, index) => ({ ...draft, day_number: index + 1 }))
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
    myCompletions,
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
    refreshCompletions,
    fetchComments,
    addComment,
  } = useChallenges(communityId, profileId)

  // ----- criacao -----
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [startsOn, setStartsOn] = useState(todayIsoDate())
  const [completionPoints, setCompletionPoints] = useState(0)
  const [perDayPoints, setPerDayPoints] = useState(0)
  const [activityDrafts, setActivityDrafts] = useState<ChallengeActivityDraft[]>([
    { day_number: 1, content: '' },
  ])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // ----- edicao -----
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCoverUrl, setEditCoverUrl] = useState('')
  const [editStartsOn, setEditStartsOn] = useState(todayIsoDate())
  const [editCompletionPoints, setEditCompletionPoints] = useState(0)
  const [editPerDayPoints, setEditPerDayPoints] = useState(0)
  const [editActivityDrafts, setEditActivityDrafts] = useState<ChallengeActivityDraft[]>([])
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  function resetCreateForm() {
    setTitle('')
    setDescription('')
    setCoverUrl('')
    setStartsOn(todayIsoDate())
    setCompletionPoints(0)
    setPerDayPoints(0)
    setActivityDrafts([{ day_number: 1, content: '' }])
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()

    if (activityDrafts.some((activity) => !activity.content.trim())) {
      setCreateError('Preencha o texto de todos os dias antes de salvar.')
      return
    }

    setCreating(true)
    setCreateError(null)

    const { error: createErr } = await createChallenge(
      profileId,
      {
        title,
        description,
        coverImageUrl: coverUrl,
        startsOn,
        completionPoints,
        perDayPoints,
      },
      sequential(activityDrafts).map((draft) => ({
        day_number: draft.day_number,
        content: draft.content.trim(),
      })),
    )

    setCreating(false)

    if (createErr) {
      setCreateError('Não foi possível salvar o desafio agora. Tente novamente.')
      return
    }

    resetCreateForm()
  }

  function startEdit(challenge: ChallengeWithActivities) {
    setEditingId(challenge.id)
    setEditTitle(challenge.title)
    setEditDescription(challenge.description ?? '')
    setEditCoverUrl(challenge.cover_image_url ?? '')
    setEditStartsOn(challenge.starts_on)
    setEditCompletionPoints(challenge.completion_points)
    setEditPerDayPoints(challenge.per_day_points)
    setEditActivityDrafts(
      challenge.activities.map((activity) => ({
        id: activity.id,
        day_number: activity.day_number,
        content: activity.content,
      })),
    )
    setEditError(null)
  }

  async function handleSaveEdit(event: FormEvent, id: string) {
    event.preventDefault()

    if (editActivityDrafts.some((activity) => !activity.content.trim())) {
      setEditError('Preencha o texto de todos os dias antes de salvar.')
      return
    }

    setSavingEdit(true)
    setEditError(null)

    const { error: updateErr } = await updateChallenge(
      id,
      {
        title: editTitle,
        description: editDescription,
        coverImageUrl: editCoverUrl,
        startsOn: editStartsOn,
        completionPoints: editCompletionPoints,
        perDayPoints: editPerDayPoints,
      },
      sequential(editActivityDrafts).map((draft) => ({
        id: draft.id,
        day_number: draft.day_number,
        content: draft.content.trim(),
      })),
    )

    setSavingEdit(false)

    if (updateErr) {
      setEditError(updateErr)
      return
    }

    setEditingId(null)
  }

  const visibleChallenges =
    !canManage && canParticipate ? challenges.filter((challenge) => challenge.is_active) : challenges

  return (
    <section className="panel-challenges">
      <header className="panel-challenges-head">
        <p className="panel-challenges-title">Painel · Desafios</p>
        <p className="panel-challenges-intro">
          Programas de alguns dias, com uma atividade por dia. Você acompanha quem entrou e quem
          concluiu cada dia.
        </p>
      </header>

      {canManage && (
        <div className="panel-challenges-block">
          <h3 className="panel-challenges-eyebrow">Criar um desafio</h3>

          <form onSubmit={handleCreate} className="panel-challenges-form">
            <div className="panel-challenges-form-group">
              <p className="panel-challenges-form-group-title">O desafio</p>

              <div className="panel-challenges-field">
                <label className="panel-challenges-label" htmlFor="challenge-title">
                  Título do desafio
                </label>
                <input
                  id="challenge-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </div>

              <div className="panel-challenges-field">
                <label className="panel-challenges-label" htmlFor="challenge-description">
                  Descrição (opcional)
                </label>
                <textarea
                  id="challenge-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                />
              </div>

              <CoverImageInput
                id="challenge-cover"
                label="Foto de capa (opcional)"
                value={coverUrl}
                onChange={setCoverUrl}
                communityId={communityId}
                uid={profileId}
                disabled={creating}
              />
            </div>

            <div className="panel-challenges-form-group">
              <p className="panel-challenges-form-group-title">Período e pontos</p>

              <div className="panel-challenges-field">
                <label className="panel-challenges-label" htmlFor="challenge-starts-on">
                  Data de início
                </label>
                <input
                  id="challenge-starts-on"
                  type="date"
                  value={startsOn}
                  onChange={(event) => setStartsOn(event.target.value || todayIsoDate())}
                  required
                />
              </div>

              <div className="panel-challenges-form-row">
                <div className="panel-challenges-field">
                  <label className="panel-challenges-label" htmlFor="challenge-completion-points">
                    Pontos de conclusão
                  </label>
                  <input
                    id="challenge-completion-points"
                    type="number"
                    min={0}
                    step={1}
                    value={completionPoints}
                    onChange={(event) =>
                      setCompletionPoints(Math.max(0, Number(event.target.value) || 0))
                    }
                  />
                </div>
                <div className="panel-challenges-field">
                  <label className="panel-challenges-label" htmlFor="challenge-per-day-points">
                    Pontos por dia
                  </label>
                  <input
                    id="challenge-per-day-points"
                    type="number"
                    min={0}
                    step={1}
                    value={perDayPoints}
                    onChange={(event) =>
                      setPerDayPoints(Math.max(0, Number(event.target.value) || 0))
                    }
                  />
                </div>
              </div>

              <p className="panel-challenges-hint">
                A pontuação entra em vigor numa próxima etapa. Por enquanto estes valores só ficam guardados.
              </p>
            </div>

            <div className="panel-challenges-form-group">
              <p className="panel-challenges-form-group-title">Atividades por dia</p>

              {activityDrafts.map((activity, index) => (
                <div key={index} className="panel-challenges-day">
                  <label className="panel-challenges-day-label" htmlFor={`challenge-day-${index}`}>
                    Dia {index + 1}
                  </label>
                  <input
                    id={`challenge-day-${index}`}
                    type="text"
                    value={activity.content}
                    onChange={(event) => updateDayDraft(setActivityDrafts, index, event.target.value)}
                    placeholder="Ex.: Beber 2 litros de água."
                    required
                  />
                </div>
              ))}

              <div className="panel-challenges-day-actions">
                <button
                  type="button"
                  className="panel-challenges-action"
                  onClick={() => addDayDraft(setActivityDrafts)}
                >
                  + Adicionar dia
                </button>
                {activityDrafts.length > 1 && (
                  <button
                    type="button"
                    className="panel-challenges-action panel-challenges-action--muted"
                    onClick={() => removeLastDayDraft(setActivityDrafts)}
                  >
                    Remover último dia
                  </button>
                )}
              </div>
            </div>

            {createError && <p className="auth-error">{createError}</p>}

            <div className="panel-challenges-form-actions">
              <button
                type="submit"
                className="panel-challenges-submit"
                disabled={creating || !title.trim()}
              >
                {creating ? 'Salvando...' : 'Criar desafio'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel-challenges-block">
        <h3 className="panel-challenges-eyebrow">Desafios da comunidade</h3>

        {loading && <p className="panel-challenges-muted">Carregando desafios...</p>}

        {!loading && error && <p className="auth-error">{error}</p>}

        {!loading && !error && visibleChallenges.length === 0 && (
          <EmptyState message="Nenhum desafio cadastrado ainda." />
        )}

        {!loading && !error && visibleChallenges.length > 0 && (
          <div className="panel-challenges-list">
            {visibleChallenges.map((challenge) => (
              <div
                key={challenge.id}
                className={`panel-challenges-item${
                  challenge.is_active ? '' : ' panel-challenges-item--inactive'
                }`}
              >
                {editingId === challenge.id ? (
                  <form
                    className="panel-challenges-form panel-challenges-edit"
                    onSubmit={(event) => handleSaveEdit(event, challenge.id)}
                  >
                    <div className="panel-challenges-form-group">
                      <p className="panel-challenges-form-group-title">O desafio</p>

                      <div className="panel-challenges-field">
                        <label
                          className="panel-challenges-label"
                          htmlFor={`edit-title-${challenge.id}`}
                        >
                          Título
                        </label>
                        <input
                          id={`edit-title-${challenge.id}`}
                          type="text"
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          required
                        />
                      </div>

                      <div className="panel-challenges-field">
                        <label
                          className="panel-challenges-label"
                          htmlFor={`edit-description-${challenge.id}`}
                        >
                          Descrição
                        </label>
                        <textarea
                          id={`edit-description-${challenge.id}`}
                          value={editDescription}
                          onChange={(event) => setEditDescription(event.target.value)}
                          rows={2}
                        />
                      </div>

                      <CoverImageInput
                        id={`edit-cover-${challenge.id}`}
                        label="Foto de capa (opcional)"
                        value={editCoverUrl}
                        onChange={setEditCoverUrl}
                        communityId={communityId}
                        uid={profileId}
                        disabled={savingEdit}
                      />
                    </div>

                    <div className="panel-challenges-form-group">
                      <p className="panel-challenges-form-group-title">Período e pontos</p>

                      <div className="panel-challenges-field">
                        <label
                          className="panel-challenges-label"
                          htmlFor={`edit-starts-on-${challenge.id}`}
                        >
                          Data de início
                        </label>
                        <input
                          id={`edit-starts-on-${challenge.id}`}
                          type="date"
                          value={editStartsOn}
                          onChange={(event) =>
                            setEditStartsOn(event.target.value || todayIsoDate())
                          }
                          required
                        />
                      </div>

                      <div className="panel-challenges-form-row">
                        <div className="panel-challenges-field">
                          <label
                            className="panel-challenges-label"
                            htmlFor={`edit-completion-points-${challenge.id}`}
                          >
                            Pontos de conclusão
                          </label>
                          <input
                            id={`edit-completion-points-${challenge.id}`}
                            type="number"
                            min={0}
                            step={1}
                            value={editCompletionPoints}
                            onChange={(event) =>
                              setEditCompletionPoints(Math.max(0, Number(event.target.value) || 0))
                            }
                          />
                        </div>
                        <div className="panel-challenges-field">
                          <label
                            className="panel-challenges-label"
                            htmlFor={`edit-per-day-points-${challenge.id}`}
                          >
                            Pontos por dia
                          </label>
                          <input
                            id={`edit-per-day-points-${challenge.id}`}
                            type="number"
                            min={0}
                            step={1}
                            value={editPerDayPoints}
                            onChange={(event) =>
                              setEditPerDayPoints(Math.max(0, Number(event.target.value) || 0))
                            }
                          />
                        </div>
                      </div>

                      <p className="panel-challenges-hint">
                        A pontuação entra em vigor numa próxima etapa. Por enquanto estes valores só ficam guardados.
                      </p>
                    </div>

                    <div className="panel-challenges-form-group">
                      <p className="panel-challenges-form-group-title">Atividades por dia</p>

                      {editActivityDrafts.map((activity, index) => (
                        <div key={activity.id ?? `new-${index}`} className="panel-challenges-day">
                          <label
                            className="panel-challenges-day-label"
                            htmlFor={`edit-day-${challenge.id}-${index}`}
                          >
                            Dia {index + 1}
                          </label>
                          <input
                            id={`edit-day-${challenge.id}-${index}`}
                            type="text"
                            value={activity.content}
                            onChange={(event) =>
                              updateDayDraft(setEditActivityDrafts, index, event.target.value)
                            }
                            placeholder="Ex.: Caminhar 30 minutos."
                            required
                          />
                        </div>
                      ))}

                      <div className="panel-challenges-day-actions">
                        <button
                          type="button"
                          className="panel-challenges-action"
                          onClick={() => addDayDraft(setEditActivityDrafts)}
                        >
                          + Adicionar dia
                        </button>
                        {editActivityDrafts.length > 1 && (
                          <button
                            type="button"
                            className="panel-challenges-action panel-challenges-action--muted"
                            onClick={() => removeLastDayDraft(setEditActivityDrafts)}
                          >
                            Remover último dia
                          </button>
                        )}
                      </div>
                    </div>

                    {editError && <p className="auth-error">{editError}</p>}

                    <div className="panel-challenges-form-actions">
                      <button
                        type="button"
                        className="panel-challenges-action"
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="panel-challenges-action panel-challenges-action--primary"
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
                      isCompleted={myCompletions.has(challenge.id)}
                      canParticipate={canParticipate}
                      profileId={profileId}
                      commentCount={commentCounts[challenge.id] ?? 0}
                      comments={commentsByChallenge[challenge.id]}
                      onJoin={() => joinChallenge(challenge.id, profileId)}
                      onProgressChange={() => refreshCounts(challenge.id)}
                      onCompletionChange={() => refreshCompletions(challenge.id)}
                      onOpenComments={() => fetchComments(challenge.id)}
                      onAddComment={(content) => addComment(challenge.id, profileId, content)}
                    />

                    {canManage && (
                      <div className="panel-challenges-item-actions">
                        {!challenge.is_active && (
                          <span className="panel-challenges-flag">Inativo</span>
                        )}
                        <button
                          type="button"
                          className="panel-challenges-action"
                          onClick={() => startEdit(challenge)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="panel-challenges-action"
                          onClick={() => toggleActive(challenge.id, !challenge.is_active)}
                        >
                          {challenge.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          className="panel-challenges-action panel-challenges-action--delete"
                          onClick={() => deleteChallenge(challenge.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    )}

                    {!challenge.is_active && (
                      <p className="panel-challenges-inactive-note">
                        Este desafio está desativado.
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
