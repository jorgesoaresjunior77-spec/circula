// Imagens dos cards de experiência da Home da comunidade (cadastradas
// pela Profissional no Painel). SÓ visual — não muda a origem dos dados
// de nenhum card.
//
// Redesign da Home — "Círcula Hoje" agora é uma lista fixa de 6 destinos
// de navegação (ver HomeExperienceStrip.tsx); "Eventos" é o único que
// segue com capa configurável, porque é a única chave que o CHECK de
// `community_card_images` (migration 20260924120000) já permite para os
// destinos novos (Meu Perfil, Help Nutri, Loja, Comunidades, Círculos
// não têm chave própria — adicionar exigiria alterar essa migration,
// fora de escopo aqui). 'hoje'/'comunidade'/'instagram' saíram da lista
// editável porque os cards que usavam essas capas não existem mais na
// Home; linhas já cadastradas com essas chaves continuam no banco,
// apenas sem efeito visual.

export type CommunityCardKey = 'eventos'

export interface CommunityCardMeta {
  key: CommunityCardKey
  label: string
  hint: string
}

export const COMMUNITY_CARD_META: CommunityCardMeta[] = [
  { key: 'eventos', label: 'Eventos', hint: 'A agenda da comunidade.' },
]

export const COMMUNITY_CARD_KEYS = COMMUNITY_CARD_META.map((c) => c.key)

export const COMMUNITY_CARD_IMAGE_FORMAT =
  'Formato recomendado: retrato 4:5 (ex.: 1080 × 1350 px). JPG, PNG ou WebP, até 5 MB. Outras proporções são aceitas, mas podem aparecer recortadas.'
