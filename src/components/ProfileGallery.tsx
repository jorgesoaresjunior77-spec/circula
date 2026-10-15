import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { PlusIcon, CloseIcon } from './icons'

// Perfil (item 10) — galeria de até 12 fotos.
//
// Grade sempre em 3 colunas (desktop e mobile — pedido explícito),
// proporção 4:5. Fotos são URLs públicas do bucket `avatars` (mesmo do
// avatar) — sem assinatura, exibidas direto em <img src>. Modo
// `editable`: cada miniatura preenchida ganha "Substituir"/"Remover"; a
// próxima vaga vazia (até 12) ganha um botão "+" para adicionar. Modo
// leitura (ProfileCard, perfil de outra pessoa): só grade + ampliação,
// sem nenhum controle. Clicar numa miniatura (fora dos botões de ação)
// sempre abre a visualização ampliada, em qualquer modo.

const MAX_PHOTOS = 12

interface ProfileGalleryProps {
  photos: string[]
  editable?: boolean
  busyIndex?: number | null
  onAdd?: (file: File) => void
  onReplace?: (index: number, file: File) => void
  onRemove?: (index: number) => void
}

export function ProfileGallery({
  photos,
  editable = false,
  busyIndex = null,
  onAdd,
  onReplace,
  onRemove,
}: ProfileGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const replaceTargetRef = useRef<number | null>(null)

  // Fechar com Esc, além do botão e do clique no fundo.
  useEffect(() => {
    if (lightboxIndex === null) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setLightboxIndex(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [lightboxIndex])

  if (!editable && photos.length === 0) return null

  const canAddMore = editable && photos.length < MAX_PHOTOS

  function handleAddFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onAdd?.(file)
  }

  function handleReplaceFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    const index = replaceTargetRef.current
    if (file && index !== null) onReplace?.(index, file)
  }

  function startReplace(index: number) {
    replaceTargetRef.current = index
    replaceInputRef.current?.click()
  }

  return (
    <div className="profile-gallery">
      <div className="profile-gallery-grid">
        {photos.map((url, index) => (
          <div key={`${url}-${index}`} className="profile-gallery-slot profile-gallery-slot--filled">
            <button
              type="button"
              className="profile-gallery-thumb"
              onClick={() => setLightboxIndex(index)}
              aria-label={`Ver foto ${index + 1} ampliada`}
            >
              <img src={url} alt="" />
            </button>
            {editable && (
              <div className="profile-gallery-slot-actions">
                <button
                  type="button"
                  onClick={() => startReplace(index)}
                  disabled={busyIndex === index}
                >
                  {busyIndex === index ? '...' : 'Substituir'}
                </button>
                <button
                  type="button"
                  className="profile-gallery-remove"
                  onClick={() => onRemove?.(index)}
                  disabled={busyIndex === index}
                  aria-label={`Remover foto ${index + 1}`}
                >
                  Remover
                </button>
              </div>
            )}
          </div>
        ))}

        {canAddMore && (
          <button
            type="button"
            className="profile-gallery-slot profile-gallery-slot--add"
            onClick={() => addInputRef.current?.click()}
            disabled={busyIndex === photos.length}
            aria-label="Adicionar foto"
          >
            {busyIndex === photos.length ? (
              <span className="profile-gallery-add-status">Enviando…</span>
            ) : (
              <PlusIcon size={22} />
            )}
          </button>
        )}
      </div>

      {editable && (
        <p className="profile-gallery-hint">
          Até {MAX_PHOTOS} fotos · proporção 4:5 · {photos.length}/{MAX_PHOTOS}
        </p>
      )}

      {editable && (
        <input
          ref={addInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleAddFile}
        />
      )}
      {editable && (
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleReplaceFile}
        />
      )}

      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="profile-gallery-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            className="profile-gallery-lightbox-close"
            onClick={() => setLightboxIndex(null)}
            aria-label="Fechar"
          >
            <CloseIcon size={22} />
          </button>
          <img
            src={photos[lightboxIndex]}
            alt=""
            className="profile-gallery-lightbox-img"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
