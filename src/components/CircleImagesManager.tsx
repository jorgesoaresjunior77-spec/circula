import { useState } from 'react'
import { useCommunityCardImages } from '../hooks/useCommunityCardImages'
import { CoverImageInput } from './CoverImageInput'

// Ajustes de navegação (item 5B) — "Imagens da comunidade" > Círculos.
//
// Um espaço de capa para CADA círculo real da comunidade (inclui
// Grávidas/Viagem/Achados da Web quando a dona os cadastrar pela aba
// Círculos do Painel — ver CircleManager.tsx, não duplicado aqui).
// Reaproveita 100% a estrutura existente: `circle.cover_image_url` já é
// o campo que a Home lê (HomeCirclesSection); aqui só muda a capa, nunca
// o nome, via `renameCircle(id, name_inalterado, novaCapa)`. Nenhuma
// tabela, coluna ou migration nova.

interface CircleImagesManagerProps {
  communityId: string
  profileId: string
}

export function CircleImagesManager({ communityId, profileId }: CircleImagesManagerProps) {
  const [errorId, setErrorId] = useState<string | null>(null)
  const { images, setImage, clearImage } = useCommunityCardImages(communityId)
  async function handleNewCircleCover(path: string) {
    setErrorId(null)
    const r = path
      ? await setImage('novo_circulo', path, profileId)
      : await clearImage('novo_circulo')
    if (r.error) setErrorId('novo_circulo')
  }

  return (
    <div className="card-images-manager">
      <header className="card-images-head">
        <h4 className="card-images-title">Círculos</h4>
        <p className="card-images-desc">
          Escolha a imagem de cada círculo da comunidade.
        </p>
      </header>

      <ul className="card-images-list">
        <li className="card-images-row">
          <div className="card-images-info">
            <span className="card-images-name">Novo Círculo</span>
            <span className="card-images-hint">Card fixo "Sugira um grupo" no início da faixa.</span>
          </div>
          <div className="card-images-field">
            <CoverImageInput
              value={images.novo_circulo ?? ''}
              communityId={communityId}
              uid={profileId}
              label=""
              aspectRatio="4 / 5"
              onChange={(path) => void handleNewCircleCover(path)}
              recommendedSize="1080 × 1350 px"
            />
            {errorId === 'novo_circulo' && (
              <p className="card-images-error" role="alert">
                Não foi possível salvar agora. Tente novamente.
              </p>
            )}
          </div>
        </li>
      </ul>

    </div>
  )
}
