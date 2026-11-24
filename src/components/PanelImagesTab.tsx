import { useState } from 'react'
import type { ReactNode } from 'react'
import { useCommunityCardImages } from '../hooks/useCommunityCardImages'
import { cardImageSpec } from '../types/communityCards'
import type { CommunityCardKey } from '../types/communityCards'
import { CoverImageInput } from './CoverImageInput'
import { LoginBackgroundManager } from './LoginBackgroundManager'
import { CircleImagesManager } from './CircleImagesManager'
import { PartnersManager } from './PartnersManager'

// Painel → Imagens, organizado por SETOR e por LUGAR no app: o que a profissional procura é
// "onde isso aparece", então cada bloco diz a tela e a parte (ex.: Início · Para você).
// Cada imagem mostra o tamanho exato do espaço onde ela aparece de verdade.

interface Slot {
  key: CommunityCardKey
  label: string
  /** Onde aparece, em uma frase simples. */
  where: string
}

interface Section {
  id: string
  title: string
  summary: string
  slots?: Slot[]
  extra?: (p: { communityId: string; profileId: string }) => ReactNode
  note?: string
}

const SECTIONS: Section[] = [
  {
    id: 'login',
    title: 'Tela de entrada (login)',
    summary: 'A foto que cobre a tela de login e senha.',
    extra: ({ profileId }) => <LoginBackgroundManager profileId={profileId} />,
  },
  {
    id: 'hoje',
    title: 'Início · Menu “Hoje” (cards pequenos que deslizam)',
    summary: 'Meu Perfil, Help Nutri, Meu Jardim, Assine o Círcula e Convite.',
    slots: [
      { key: 'hoje', label: 'Meu Perfil', where: 'Menu “Hoje”, no topo do Início.' },
      { key: 'desafios', label: 'Help Nutri', where: 'Menu “Hoje”, no topo do Início.' },
      { key: 'jardim', label: 'Meu Jardim', where: 'Menu “Hoje”, no topo do Início.' },
      { key: 'menu_planos', label: 'Assine o Círcula', where: 'Menu “Hoje”, no topo do Início.' },
      { key: 'ferramenta_calendario', label: 'Convite', where: 'Menu “Hoje”, no topo do Início.' },
    ],
  },
  {
    id: 'circulos',
    title: 'Início · Círculos',
    summary: 'O card “Novo Círculo”. A capa de cada círculo se cadastra em Painel → Círculos.',
    extra: ({ communityId, profileId }) => <CircleImagesManager communityId={communityId} profileId={profileId} />,
  },
  {
    id: 'descobrir',
    title: 'Início · Descobrir (cidade e os 3 círculos)',
    summary: 'Na minha cidade e os círculos de Eventos, Loja e Receitas.',
    slots: [
      { key: 'banner_cidade', label: 'Na minha cidade', where: 'Card largo logo antes de “Descobrir”.' },
      { key: 'eventos_grande', label: 'Círculo Eventos', where: 'Círculo grande, à esquerda, abaixo da revista.' },
      { key: 'comunidade_grande', label: 'Círculo Loja', where: 'Círculo à direita, abaixo da revista.' },
      { key: 'jornada_grande', label: 'Círculo Receitas', where: 'Círculo de baixo, no meio.' },
    ],
    note: 'A foto do escritório da revista se cadastra na própria revista, no Início.',
  },
  {
    id: 'menu',
    title: 'Início · Menu que rola (cards finos)',
    summary: 'Dicas de leitura, Respiração, Playlist, Wellness, Séries e Filmes, Viagem.',
    slots: [
      { key: 'menu_leitura', label: 'Dicas de leitura', where: 'Faixa fina que rola, abaixo dos 3 círculos.' },
      { key: 'menu_respiracao', label: 'Respiração', where: 'Faixa fina que rola, abaixo dos 3 círculos.' },
      { key: 'menu_playlist', label: 'Playlist', where: 'Faixa fina que rola, abaixo dos 3 círculos.' },
      { key: 'menu_wellness', label: 'Wellness', where: 'Faixa fina que rola, abaixo dos 3 círculos.' },
      { key: 'menu_series', label: 'Dicas de Séries / Filmes', where: 'Faixa fina que rola, abaixo dos 3 círculos.' },
      { key: 'menu_viagens', label: 'Dicas de Viagem', where: 'Faixa fina que rola, abaixo dos 3 círculos.' },
    ],
  },
  {
    id: 'voce',
    title: 'Início · Para você',
    summary: 'Meu Chef, Lista de Compras, Se exercite em casa e Diário da Gratidão.',
    slots: [
      { key: 'banner_cardapio', label: 'Meu Chef', where: 'Card à esquerda, primeira linha de “Para você”.' },
      { key: 'banner_lista', label: 'Lista de Compras', where: 'Card à direita, primeira linha de “Para você”.' },
      { key: 'banner_exercicios', label: 'Se exercite em casa', where: 'Card à esquerda, segunda linha de “Para você”.' },
      { key: 'banner_diario', label: 'Diário da Gratidão', where: 'Card à direita, segunda linha de “Para você”.' },
    ],
  },
  {
    id: 'planos',
    title: 'Início · Planos e assinaturas',
    summary: 'O card baixo e largo perto do fim do Início.',
    slots: [{ key: 'banner_planos', label: 'Planos e assinaturas', where: 'Card baixo e largo, só a escrita fica por cima.' }],
  },
  {
    id: 'parceiros',
    title: 'Início · Parceiros',
    summary: 'Os logos da faixa de parceiros.',
    extra: ({ communityId, profileId }) => <PartnersManager communityId={communityId} profileId={profileId} />,
  },
  {
    id: 'loja',
    title: 'Loja',
    summary: 'A imagem de fundo das prateleiras.',
    slots: [{ key: 'loja_fundo', label: 'Fundo da Loja', where: 'Dentro da Loja, atrás das prateleiras.' }],
  },
]

