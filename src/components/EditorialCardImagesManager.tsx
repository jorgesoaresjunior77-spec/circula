import { useState } from 'react'
import { useCommunityCardImages } from '../hooks/useCommunityCardImages'
import { EDITORIAL_CARD_META, EDITORIAL_CARD_IMAGE_FORMAT } from '../types/communityCards'
import type { CommunityCardKey } from '../types/communityCards'
import { CoverImageInput } from './CoverImageInput'

// Correções visuais + Painel de imagens (item 4) — "Banners editoriais
// grandes" (aba Imagens da comunidade do Painel), irmã de
// <CommunityCardImagesManager>: MESMO molde (useCommunityCardImages,
// CoverImageInput, upsert/clear por card_key), só com as 3 chaves
// *_grande (EDITORIAL_CARD_META) e a proporção real do banner (16:9,
// não 4:5) — ver types/communityCards.ts.
//
// Reusa a MESMA linha do `useCommunityCardImages` que
// <CommunityCardImagesManager> já instancia no Painel (mesma
// `communityId`) — cada card_key é uma linha própria em
// `community_card_images`, então as duas listas de chaves nunca se
// pisam; só a UI é duas seções separadas, por clareza.
//
// As chaves *_grande já existem no CHECK da tabela (migration
// 20261029120000, aditiva, aplicada e validada no banco remoto) —
// `setImage`/`clearImage` funcionam normalmente para elas.

interface EditorialCardImagesManagerProps {
  communityId: string
  profileId: string
}

export function EditorialCardImagesManager({
  communityId,
  profileId,
}: EditorialCardImagesManagerProps) {
  const { images, loading, setImage, clearImage } = useCommunityCardImages(communityId)
  const [errorKey, setErrorKey] = useState<CommunityCardKey | null>(null)

  async function handleChange(cardKey: CommunityCardKey, path: string) {
    setErrorKey(null)
    const result = path
      ? await setImage(cardKey, path, profileId)
      : await clearImage(cardKey)
    if (result.error) {
      setErrorKey(cardKey)
    }
  }

  return (
    <div className="card-images-manager">
      <header className="card-images-head">
        <h4 className="card-images-title">Banners editoriais grandes</h4>
        <p className="card-images-desc">
          Imagens próprias para os banners grandes de Receitas, Eventos e Loja
          na Home — independentes das capas dos cards acima. Sem uma imagem
          própria cadastrada, o banner usa a capa atual (foto do item em
          destaque ou a capa do card compacto).
        </p>
        <p className="card-images-format">{EDITORIAL_CARD_IMAGE_FORMAT}</p>
      </header>

      {loading ? (
        <p className="home-muted">Carregando imagens…</p>
      ) : (
        <ul className="card-images-list">
          {EDITORIAL_CARD_META.map(({ key, label, hint }) => (
            <li key={key} className="card-images-row">
              <div className="card-images-info">
                <span className="card-images-name">{label}</span>
                <span className="card-images-hint">{hint}</span>
              </div>
              <div className="card-images-field">
                <CoverImageInput
                  value={images[key] ?? ''}
                  communityId={communityId}
                  uid={profileId}
                  label=""
                  onChange={(path) => void handleChange(key, path)}
                  aspectRatio="16 / 9"
                  recommendedSize="1600 × 900 px"
                />
                <p className="card-images-guide">
                  <span>Formato recomendado: 16:9</span>
                  <span>Até 5 MB</span>
                </p>
                {errorKey === key && (
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
