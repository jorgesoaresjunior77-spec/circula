// Imagens dos cards de experiência da Home da comunidade (cadastradas
// pela Profissional no Painel). SÓ visual — não muda a origem dos dados
// de nenhum card.
//
// Redesign da Home — "Seu Círcula de hoje" é uma lista fixa de destinos
// de navegação (ver HomeExperienceStrip.tsx): Meu Perfil, Help Nutri,
// Eventos, Loja, Receitas. Painel → Imagens da comunidade (item 7) —
// cada um ganha capa configurável aqui, reaproveitando as chaves que o
// CHECK de `community_card_images` (migration 20260924120000) já
// permite — sem alterar essa migration/CHECK (fora de escopo): as
// chaves eram nomes de cards antigos ("hoje", "seus desafios",
// "eventos", "na comunidade", "sua jornada", "instagram"), nenhum deles
// com card ativo há tempos; aqui elas só guardam o PATH da capa, sem
// nenhum efeito além da imagem em si. O rótulo mostrado no Painel
// (abaixo) é sempre o do destino ATUAL, não o nome antigo.
// Mapa (chave -> destino atual):
//   eventos    -> Eventos    (já era este antes)
//   jornada    -> Receitas   (ajustes de navegação anterior)
//   hoje       -> Meu Perfil
//   desafios   -> Help Nutri
//   comunidade -> Loja
//   instagram  -> (sem card nesta faixa — ver abaixo)
//
// Correção da capa (item 1) — "Círculos" NÃO é mais um destino fixo
// desta faixa (tem sua própria seção editorial, com a capa de cada
// Círculo real: <HomeCirclesSection>). A chave legada 'instagram' fica
// fora de COMMUNITY_CARD_META (nenhum slot de upload órfão no Painel),
// mas continua em CommunityCardKey — o CHECK do banco ainda a aceita e
// uma linha antiga com essa chave não quebra `useCommunityCardImages`.
// NÃO confundir com a seção separada "Publicações do Instagram", que
// usa community_content, nunca esta tabela.

// Correções visuais + Painel de imagens (item 4) — três chaves NOVAS
// para os banners editoriais grandes de Eventos/Receitas/Loja
// (<HomeEditorialCards>), independentes das capas dos cards compactos
// acima. Adicionadas ao CHECK de `community_card_images` pela migration
// 20261029120000 (aditiva, já aplicada e validada no banco remoto) —
// EDITORIAL_CARD_META abaixo e o restante do código já usam as 3 chaves
// normalmente.
export type CommunityCardKey =
  | 'eventos'
  | 'jornada'
  | 'hoje'
  | 'desafios'
  | 'comunidade'
  | 'instagram'
  | 'eventos_grande'
  | 'jornada_grande'
  | 'comunidade_grande'
  | 'jardim'
  | 'novo_circulo'
  | 'revista_escritorio'
  | 'ferramenta_calendario'
  | 'ferramenta_agua'
  | 'ferramenta_imc'
  | 'menu_leitura'
  | 'menu_respiracao'
  | 'menu_planos'
  | 'menu_playlist'
  | 'menu_wellness'
  | 'menu_lista'
  | 'loja_fundo'
  | 'banner_cardapio'
  | 'banner_exercicios'
  | 'banner_series'
  | 'banner_diario'
  | 'banner_planos'
  | 'menu_series'
  | 'menu_viagens'
  | 'menu_rachei'
  | 'banner_lista'
  | 'banner_cidade'
  | 'hero_1'
  | 'hero_2'
  | 'hero_3'
  | 'hero_4'
  | 'hero_5'
  | 'hero_6'

export interface CommunityCardMeta {
  key: CommunityCardKey
  label: string
  hint: string
}

export const COMMUNITY_CARD_META: CommunityCardMeta[] = [
  { key: 'hoje', label: 'Meu Perfil', hint: 'Atalho para os dados e preferências da usuária.' },
  { key: 'desafios', label: 'Help Nutri', hint: 'Atalho para falar com a nutricionista.' },
  { key: 'eventos', label: 'Eventos', hint: 'A agenda da comunidade.' },
  { key: 'comunidade', label: 'Loja', hint: 'Produtos e novidades da comunidade.' },
  { key: 'jornada', label: 'Receitas', hint: 'A biblioteca de receitas da comunidade.' },
  /** Etapa 3.2 (evolução/gamificação) — chave nova, aberta pela migration
   *  20261030120000 (preparada, NÃO aplicada — ver Etapa 10). Até a
   *  migration ser aplicada no remoto, `setImage`/`clearImage` para esta
   *  chave devolvem erro de constraint (mesma UX de qualquer outra
   *  falha, sem mensagem especial). */
  { key: 'jardim', label: 'Meu Jardim', hint: 'Atalho para o Meu Jardim — evolução e desafios.' },
  // Chaves já existentes no banco, reaproveitadas (sem migração): 'menu_planos' guarda a
  // capa de "Assine o Círcula" e 'ferramenta_calendario' a de "Convite".
  { key: 'menu_planos', label: 'Assine o Círcula', hint: 'Atalho para Planos e assinaturas, no menu Hoje.' },
  { key: 'ferramenta_calendario', label: 'Convite', hint: 'Atalho para convidar uma amiga, no menu Hoje.' },
]