function SlotRow({
  slot,
  value,
  communityId,
  profileId,
  onChange,
  failed,
}: {
  slot: Slot
  value: string
  communityId: string
  profileId: string
  onChange: (key: CommunityCardKey, path: string) => void
  failed: boolean
}) {
  const spec = cardImageSpec(slot.key)
  return (
    <li className="card-images-row">
      <div className="card-images-info">
        <span className="card-images-name">{slot.label}</span>
        <span className="card-images-hint">{slot.where}</span>
      </div>
      <div className="card-images-field">
        <CoverImageInput
          value={value}
          communityId={communityId}
          uid={profileId}
          label=""
          onChange={(path) => onChange(slot.key, path)}
          aspectRatio={spec.aspect}
          recommendedSize={spec.size}
        />
        <p className="card-images-guide">
          <span>
            Tamanho exato: {spec.size} ({spec.format})
          </span>
          <span>Até 5 MB</span>
        </p>
        {failed && (
          <p className="card-images-error" role="alert">
            Não foi possível salvar agora. Tente novamente.
          </p>
        )}
      </div>
    </li>
  )
}

export function PanelImagesTab({ communityId, profileId, onOpenCity }: { communityId: string; profileId: string; onOpenCity?: () => void }) {
  const { images, loading, setImage, clearImage } = useCommunityCardImages(communityId)
  const [errorKey, setErrorKey] = useState<CommunityCardKey | null>(null)
  const [openId, setOpenId] = useState<string | null>('hoje')

  async function handleChange(key: CommunityCardKey, path: string) {
    setErrorKey(null)
    const result = path ? await setImage(key, path, profileId) : await clearImage(key)
    if (result.error) setErrorKey(key)
  }

  return (
    <div className="panel-images">
      <p className="home-muted">
        Cada bloco é um lugar do app. Abra o bloco, escolha a imagem e ajuste o enquadramento. O tamanho indicado é o espaço real onde a imagem aparece.
      </p>

      {SECTIONS.map((section) => {
        const open = openId === section.id
        const filled = section.slots ? section.slots.filter((s) => images[s.key]).length : null
        return (
          <section key={section.id} className={`panel-img-section${open ? ' panel-img-section--open' : ''}`}>
            <button type="button" className="panel-img-head" aria-expanded={open} onClick={() => setOpenId(open ? null : section.id)}>
              <span className="panel-img-title">
                <strong>{section.title}</strong>
                <small>{section.summary}</small>
              </span>
              {filled !== null && (
                <span className="panel-img-count">
                  {filled}/{section.slots?.length}
                </span>
              )}
              <span aria-hidden="true">{open ? '−' : '+'}</span>
            </button>
            {open && (
              <div className="panel-img-body">
                {section.note && <p className="cty-note">{section.note}</p>}
                {section.slots &&
                  (loading ? (
                    <p className="home-muted">Carregando imagens…</p>
                  ) : (
                    <ul className="card-images-list">
                      {section.slots.map((slot) => (
                        <SlotRow
                          key={slot.key}
                          slot={slot}
                          value={images[slot.key] ?? ''}
                          communityId={communityId}
                          profileId={profileId}
                          onChange={(k, p) => void handleChange(k, p)}
                          failed={errorKey === slot.key}
                        />
                      ))}
                    </ul>
                  ))}
                {section.extra?.({ communityId, profileId })}
              </div>
            )}
          </section>
        )
      })}

      <section className="panel-img-section">
        <div className="panel-img-head panel-img-head--static">
          <span className="panel-img-title">
            <strong>Na minha cidade (grupos e categorias)</strong>
            <small>Cada grupo e cada categoria tem imagem e descrição. Cadastre em Painel → Na minha cidade → Grupos e categorias.</small>
          </span>
          {onOpenCity && (
            <button type="button" className="cty-btn cty-btn--small" onClick={onOpenCity}>
              Abrir
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
