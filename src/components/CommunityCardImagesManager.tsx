import { useState } from 'react'
import { useCommunityCardImages } from '../hooks/useCommunityCardImages'
import {
  COMMUNITY_CARD_META,
  COMMUNITY_CARD_IMAGE_FORMAT,
} from '../types/communityCards'
import type { CommunityCardKey } from '../types/communityCards'
import { CoverImageInput } from './CoverImageInput'

// "Imagens da comunidade" — aba do Painel da Profissional.
//
// A dona escolhe a capa VISUAL de cada uma das 6 experiências da faixa
// da Home. Reusa o CoverImageInput (upload direto para o bucket privado
// `community-media`, mesmo sistema de capa de comunidade/desafio/etc.):
// ao selecionar, o arquivo sobe e o PATH volta pelo onChange; aqui o
// path é gravado em community_card_images (upsert) e some quando a dona
// remove. Nenhuma rota nova, nenhum bucket novo, nenhuma sidebar.
// A imagem é só visual — a origem dos dados de cada card não muda.

interface CommunityCardImagesManagerProps {
  communityId: string
  /** id da Profissional logada (= auth.uid()); usado no path do upload
   *  e como updated_by. */
  profileId: string
}

export function CommunityCardImagesManager({
  communityId,
  profileId,
}: CommunityCardImagesManagerProps) {
  const { images, loading, setImage, clearImage } = useCommunityCardImages(communityId)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(cardKey: CommunityCardKey, path: string) {
    setError(null)
    const result = path
      ? await setImage(cardKey, path, profileId)
      : await clearImage(cardKey)
    if (result.error) {
      setError('Não foi possível salvar agora. Tente novamente.')
    }
  }

  return (
    <div className="card-images-manager">
      <header className="card-images-head">
        <h4 className="card-images-title">Imagens da comunidade</h4>
        <p className="card-images-desc">
          Escolha as imagens que representam as principais experiências da sua
          comunidade.
        </p>
        <p className="card-images-format">{COMMUNITY_CARD_IMAGE_FORMAT}</p>
      </header>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="home-muted">Carregando imagens…</p>
      ) : (
        <ul className="card-images-list">
          {COMMUNITY_CARD_META.map(({ key, label, hint }) => (
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
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
