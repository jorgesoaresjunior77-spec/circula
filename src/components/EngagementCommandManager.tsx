import { useState } from 'react'
import type { FormEvent } from 'react'
import { useEngagementCommands } from '../hooks/useEngagementCommands'
import { EmptyState } from './EmptyState'

interface EngagementCommandManagerProps {
  communityId: string
  authorId: string
  canManage: boolean
  onPublished?: () => void
}

export function EngagementCommandManager({
  communityId,
  authorId,
  canManage,
  onPublished,
}: EngagementCommandManagerProps) {
  const {
    commands,
    loading,
    error,
    createCommand,
    updateCommand,
    toggleActive,
    deleteCommand,
    publishEngagementCommand,
  } = useEngagementCommands(communityId)

  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [publishing, setPublishing] = useState(false)
  const [publishMessage, setPublishMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const activeCount = commands.filter((command) => command.is_active).length

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)

    const { error: createErr } = await createCommand(authorId, newTitle, newContent)

    setCreating(false)

    if (createErr) {
      setCreateError('Não foi possível salvar o comando agora. Tente novamente.')
      return
    }

    setNewTitle('')
    setNewContent('')
  }

  function startEdit(id: string, title: string, content: string) {
    setEditingId(id)
    setEditTitle(title)
    setEditContent(content)
  }

  async function handleSaveEdit(event: FormEvent, id: string) {
    event.preventDefault()
    setSavingEdit(true)

    const { error: updateErr } = await updateCommand(id, editTitle, editContent)

    setSavingEdit(false)

    if (!updateErr) {
      setEditingId(null)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    setPublishMessage(null)

    const { error: publishError } = await publishEngagementCommand()

    setPublishing(false)

    if (publishError) {
      setPublishMessage({ type: 'error', text: publishError })
      return
    }

    setPublishMessage({ type: 'success', text: 'Comando publicado no feed.' })
    onPublished?.()
  }

  return (
    <section className="panel-content-block panel-content-commands">
      <div className="panel-content-block-head">
        <h3 className="panel-content-eyebrow">Comandos de engajamento</h3>
        {canManage && (
          <button
            type="button"
            className="panel-content-publish"
            onClick={handlePublish}
            disabled={publishing || activeCount === 0}
          >
            {publishing ? 'Publicando...' : 'Publicar comando agora'}
          </button>
        )}
      </div>

      {canManage && activeCount === 0 && !loading && (
        <p className="panel-content-notice">
          Cadastre pelo menos um comando ativo para poder publicar.
        </p>
      )}

      {publishMessage && (
        <p className={publishMessage.type === 'success' ? 'auth-success' : 'auth-error'}>
          {publishMessage.text}
        </p>
      )}

      {canManage && (
        <form onSubmit={handleCreate} className="panel-content-form">
          <div className="panel-content-field">
            <label className="panel-content-label" htmlFor="new-command-title">
              Título do comando
            </label>
            <input
              id="new-command-title"
              type="text"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Ex.: Compartilhe sua vitória"
              required
            />
          </div>
          <div className="panel-content-field">
            <label className="panel-content-label" htmlFor="new-command-content">
              Texto do comando
            </label>
            <textarea
              id="new-command-content"
              value={newContent}
              onChange={(event) => setNewContent(event.target.value)}
              rows={2}
              placeholder="Ex.: O que você conseguiu fazer esta semana e está orgulhosa?"
              required
            />
          </div>
          {createError && <p className="auth-error">{createError}</p>}
          <div className="panel-content-form-actions">
            <button
              type="submit"
              className="panel-content-submit"
              disabled={creating || !newTitle.trim() || !newContent.trim()}
            >
              {creating ? 'Salvando...' : 'Adicionar comando'}
            </button>
          </div>
        </form>
      )}

      {loading && <p className="panel-content-muted">Carregando comandos...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && commands.length === 0 && (
        <EmptyState message="Nenhum comando cadastrado ainda." />
      )}

      {!loading && !error && commands.length > 0 && (
        <ul className="panel-content-list">
          {commands.map((command) => (
            <li key={command.id} className="panel-content-row">
              {editingId === command.id ? (
                <form
                  className="panel-content-edit"
                  onSubmit={(event) => handleSaveEdit(event, command.id)}
                >
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    required
                  />
                  <textarea
                    value={editContent}
                    onChange={(event) => setEditContent(event.target.value)}
                    rows={2}
                    required
                  />
                  <div className="panel-content-row-actions">
                    <button
                      type="button"
                      className="panel-content-action"
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="panel-content-action panel-content-action--primary"
                      disabled={savingEdit || !editTitle.trim() || !editContent.trim()}
                    >
                      {savingEdit ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p
                    className={`panel-content-row-title${
                      command.is_active ? '' : ' panel-content-row-text--inactive'
                    }`}
                  >
                    {command.title}
                  </p>
                  <p
                    className={`panel-content-row-text${
                      command.is_active ? '' : ' panel-content-row-text--inactive'
                    }`}
                  >
                    {command.content}
                  </p>

                  {canManage ? (
                    <div className="panel-content-row-actions">
                      <button
                        type="button"
                        className="panel-content-action"
                        onClick={() => startEdit(command.id, command.title, command.content)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="panel-content-action"
                        onClick={() => toggleActive(command.id, !command.is_active)}
                      >
                        {command.is_active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        type="button"
                        className="panel-content-action panel-content-action--delete"
                        onClick={() => deleteCommand(command.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`panel-content-state${
                        command.is_active ? '' : ' panel-content-state--inactive'
                      }`}
                    >
                      {command.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
