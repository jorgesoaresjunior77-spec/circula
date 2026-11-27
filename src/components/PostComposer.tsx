import { MODERATION_MESSAGE } from '../lib/moderation'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { CreatePostResult } from '../types/post'
import { EmojiPicker } from './EmojiPicker'
import { FeedPhotoCropper } from './FeedPhotoCropper'
import { cleanPollOptions } from '../lib/pollStore'
import type { PollDraft } from '../lib/pollStore'

// Mensagem clara para cada falha de envio da foto (antes era sempre a mesma).
export function uploadErrorMessage(raw: string | null): string {
  const e = (raw ?? '').toLowerCase()
  if (/5 mb|15 mb|too large|exceeded|payload/.test(e)) return 'A foto ficou grande demais. Tente outra foto ou um recorte menor.'
  if (/jpg|png|webp|mime|preparar/.test(e)) return 'Não foi possível ler essa foto. Use uma foto JPG, PNG ou WebP.'
  if (/sess[aã]o|jwt|auth/.test(e)) return 'Sua sessão expirou. Entre de novo para publicar a foto.'
  if (/row-level|policy|permission|unauthorized|403/.test(e)) return 'Você ainda não pode publicar fotos nesta comunidade (a entrada pode estar aguardando aprovação).'
  if (/network|fetch|failed/.test(e)) return 'Sem conexão no momento. Confira a internet e tente de novo.'
  return 'Não foi possível enviar a foto agora. Tente novamente.'
}

interface PostComposerProps {
  onPublish: (content: string, imageUrl: string | null, poll?: PollDraft | null) => Promise<CreatePostResult>
  /** Mostra o botão de criar enquete (Feed e Círculos). */
  allowPoll?: boolean
  onUploadImage: (file: File) => Promise<{ url: string | null; error: string | null }>
  /** Ex.: "Publicando no círculo Corrida de Rua" — só aparece se definido. */
  contextLabel?: string
  /** Só apresentação: identidade de quem publica, para o avatar do convite. */
  authorName?: string | null
  authorAvatarUrl?: string | null
}

