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
    <>
      {/* Cabeçalho da aba Conteúdo (a aba renderiza os 5 gerenciadores;
          o cabeçalho vive aqui, no primeiro deles — só markup). */}
      <header className="panel-content-head">
        <p className="panel-content-title">Painel · Conteúdo</p>
        <p className="panel-content-intro">
          Aqui você organiza tudo o que a sua comunidade recebe — perguntas do dia, biblioteca,
          check-ins, mensagens de acolhimento e comandos de engajamento.
        </p>
      </header>

      <section className="panel-content-block panel-content-questions">
        <div className="panel-content-block-head">
          <h3 className="panel-content-eyebrow">Perguntas da comunidade</h3>
          {canManage && (
            <button
              type="button"
              className="panel-content-publish"
              onClick={handlePublish}
              disabled={publishing || activeCount === 0}
            >
              {publishing ? 'Publicando...' : 'Publicar pergunta do dia agora'}
            </button>
          )}
        </div>

        {canManage && activeCount === 0 && !loading && (
          <p className="panel-content-notice">
            Cadastre pelo menos uma pergunta ativa para poder publicar.
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
              <label className="panel-content-label" htmlFor="new-question">
                Nova pergunta
              </label>
              <textarea
                id="new-question"
                value={newContent}
                onChange={(event) => setNewContent(event.target.value)}
                rows={2}
                placeholder="Ex.: Qual foi uma pequena vitória sua esta semana?"
                required
              />
            </div>
            {createError && <p className="auth-error">{createError}</p>}
            <div className="panel-content-form-actions">
              <button
                type="submit"
                className="panel-content-submit"
                disabled={creating || !newContent.trim()}
              >
                {creating ? 'Salvando...' : 'Adicionar pergunta'}
              </button>
            </div>
          </form>
        )}

        {loading && <p className="panel-content-muted">Carregando perguntas...</p>}

        {!loading && error && <p className="auth-error">{error}</p>}

        {!loading && !error && questions.length === 0 && (
          <EmptyState message="Nenhuma pergunta cadastrada ainda." />
        )}

        {!loading && !error && questions.length > 0 && (
          <ul className="panel-content-list">
            {questions.map((question) => (
              <li key={question.id} className="panel-content-row">
                {editingId === question.id ? (
                  <form
                    className="panel-content-edit"
                    onSubmit={(event) => handleSaveEdit(event, question.id)}
                  >
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
                        disabled={savingEdit || !editContent.trim()}
                      >
                        {savingEdit ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p
                      className={`panel-content-row-text${
                        question.is_active ? '' : ' panel-content-row-text--inactive'
                      }`}
                    >
                      {question.content}
                    </p>

                    {canManage ? (
                      <div className="panel-content-row-actions">
                        <button
                          type="button"
                          className="panel-content-action"
                          onClick={() => startEdit(question.id, question.content)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="panel-content-action"
                          onClick={() => toggleActive(question.id, !question.is_active)}
                        >
                          {question.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          className="panel-content-action panel-content-action--delete"
                          onClick={() => deleteQuestion(question.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`panel-content-state${
                          question.is_active ? '' : ' panel-content-state--inactive'
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
    </>
  )
}
