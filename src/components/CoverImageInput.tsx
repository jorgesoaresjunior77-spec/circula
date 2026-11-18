import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { uploadCommunityMedia } from '../lib/communityMedia'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { ImageCropper } from './ImageCropper'

/** "3 / 4" -> 0.75. Sem proporção informada, usa 16:9 (o frame padrão). */
function parseAspect(value?: string): number {
  const m = value?.match(/^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/)
  const w = m ? Number(m[1]) : 16
  const h = m ? Number(m[2]) : 9
  return w > 0 && h > 0 ? w / h : 16 / 9
}

interface CoverImageInputProps {
  /** Path/URL de capa já persistida (`''` = sem capa) — path novo do
   *  bucket `community-media` ou, para capas enviadas antes da 12.5B,
   *  URL pública antiga do bucket `avatars`. */
  value: string
  /** Chamado com o novo PATH (bucket community-media), ou `''` quando a
   *  capa é removida. NÃO é mais uma URL pública utilizável direto —
   *  ver `uploadCommunityMedia`. */
  onChange: (path: string) => void
  /** id da comunidade dona deste conteúdo — 1o segmento do path, usado
   *  pelas policies de Storage para autorizar leitura/escrita. NUNCA
   *  assumido: vem sempre do contexto real de quem chama. */
  communityId: string
  /** id da usuária logada (= `auth.uid()`), usado no caminho do upload. */
  uid: string
  /** id do input de arquivo, para associar ao rótulo. */
  id?: string
  label?: string
  disabled?: boolean
  /** Proporção real do espaço (ex.: '16 / 9', '4 / 5') — só quando
   *  diverge do frame padrão (16:9). Aplicada inline; não mexe no CSS
   *  compartilhado nem nos outros usos deste componente. */
  aspectRatio?: string
  /** Tamanho de upload recomendado para ESTE espaço específico (ex.:
   *  '1920 × 1080 px'), calculado a partir do tamanho/proporção real em
   *  que a imagem é exibida depois de salva. Mostrado só no estado
   *  vazio — some assim que há preview (local ou já salvo). */
  recommendedSize?: string
}

/**
 * Campo reutilizável de imagem de capa: seleciona um arquivo, faz o
 * upload direto para o Storage (bucket privado `community-media`, via
 * `uploadCommunityMedia`) e devolve o PATH pelo `onChange` — os hooks de
 * persistência continuam recebendo apenas uma string, exatamente como
 * recebiam do antigo `<input type="url">`, só que agora é um path, não
 * uma URL pública. Mostra preview: local (blob) durante o envio; depois
 * do envio, e para valores já persistidos, resolve via
 * `useSignedImageUrl` (que também sabe exibir direto uma URL pública
 * antiga, sem tentar assiná-la). Estado de envio e ação de remover.
 */
export function CoverImageInput({
  value,
  onChange,
  communityId,
  uid,
  id,
  label = 'Imagem de capa (opcional)',
  disabled = false,
  aspectRatio,
  recommendedSize,
}: CoverImageInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  // Arquivo aguardando enquadramento (recorte) antes de subir.
  const [pending, setPending] = useState<File | null>(null)

  const { url: savedPreviewUrl } = useSignedImageUrl(value || null)
  const preview = localPreview ?? savedPreviewUrl
  const controlsDisabled = disabled || uploading

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Permite reselecionar o mesmo arquivo depois de um erro.
    event.target.value = ''
    if (!file) return
    setError(null)
    // Antes de subir, a pessoa enquadra a imagem (arrastar, posicionar, prévia).
    setPending(file)
  }

  // Reabre a imagem já salva para ajustar o enquadramento.
  async function handleEditSaved() {
    if (!savedPreviewUrl && !localPreview) return
    setError(null)
    try {
      const res = await fetch((localPreview ?? savedPreviewUrl) as string)
      const blob = await res.blob()
      setPending(new File([blob], 'imagem', { type: blob.type || 'image/webp' }))
    } catch {
      setError('Não foi possível abrir a imagem para editar. Escolha o arquivo de novo.')
    }
  }

  async function uploadCropped(file: File) {
    setPending(null)
    setError(null)
    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    setUploading(true)

    const { path, error: uploadError } = await uploadCommunityMedia(
      file,
      communityId,
      uid,
      'covers',
    )

    setUploading(false)
    URL.revokeObjectURL(objectUrl)
    setLocalPreview(null)

    if (uploadError || !path) {
      setError(uploadError ?? 'Não foi possível enviar a imagem agora. Tente novamente.')
      return
    }

    onChange(path)
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
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        {preview ? (
          <img loading="lazy" decoding="async" src={preview} alt="" className="cover-image-input-preview" />
        ) : (
          <span className="cover-image-input-placeholder">
            Nenhuma imagem selecionada
            {recommendedSize && (
              <span className="cover-image-input-size-hint">{recommendedSize}</span>
            )}
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
          <button type="button" className="cover-image-input-pick" onClick={() => void handleEditSaved()} disabled={controlsDisabled}>
            Editar enquadramento
          </button>
        )}
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

      {pending && (
        <ImageCropper
          file={pending}
          aspect={parseAspect(aspectRatio)}
          outputWidth={1440}
          title="Ajustar imagem"
          onCancel={() => setPending(null)}
          onDone={(f) => void uploadCropped(f)}
        />
      )}

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
