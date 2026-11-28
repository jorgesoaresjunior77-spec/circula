import { useState } from 'react'
import type { ReactNode } from 'react'
import { useCommunityCardImages } from '../hooks/useCommunityCardImages'
import { cardImageSpec } from '../types/communityCards'
import type { CommunityCardKey } from '../types/communityCards'
import { CoverImageInput } from './CoverImageInput'
import { CircleImagesManager } from './CircleImagesManager'
import { PartnersManager } from './PartnersManager'
import { CityImagesAdmin } from './CityImagesAdmin'
import { FluirPackagesEditor } from './Fluir'
import { EndImageChoice, HomeDecorManager } from './HomeDecor'

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
    id: 'topo',
    title: 'Início · Topo do app',
    summary: 'A foto grande no alto do Início, atrás do logo, da saudação e do banner.',
    note: 'Uma única imagem fixa. Prefira uma foto aberta e vertical (a pessoa inteira, com céu e fundo), no formato de celular.',
    slots: [{ key: 'hero_1', label: 'Imagem do topo', where: 'Topo do Início.' }],
  },
  {
    id: 'cards-menu',
    title: 'Início · Cards finos do menu',
    summary: 'Dicas de leitura, Respiração, Playlist, Wellness, Séries e Filmes, Dicas de Viagem, Rachei $ e Carro em Dia.',
    note: 'Cada card leva o título dentro e a sua foto num canto, alternando esquerda e direita. Use uma foto da pessoa do joelho para cima, bem à esquerda ou à direita do quadro, com o resto do fundo liso.',
    slots: [
      { key: 'menu_leitura', label: 'Dicas de leitura', where: 'Card fino do menu, no Início.' },
      { key: 'menu_respiracao', label: 'Respiração', where: 'Card fino do menu, no Início.' },
      { key: 'menu_playlist', label: 'Playlist', where: 'Card fino do menu, no Início.' },
      { key: 'menu_wellness', label: 'Wellness', where: 'Card fino do menu, no Início.' },
      { key: 'menu_series', label: 'Séries e Filmes', where: 'Card fino do menu, no Início.' },
      { key: 'menu_viagens', label: 'Dicas de Viagem', where: 'Card fino do menu, no Início.' },
      { key: 'menu_rachei', label: 'Rachei $', where: 'Card fino do menu, no Início.' },
      { key: 'menu_lista', label: 'Carro em Dia', where: 'Card fino do menu, no Início (aparece se o Carro em Dia estiver ativo).' },
    ],
  },
  {
    id: 'planos-cards',
    title: 'Início · Planos e Assinaturas (cartões que giram)',
    summary: 'A foto da Marluce e as fotos dos cinco cartões do carrossel de Planos.',
    note: 'Os cinco cartões dão a volta em 3D e mostram só a imagem cadastrada aqui, do jeito que ela é (com o texto que já vier escrito nela). Sem imagem, o cartão fica em branco. A foto da Marluce deve ter fundo transparente (PNG ou WebP).',
    slots: [
      { key: 'plano_frente', label: 'Cartão da frente: Planos e Assinaturas', where: 'Carrossel de Planos, no Início.' },
      { key: 'plano_premium', label: 'Cartão da direita: Plano Premium', where: 'Carrossel de Planos, no Início.' },
      { key: 'plano_mensal', label: 'Cartão da esquerda: Plano Mensal', where: 'Carrossel de Planos, no Início.' },
      { key: 'plano_semestre', label: 'Cartão do canto esquerdo: Semestre', where: 'Carrossel de Planos, no Início.' },
      { key: 'plano_anual', label: 'Cartão do canto direito: Anual', where: 'Carrossel de Planos, no Início.' },
      { key: 'banner_planos', label: 'Foto da Marluce (fundo transparente)', where: 'Atrás dos cartões, no Início. Sem imagem, usa a foto padrão.' },
    ],
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
    id: 'maternidade-casamento',
    title: 'Início · Maternidade e Casamento',
    summary: 'Os cards de Mom e Baby (dentro da página de Maternidade) e a capa do Casamento.',
    note: 'A capa do Casamento aparece no Início dividida em 4 partes (com espaço entre elas). Prefira uma foto 16:9 com o assunto espalhado pela imagem.',
    slots: [
      { key: 'card_mom', label: 'Card Mom', where: 'Página Maternidade, card da esquerda.' },
      { key: 'card_baby', label: 'Card Baby', where: 'Página Maternidade, card da direita.' },
      { key: 'casamento_capa', label: 'Capa do Casamento (16:9)', where: 'Início, logo abaixo da Maternidade.' },
    ],
  },
  {
    id: 'fluir',
    title: 'Início · Fluir & Florescer (pacotes de emagrecimento)',
    summary: 'Os 3 cards que giram: frente, verso e o texto de cada pacote.',
    note: 'Não é vendido no app: o botão “Saiba mais” leva ao WhatsApp da nutricionista.',
    extra: ({ communityId, profileId }) => <FluirPackagesEditor communityId={communityId} profileId={profileId} />,
  },
  {
    id: 'natal',
    title: 'Início · Natal (neve)',
    summary: 'A neve que cai pela tela ao sacudir o celular.',
    extra: ({ communityId }) => <HomeDecorManager communityId={communityId} />,
  },
  {
    id: 'fim',
    title: 'Início · Fim da página',
    summary: 'A imagem que ocupa o resto da tela depois dos parceiros, atrás dos termos de uso.',
    note: 'Uma imagem vertical (formato de celular). Ela preenche o espaço até o menu de baixo e esmaece no alto. Prefira um fundo suave, para os textos continuarem fáceis de ler.',
    slots: [
      { key: 'banner_series', label: 'Imagem 1 do fim da página (tom areia)', where: 'Depois dos parceiros, no fim do Início.' },
      { key: 'banner_fim_2', label: 'Imagem 2 do fim da página (cores originais)', where: 'Depois dos parceiros, no fim do Início, quando escolhida.' },
    ],
    extra: ({ communityId }) => <EndImageChoice communityId={communityId} />,
  },
  {
    id: 'parceiros',
    title: 'Início · Parceiros',
    summary: 'Os logos da faixa de parceiros.',
    extra: ({ communityId, profileId }) => <PartnersManager communityId={communityId} profileId={profileId} />,
  },
  {
    id: 'cidade',
    title: 'Na minha cidade',
    summary: 'Imagens de grupos, categorias, estados, cidades, lugares e autônomos.',
    extra: () => <CityImagesAdmin />,
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

export function PanelImagesTab({ communityId, profileId }: { communityId: string; profileId: string; onOpenCity?: () => void }) {
  const { images, loading, setImage, clearImage } = useCommunityCardImages(communityId)
  const [errorKey, setErrorKey] = useState<CommunityCardKey | null>(null)
  const [openId, setOpenId] = useState<string | null>('cards-menu')

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

    </div>
  )
}
