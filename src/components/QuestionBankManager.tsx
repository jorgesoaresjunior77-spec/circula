import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuestions } from '../hooks/useQuestions'
import { EmptyState } from './EmptyState'

interface QuestionBankManagerProps {
  communityId: string
  authorId: string
  canManage: boolean
  onPublished?: () => void
}

export function QuestionBankManager({
  communityId,
  authorId,
  canManage,
  onPublished,
}: QuestionBankManagerProps) {
  const {
    questions,
    loading,
    error,
    createQuestion,
    updateQuestion,
    toggleActive,
    deleteQuestion,
    publishDailyQuestion,
  } = useQuestions(communityId)

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

  const activeCount = questions.filter((question) => question.is_active).length

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)

    const { error: createErr } = await createQuestion(authorId, newContent)

    setCreating(false)

    if (createErr) {
      setCreateError('Não foi possível salvar a pergunta agora. Tente novamente.')
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

    const { error: updateErr } = await updateQuestion(id, editContent)

    setSavingEdit(false)

    if (!updateErr) {
      setEditingId(null)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    setPublishMessage(null)

    const { error: publishError } = await publishDailyQuestion()

    setPublishing(false)

    if (publishError) {
      setPublishMessage({ type: 'error', text: publishError })
      return
    }

    setPublishMessage({ type: 'success', text: 'Pergunta do dia publicada no feed.' })
    onPublished?.()
  }

  return (
    <section className="community-card community-card--quiet question-bank">
      <h3>Perguntas da comunidade</h3>

      {canManage && (
        <button type="button" onClick={handlePublish} disabled={publishing || activeCount === 0}>
          {publishing ? 'Publicando...' : 'Publicar pergunta do dia agora'}
        </button>
      )}

      {canManage && activeCount === 0 && !loading && (
        <p className="question-empty">
          Cadastre pelo menos uma pergunta ativa para poder publicar.
        </p>
      )}

      {publishMessage && (
        <p className={publishMessage.type === 'success' ? 'auth-success' : 'auth-error'}>
          {publishMessage.text}
        </p>
      )}

      {canManage && (
        <form onSubmit={handleCreate} className="question-form">
          <label htmlFor="new-question">Nova pergunta</label>
          <textarea
            id="new-question"
            value={newContent}
            onChange={(event) => setNewContent(event.target.value)}
            rows={2}
            placeholder="Ex.: Qual foi uma pequena vitória sua esta semana?"
            required
          />
          {createError && <p className="auth-error">{createError}</p>}
          <button type="submit" disabled={creating || !newContent.trim()}>
            {creating ? 'Salvando...' : 'Adicionar pergunta'}
          </button>
        </form>
      )}

      {loading && <p>Carregando perguntas...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && questions.length === 0 && (
        <EmptyState message="Nenhuma pergunta cadastrada ainda." />
      )}

      {!loading && !error && questions.length > 0 && (
        <ul className="question-list">
          {questions.map((question) => (
            <li key={question.id} className="question-item">
              {editingId === question.id ? (
                <form
                  className="question-edit-form"
                  onSubmit={(event) => handleSaveEdit(event, question.id)}
                >
                  <textarea
                    value={editContent}
                    onChange={(event) => setEditContent(event.target.value)}
                    rows={2}
                    required
                  />
                  <div className="question-item-actions">
                    <button
                      type="button"
                      className="auth-link"
                      onClick={() => setEditingId(null)}
                    >
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
                      question.is_active ? '' : ' question-content--inactive'
                    }`}
                  >
                    {question.content}
                  </p>

                  {canManage ? (
                    <div className="question-item-actions">
                      <button
                        type="button"
                        onClick={() => startEdit(question.id, question.content)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(question.id, !question.is_active)}
                      >
                        {question.is_active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        type="button"
                        className="question-delete-button"
                        onClick={() => deleteQuestion(question.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`question-status-badge${
                        question.is_active ? '' : ' question-status-badge--inactive'
                      }`}
                    >
                      {question.is_active ? 'Ativa' : 'Inativa'}
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