// Os atalhos Antes de Tudo, Água e IMC da Home usam ícones próprios: não têm
// imagem cadastrável (as chaves ferramenta_* seguem só no banco, sem uso).

/** Cards da roda de menu da Home. As chaves só existem no banco depois da
 *  migration 20261109130000 (preparada, não aplicada); até lá, salvar a
 *  imagem devolve erro de constraint e a roda mostra o degradê com ícone. */
export const MENU_CARD_META: CommunityCardMeta[] = [
  { key: 'menu_leitura', label: 'Dicas de leitura', hint: 'Card da roda de menu da Home.' },
  { key: 'menu_respiracao', label: 'Respiração', hint: 'Card da roda de menu da Home.' },
  { key: 'menu_playlist', label: 'Playlist', hint: 'Card da roda de menu da Home.' },
  { key: 'menu_wellness', label: 'Wellness', hint: 'Card da roda de menu da Home.' },
  { key: 'menu_series', label: 'Dicas de Séries / Filmes', hint: 'Card da roda de menu da Home.' },
  { key: 'menu_viagens', label: 'Dicas de Viagem', hint: 'Card da roda de menu da Home.' },
  { key: 'menu_rachei', label: 'Rachei $', hint: 'Card da roda de menu da Home.' },
]

export const COMMUNITY_CARD_KEYS =COMMUNITY_CARD_META.map((c) => c.key)

export const COMMUNITY_CARD_IMAGE_FORMAT =
  'Cada imagem tem o tamanho exato indicado abaixo, igual ao espaço dela no app. JPG, PNG ou WebP, até 5 MB. O recorte já sai na proporção certa.'

// Banners editoriais grandes (Receitas/Eventos/Loja na Home, ver
// HomeEditorialCards.tsx) — independentes das capas acima. Reusam as
// MESMAS chaves legadas como prefixo (eventos/jornada/comunidade, que
// já mapeiam para Eventos/Receitas/Loja) com o sufixo `_grande`, só
// para deixar a relação óbvia; não têm nenhuma outra ligação com as
// capas dos cards compactos — a Profissional pode cadastrar uma sem
// mexer na outra.
export const EDITORIAL_CARD_META: CommunityCardMeta[] = [
  {
    key: 'eventos_grande',
    label: 'Eventos',
    hint: 'Banner grande da vitrine de Eventos na Home — independente da capa do card compacto acima.',
  },
  {
    key: 'jornada_grande',
    label: 'Receitas',
    hint: 'Banner grande da vitrine de Receitas na Home — independente da capa do card compacto acima.',
  },
  {
    key: 'comunidade_grande',
    label: 'Loja',
    hint: 'Banner grande da vitrine da Loja na Home — independente da capa do card compacto acima.',
  },
  /** Chave nova: só existe no banco depois da migration 20261112120000
   *  (aplicada em 2026-11-12). Sem imagem cadastrada, a
   *  Loja usa o banner grande da Loja (acima) como fundo. */
  {
    key: 'loja_fundo',
    label: 'Fundo da Loja',
    hint: 'Imagem que fica atrás das prateleiras, dentro da Loja. Sem ela, a Loja usa o banner grande da Loja.',
  },
  {
    key: 'banner_cardapio',
    label: 'Meu Chef',
    hint: 'Foto do card "Meu Chef" na Home (mesa posta, pratos bem apresentados). Aparece no topo do card, em 16:9.',
  },
  {
    key: 'banner_exercicios',
    label: 'Se exercite em casa',
    hint: 'Foto do card "Se exercite em casa" (movimento em casa, tapete, luz natural). Aparece no menu fino da Home e no menu de baixo.',
  },
  {
    key: 'banner_planos',
    label: 'Planos e assinaturas',
    hint: 'Imagem do card fino "Planos e assinaturas" na Home (só a escrita fica por cima dela). Aparece em formato bem largo e baixo.',
  },
  {
    key: 'banner_cidade',
    label: 'Na minha cidade',
    hint: 'Foto do card "Na minha cidade" na Home (rua de cidade, praça, mulheres se encontrando). Aparece no card, em 16:9.',
  },
  {
    key: 'banner_lista',
    label: 'Lista de Compras',
    hint: 'Foto do card "Lista de Compras" na Home (mercado, cesta, frutas frescas). Aparece no card, em 16:9.',
  },
  {
    key: 'banner_diario',
    label: 'Diário da Gratidão',
    hint: 'Imagem do card "Diário da Gratidão" na Home (luz de amanhecer, mãos em oração, diário aberto). Aparece no card.',
  },
]

