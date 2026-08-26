import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCircles } from '../hooks/useCircles'
import { CircleCard } from './CircleCard'
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
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)

    const { error: createErr } = await createCircle(profileId, name)

    setCreating(false)

    if (createErr) {
      setCreateError('Não foi possível criar o círculo agora. Tente novamente.')
      return
    }

    setName('')
  }

  function startEdit(id: string, currentName: string) {
    setEditingId(id)
    setEditName(currentName)
  }

  async function handleSaveEdit(event: FormEvent, id: string) {
    event.preventDefault()
    setSavingEdit(true)

    const { error: updateErr } = await renameCircle(id, editName)

    setSavingEdit(false)

    if (!updateErr) {
      setEditingId(null)
    }
  }

  return (
    <section className="community-card community-card--quiet circle-manager">
      <h3>Círculos da comunidade</h3>

      {canManage && (
        <form onSubmit={handleCreate} className="circle-form">
          <label htmlFor="circle-name">Nome do círculo</label>
          <input
            id="circle-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Mães"
            required
          />

          {createError && <p className="auth-error">{createError}</p>}

          <button type="submit" disabled={creating || !name.trim()}>
            {creating ? 'Criando...' : 'Criar círculo'}
          </button>
        </form>
      )}

      {loading && <p>Carregando círculos...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && circles.length === 0 && (
        <EmptyState message="Nenhum círculo cadastrado ainda." />
      )}

      {!loading &&
        !error &&
        circles.map((circle) => (
          <div key={circle.id} className="circle-block">
            {editingId === circle.id ? (
              <form className="circle-edit-form" onSubmit={(event) => handleSaveEdit(event, circle.id)}>
                <label htmlFor={`edit-circle-${circle.id}`}>Nome</label>
                <input
                  id={`edit-circle-${circle.id}`}
                  type="text"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  required
                />
                <div className="challenge-item-actions">
                  <button type="button" className="auth-link" onClick={() => setEditingId(null)}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="challenge-save-button"
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
                  <div className="challenge-item-actions">
                    <button type="button" onClick={() => startEdit(circle.id, circle.name)}>
                      Renomear
                    </button>
                    <button
                      type="button"
                      className="challenge-delete-button"
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
    </section>
  )
}
