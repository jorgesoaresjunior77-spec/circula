import { useState } from 'react'
import { useCommunityCardImages } from '../hooks/useCommunityCardImages'
import { CoverImageInput } from './CoverImageInput'

// Imagem do card fixo "Novo Círculo" (o que convida a sugerir um grupo, no
// começo da faixa de Círculos da Home). Usada na aba Círculos e em
// Imagens da comunidade: as duas gravam a mesma chave `novo_circulo`.

interface Props {
  communityId: string
  profileId: string
}

export function NewCircleCoverField({ communityId, profileId }: Props) {
  const [failed, setFailed] = useState(false)
  const { images, setImage, clearImage } = useCommunityCardImages(communityId)

  async function handleChange(path: string) {
    setFailed(false)
    const r = path ? await setImage('novo_circulo', path, profileId) : await clearImage('novo_circulo')
    if (r.error) setFailed(true)
  }

  return (
    <div className="card-images-field">
      <CoverImageInput
        value={images.novo_circulo ?? ''}
        communityId={communityId}
        uid={profileId}
        label=""
        aspectRatio="4 / 5"
        onChange={(path) => void handleChange(path)}
        recommendedSize="1080 × 1350 px"
      />
      {failed && (
        <p className="card-images-error" role="alert">
          Não foi possível salvar agora. Tente novamente.
        </p>
      )}
    </div>
  )
}
