import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCircles } from '../hooks/useCircles'
import { CircleCard } from './CircleCard'
import { CoverImageInput } from './CoverImageInput'
import { EmptyState } from './EmptyState'
import { CircleRequestReview } from './CircleRequestReview'
import { NewCircleCoverField } from './NewCircleCoverField'

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
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCoverImageUrl, setEditCoverImageUrl] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)

    const { error: createErr } = await createCircle(profileId, name, coverImageUrl, description)

    setCreating(false)

    if (createErr) {
      setCreateError('Não foi possível criar o círculo agora. Tente novamente.')
      return
    }

    setName('')
    setCoverImageUrl('')
    setDescription('')
  }

  function startEdit(id: string, currentName: string, currentCover: string | null, currentDescription?: string | null) {
    setEditDescription(currentDescription ?? '')
    setEditingId(id)
    setEditName(currentName)
    setEditCoverImageUrl(currentCover ?? '')
  }

  async function handleSaveEdit(event: FormEvent, id: string) {
    event.preventDefault()
    setSavingEdit(true)

    const { error: updateErr } = await renameCircle(id, editName, editCoverImageUrl, editDescription)

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
          {/* Etapa 5.3 (evolução/gamificação) — solicitações de novo
              Círculo enviadas pelas participantes, antes do formulário de
              criação de sempre (a sugestão só inspira; criar o Círculo de
              verdade continua manual, abaixo). */}
          <div id="circle-requests-review">
            <CircleRequestReview communityId={communityId} profileId={profileId} />
          </div>

          <h3 className="panel-circles-eyebrow">Card "Novo Círculo"</h3>
          <p className="panel-circles-intro">
            Imagem do card que convida as participantes a sugerir um grupo, no começo dos círculos da Home.
          </p>
          <NewCircleCoverField communityId={communityId} profileId={profileId} />

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

            <div className="panel-circles-field">
              <label className="panel-circles-label" htmlFor="circle-description">
                Descrição (quem ainda não entrou lê isto)
              </label>
              <textarea
                id="circle-description"
                rows={3}
                maxLength={600}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Sobre o que é este círculo e para quem é."
              />
            </div>

            <CoverImageInput
              id="circle-cover"
              communityId={communityId}
              uid={profileId}
              value={coverImageUrl}
              onChange={setCoverImageUrl}
              aspectRatio="4 / 5"
              recommendedSize="1080 × 1350 px"
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

                    <div className="panel-circles-field">
                      <label className="panel-circles-label" htmlFor={`edit-circle-description-${circle.id}`}>
                        Descrição
                      </label>
                      <textarea
                        id={`edit-circle-description-${circle.id}`}
                        rows={3}
                        maxLength={600}
                        value={editDescription}
                        onChange={(event) => setEditDescription(event.target.value)}
                      />
                    </div>

                    <CoverImageInput
                      id={`edit-circle-cover-${circle.id}`}
                      communityId={communityId}
                      uid={profileId}
                      value={editCoverImageUrl}
                      onChange={setEditCoverImageUrl}
                      aspectRatio="4 / 5"
                      recommendedSize="1080 × 1350 px"
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
                          onClick={() => startEdit(circle.id, circle.name, circle.cover_image_url, circle.description)}
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
