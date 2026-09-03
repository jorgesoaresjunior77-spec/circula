import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { uploadCoverImage } from '../lib/uploadImage'

interface CoverImageInputProps {
  /** URL de capa já persistida (`''` = sem capa). */
  value: string
  /** Chamado com a nova URL pública, ou `''` quando a capa é removida. */
  onChange: (url: string) => void
  /** id da usuária logada (= `auth.uid()`), usado no caminho do upload. */
  uid: string
  /** id do input de arquivo, para associar ao rótulo. */
  id?: string
  label?: string
  disabled?: boolean
}

/**
 * Campo reutilizável de imagem de capa: seleciona um arquivo, faz o
 * upload direto para o Storage (via `uploadCoverImage`) e devolve a URL
 * pública pelo `onChange` — os hooks de persistência continuam recebendo
 * apenas uma string de URL, exatamente como recebiam do antigo
 * `<input type="url">`. Mostra preview (local durante o envio, remoto
 * depois), estado de envio e ação de remover. Sem dependência nova.
 */
export function CoverImageInput({
  value,
  onChange,
  uid,
  id,
  label = 'Imagem de capa (opcional)',
  disabled = false,
}: CoverImageInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  const preview = localPreview ?? (value || null)
  const controlsDisabled = disabled || uploading

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Permite reselecionar o mesmo arquivo depois de um erro.
    event.target.value = ''
    if (!file) return

    setError(null)
    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    setUploading(true)

    const { url, error: uploadError } = await uploadCoverImage(file, uid)

    setUploading(false)
    URL.revokeObjectURL(objectUrl)
    setLocalPreview(null)

    if (uploadError || !url) {
      setError(uploadError ?? 'Não foi possível enviar a imagem agora. Tente novamente.')
      return
    }

    onChange(url)
  }

  function handleClear() {
    setError(null)
    setLocalPreview(null)
    onChange('')
  }

  return (
    <div className="cover-image-input">
      {label && (
        <label className="cover-image-input-label" htmlFor={id}>
          {label}
        </label>
      )}

      <div
        className="cover-image-input-frame"
        data-empty={preview ? undefined : 'true'}
      >
        {preview ? (
          <img src={preview} alt="" className="cover-image-input-preview" />
        ) : (
          <span className="cover-image-input-placeholder">
            Nenhuma imagem selecionada
          </span>
        )}
        {uploading && <span className="cover-image-input-status">Enviando…</span>}
      </div>

      <div className="cover-image-input-actions">
        <button
          type="button"
          className="cover-image-input-pick"
          onClick={() => inputRef.current?.click()}
          disabled={controlsDisabled}
        >
          {uploading ? 'Enviando…' : preview ? 'Trocar imagem' : 'Selecionar imagem'}
        </button>
        {preview && !uploading && (
          <button
            type="button"
            className="auth-link"
            onClick={handleClear}
            disabled={controlsDisabled}
          >
            Remover
          </button>
        )}
      </div>

      {error && <p className="auth-error">{error}</p>}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        className="cover-image-input-file"
        onChange={handleFile}
        disabled={controlsDisabled}
      />
    </div>
  )
}
