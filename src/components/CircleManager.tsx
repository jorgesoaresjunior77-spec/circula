import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCircles } from '../hooks/useCircles'
import { CircleCard } from './CircleCard'
import { CoverImageInput } from './CoverImageInput'
import { EmptyState } from './EmptyState'

interface CircleManagerProps {
  communityId: string
  profileId: string
  canManage: boolean
  canParticipate: boolean
}

export function CircleManager({
  communityId,
  profileId,
  canManage,
  canParticipate,
}: CircleManagerProps) {
  const { circles, loading, error, createCircle, renameCircle, deleteCircle, joinCircle, leaveCircle } =
    useCircles(communityId)

  const [name, setName] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCoverImageUrl, setEditCoverImageUrl] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)

    const { error: createErr } = await createCircle(profileId, name, coverImageUrl)

    setCreating(false)

    if (createErr) {
      setCreateError('Não foi possível criar o círculo agora. Tente novamente.')
      return
    }

    setName('')
    setCoverImageUrl('')
  }

  function startEdit(id: string, currentName: string, currentCover: string | null) {
    setEditingId(id)
    setEditName(currentName)
    setEditCoverImageUrl(currentCover ?? '')
  }

  async function handleSaveEdit(event: FormEvent, id: string) {
    event.preventDefault()
    setSavingEdit(true)

    const { error: updateErr } = await renameCircle(id, editName, editCoverImageUrl)

    setSavingEdit(false)

    if (!updateErr) {
      setEditingId(null)
    }
  }

  return (
    <section className="panel-circles">
      <header className="panel-circles-head">
        <p className="panel-circles-title">Painel · Círculos</p>
        <p className="panel-circles-intro">
          Pequenos grupos para criar conexões e compartilhar experiências dentro da comunidade.
        </p>
      </header>

      {canManage && (
        <div className="panel-circles-block">
          <h3 className="panel-circles-eyebrow">Criar um círculo</h3>

          <form onSubmit={handleCreate} className="panel-circles-form">
            <div className="panel-circles-field">
              <label className="panel-circles-label" htmlFor="circle-name">
                Nome do círculo
              </label>
              <input
                id="circle-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Mães"
                required
              />
            </div>

            <CoverImageInput
              id="circle-cover"
              communityId={communityId}
              uid={profileId}
              value={coverImageUrl}
              onChange={setCoverImageUrl}
            />

            {createError && <p className="auth-error">{createError}</p>}

            <div className="panel-circles-form-actions">
              <button
                type="submit"
                className="panel-circles-submit"
                disabled={creating || !name.trim()}
              >
                {creating ? 'Criando...' : 'Criar círculo'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel-circles-block">
        <h3 className="panel-circles-eyebrow">Círculos da comunidade</h3>

        {loading && <p className="panel-circles-muted">Carregando círculos...</p>}

        {!loading && error && <p className="auth-error">{error}</p>}

        {!loading && !error && circles.length === 0 && (
          <EmptyState message="Nenhum círculo cadastrado ainda." />
        )}

        {!loading && !error && circles.length > 0 && (
          <div className="panel-circles-list">
            {circles.map((circle) => (
              <div key={circle.id} className="panel-circles-item">
                {editingId === circle.id ? (
                  <form
                    className="panel-circles-form panel-circles-edit"
                    onSubmit={(event) => handleSaveEdit(event, circle.id)}
                  >
                    <div className="panel-circles-field">
                      <label className="panel-circles-label" htmlFor={`edit-circle-${circle.id}`}>
                        Nome
                      </label>
                      <input
                        id={`edit-circle-${circle.id}`}
                        type="text"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        required
                      />
                    </div>

                    <CoverImageInput
                      id={`edit-circle-cover-${circle.id}`}
                      communityId={communityId}
                      uid={profileId}
                      value={editCoverImageUrl}
                      onChange={setEditCoverImageUrl}
                    />

                    <div className="panel-circles-form-actions">
                      <button
                        type="button"
                        className="panel-circles-action"
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="panel-circles-action panel-circles-action--primary"
                        disabled={savingEdit || !editName.trim()}
                      >
                        {savingEdit ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <CircleCard
                      circle={circle}
                      isParticipating={circle.members.some((member) => member.profile_id === profileId)}
                      canParticipate={canParticipate}
                      onJoin={() => joinCircle(circle.id, profileId)}
                      onLeave={() => leaveCircle(circle.id, profileId)}
                    />

                    {canManage && (
                      <div className="panel-circles-item-actions">
                        <button
                          type="button"
                          className="panel-circles-action"
                          onClick={() => startEdit(circle.id, circle.name, circle.cover_image_url)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="panel-circles-action panel-circles-action--delete"
                          onClick={() => deleteCircle(circle.id)}
                        >
                          Excluir
                        </button>
                      </div>
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