export const EDITORIAL_CARD_KEYS = EDITORIAL_CARD_META.map((c) => c.key)

// O contêiner real (.home-editorial-card-media, App.css) é 16:9 — bem
// diferente do 4:5 dos cards compactos. Recomendar o mesmo formato do
// contêiner é o que realmente minimiza corte (object-fit: cover só
// precisa agir quando a proporção enviada diverge desta).
export const EDITORIAL_CARD_IMAGE_FORMAT =
  'Cada imagem tem o tamanho exato indicado abaixo, igual ao espaço dela no app. JPG, PNG ou WebP, até 5 MB. O recorte já sai na proporção certa.'

/** Tamanho exato de cada imagem, igual ao espaço onde ela aparece no app (sem sobra nem corte). */
export interface CardImageSpec {
  /** Proporção para o recorte (largura / altura). */
  aspect: string
  /** Tamanho em pixels, como mostrado à profissional. */
  size: string
  /** Texto curto de formato. */
  format: string
}

const SPEC_PORTRAIT: CardImageSpec = { aspect: '4 / 5', size: '1080 × 1350 px', format: 'retrato 4:5' }
const SPEC_BANNER: CardImageSpec = { aspect: '16 / 9', size: '1600 × 900 px', format: 'paisagem 16:9' }
const SPEC_WHEEL_CARD: CardImageSpec = { aspect: '6 / 5', size: '1200 × 1000 px', format: 'do joelho para cima, a pessoa num canto' }
const SPEC_BACKGROUND: CardImageSpec = { aspect: '9 / 16', size: '1080 × 1920 px', format: 'vertical 9:16' }

// Proporções reais de cada espaço no app (conferidas no CSS):
//  - 3 círculos (Eventos, Loja, Receitas): quadrada, o app recorta em círculo;
//  - card "Na minha cidade": 16:9 limitado a 180px de altura = cerca de 2:1;
//  - Lista de Compras: foto ao lado do Meu Chef, cerca de 4:3;
//  - Diário da Gratidão: 16:10,8;
//  - Planos e assinaturas: card de 76px de altura por toda a largura, cerca de 4,7:1.
const SPEC_CIRCLE: CardImageSpec = { aspect: '1 / 1', size: '1080 × 1080 px', format: 'quadrada 1:1 (o app recorta em círculo)' }
const SPEC_HERO: CardImageSpec = { aspect: '9 / 11', size: '1080 × 1320 px', format: 'retrato 9:11' }
const SPEC_CITY: CardImageSpec = { aspect: '2 / 1', size: '1600 × 800 px', format: 'paisagem 2:1' }
const SPEC_LIST: CardImageSpec = { aspect: '4 / 3', size: '1200 × 900 px', format: 'paisagem 4:3' }
const SPEC_DIARY: CardImageSpec = { aspect: '16 / 10.8', size: '1200 × 810 px', format: 'paisagem 16:10,8' }
const SPEC_PLANS: CardImageSpec = { aspect: '47 / 10', size: '1410 × 300 px', format: 'faixa larga 4,7:1' }

export function cardImageSpec(key: CommunityCardKey): CardImageSpec {
  switch (key) {
    case 'eventos_grande':
    case 'jornada_grande':
    case 'comunidade_grande':
      return SPEC_CIRCLE
    case 'hero_1':
    case 'hero_2':
    case 'hero_3':
    case 'hero_4':
    case 'hero_5':
    case 'hero_6':
      return SPEC_HERO
    case 'banner_cidade':
      return SPEC_CITY
    case 'banner_lista':
      return SPEC_LIST
    case 'banner_diario':
      return SPEC_DIARY
    case 'banner_planos':
      return SPEC_PLANS
    case 'banner_cardapio':
    case 'banner_exercicios':
      return SPEC_BANNER
    case 'loja_fundo':
    case 'banner_series':
    case 'revista_escritorio':
      return SPEC_BACKGROUND
    case 'menu_leitura':
    case 'menu_respiracao':
    case 'menu_playlist':
    case 'menu_wellness':
    case 'menu_lista':
    case 'menu_series':
    case 'menu_viagens':
    case 'menu_rachei':
      return SPEC_WHEEL_CARD
    default:
      return SPEC_PORTRAIT
  }
}
