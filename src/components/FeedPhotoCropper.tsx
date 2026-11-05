import { createPortal } from 'react-dom'
import { ImageCropper } from './ImageCropper'

// Foto do feed no formato do Instagram: retrato 4:5, recortada pela própria
// pessoa antes de publicar (arrasta para enquadrar e usa o zoom). O que ela
// vê no recorte é exatamente o que aparece no feed. Fica num portal para o
// recorte não ficar dentro do <form> do comentário/publicação.
export const FEED_PHOTO_ASPECT = 4 / 5
const FEED_PHOTO_WIDTH = 1080

interface FeedPhotoCropperProps {
  file: File
  onCancel: () => void
  onDone: (file: File) => void
}

export function FeedPhotoCropper({ file, onCancel, onDone }: FeedPhotoCropperProps) {
  return createPortal(
    <ImageCropper
      file={file}
      aspect={FEED_PHOTO_ASPECT}
      outputWidth={FEED_PHOTO_WIDTH}
      title="Ajustar a foto (4:5)"
      onCancel={onCancel}
      onDone={onDone}
    />,
    document.body,
  )
}
