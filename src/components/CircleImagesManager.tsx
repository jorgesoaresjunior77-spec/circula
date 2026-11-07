import { NewCircleCoverField } from './NewCircleCoverField'

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
          <NewCircleCoverField communityId={communityId} profileId={profileId} />
        </li>
      </ul>

    </div>
  )
}
