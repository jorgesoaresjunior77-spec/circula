import { useState } from 'react'
import { useCircles } from '../hooks/useCircles'
import { CoverImageInput } from './CoverImageInput'
import { EmptyState } from './EmptyState'

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
  const { circles, loading, error, renameCircle } = useCircles(communityId)
  const [errorId, setErrorId] = useState<string | null>(null)

  async function handleChange(circleId: string, circleName: string, path: string) {
    setErrorId(null)
    const result = await renameCircle(circleId, circleName, path)
    if (result.error) setErrorId(circleId)
  }

  return (
    <div className="card-images-manager">
      <header className="card-images-head">
        <h4 className="card-images-title">Círculos</h4>
        <p className="card-images-desc">
          Escolha a imagem de cada círculo da comunidade.
        </p>
      </header>

      {loading && <p className="home-muted">Carregando círculos…</p>}
      {!loading && error && <p className="auth-error">{error}</p>}
      {!loading && !error && circles.length === 0 && (
        <EmptyState message="Nenhum círculo cadastrado ainda. Crie um na aba Círculos." />
      )}

      {!loading && !error && circles.length > 0 && (
        <ul className="card-images-list">
          {circles.map((circle) => (
            <li key={circle.id} className="card-images-row">
              <div className="card-images-info">
                <span className="card-images-name">{circle.name}</span>
              </div>
              <div className="card-images-field">
                <CoverImageInput
                  value={circle.cover_image_url ?? ''}
                  communityId={communityId}
                  uid={profileId}
                  label=""
                  aspectRatio="4 / 5"
                  onChange={(path) => void handleChange(circle.id, circle.name, path)}
                  recommendedSize="1080 × 1350 px"
                />
                {errorId === circle.id && (
                  <p className="card-images-error" role="alert">
                    Não foi possível salvar agora. Tente novamente.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