export function PostComposer({
  onPublish,
  onUploadImage,
  contextLabel,
  authorName,
  authorAvatarUrl,
  allowPoll = true,
}: PostComposerProps) {
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  // Foto escolhida, esperando o recorte 4:5 (estilo Instagram).
  const [cropping, setCropping] = useState<File | null>(null)
  // Enquete (opcional): a pergunta é o texto da publicação.
  const [pollOpen, setPollOpen] = useState(false)
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [pollMultiple, setPollMultiple] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Só apresentação: a linha-convite abre o formulário de sempre — nada
  // muda em validação/submit/upload, só quando o formulário fica visível.
  const [expanded, setExpanded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)
    setCropping(file)
  }

  function applyCroppedImage(file: File) {
    setCropping(null)
    setImageFile(file)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    let poll: PollDraft | null = null
    if (pollOpen) {
      const options = cleanPollOptions(pollOptions)
      if (options.length < 2) {
        setLoading(false)
        setError('A enquete precisa de pelo menos 2 opções diferentes.')
        return
      }
      poll = { options, allowMultiple: pollMultiple }
    }

    let imageUrl: string | null = null

    if (imageFile) {
      const upload = await onUploadImage(imageFile)
      if (upload.error || !upload.url) {
        setLoading(false)
        setError(uploadErrorMessage(upload.error))
        return
      }
      imageUrl = upload.url
    }

    const { error: publishError } = await onPublish(content, imageUrl, poll)

    setLoading(false)

    if (publishError) {
      setError(publishError === MODERATION_MESSAGE ? MODERATION_MESSAGE : 'Não foi possível publicar agora. Tente novamente.')
      return
    }

    setContent('')
    removeImage()
    setPollOpen(false)
    setPollOptions(['', ''])
    setPollMultiple(false)
    setExpanded(false)
  }

  function openComposer() {
    setExpanded(true)
  }

  useEffect(() => {
    if (expanded) textareaRef.current?.focus()
  }, [expanded])

  const authorInitial = (authorName ?? 'Você').charAt(0).toUpperCase()

  return (
    <section className="community-card post-composer">
      {!expanded && (
        <div className="post-composer-invite">
          <span className="post-composer-avatar" aria-hidden="true">
            {authorAvatarUrl ? <img loading="lazy" decoding="async" src={authorAvatarUrl} alt="" /> : <span>{authorInitial}</span>}
          </span>
          <button type="button" className="post-composer-invite-prompt" onClick={openComposer}>
            Compartilhe algo com a sua comunidade
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={`post-composer-form${expanded ? '' : ' post-composer-form--collapsed'}`}
      >
        {contextLabel && <p className="post-composer-context">{contextLabel}</p>}
        <label htmlFor="post-content">O que você quer compartilhar?</label>
        <textarea
          ref={textareaRef}
          id="post-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          required={!imageFile}
          placeholder={imageFile ? 'Escreva uma legenda (opcional)' : undefined}
        />
        <EmojiPicker onPick={(e) => setContent((c) => c + e)} />

        {imagePreview && (
          <div className="post-composer-image">
            <img loading="lazy" decoding="async" src={imagePreview} alt="Pré-visualização da imagem do post" />
            <div className="post-composer-image-actions">
              <button type="button" className="auth-link" onClick={() => fileInputRef.current?.click()} disabled={loading}>
                Trocar imagem
              </button>
              <button type="button" className="auth-link" onClick={removeImage} disabled={loading}>
                Remover imagem
              </button>
            </div>
          </div>
        )}
        <div className="post-composer-actions">
          {!imagePreview && (
            <button
              type="button"
              className="auth-link post-composer-image-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              Adicionar imagem
            </button>
          )}
          {allowPoll && !pollOpen && (
            <button type="button" className="auth-link" onClick={() => setPollOpen(true)} disabled={loading}>
              Criar enquete
            </button>
          )}
        </div>

        {allowPoll && pollOpen && (
          <fieldset className="poll-builder">
            <legend>Enquete</legend>
            <p className="home-muted">A pergunta é o texto acima. Escreva as opções (de 2 a 8).</p>
            {pollOptions.map((value, index) => (
              <div key={index} className="poll-builder-row">
                <input
                  type="text"
                  maxLength={80}
                  value={value}
                  placeholder={`Opção ${index + 1}`}
                  aria-label={`Opção ${index + 1} da enquete`}
                  onChange={(event) =>
                    setPollOptions((prev) => prev.map((item, i) => (i === index ? event.target.value : item)))
                  }
                />
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    className="auth-link"
                    aria-label={`Remover a opção ${index + 1}`}
                    onClick={() => setPollOptions((prev) => prev.filter((_, i) => i !== index))}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < 8 && (
              <button type="button" className="auth-link" onClick={() => setPollOptions((prev) => [...prev, ''])}>
                + Adicionar opção
              </button>
            )}
            <label className="poll-builder-multi">
              <input type="checkbox" checked={pollMultiple} onChange={(event) => setPollMultiple(event.target.checked)} />{' '}
              Permitir escolher mais de uma opção
            </label>
            <button type="button" className="auth-link" onClick={() => setPollOpen(false)}>
              Remover enquete
            </button>
          </fieldset>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          hidden
        />

        {error && <p className="auth-error">{error}</p>}

        {cropping && (
          <FeedPhotoCropper
            file={cropping}
            onCancel={() => setCropping(null)}
            onDone={applyCroppedImage}
          />
        )}

        <button type="submit" className="post-composer-submit" disabled={loading || (!content.trim() && !imageFile)}>
          {loading ? (imageFile ? 'Enviando a foto...' : 'Publicando...') : 'Publicar'}
        </button>
      </form>
    </section>
  )
}
