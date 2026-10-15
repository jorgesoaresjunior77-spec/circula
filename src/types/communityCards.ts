// Imagens dos cards de experiência da Home da comunidade (cadastradas
// pela Profissional no Painel). SÓ visual — não muda a origem dos dados
// de nenhum card.
//
// Redesign da Home — "Círcula Hoje" é uma lista fixa de 6 destinos de
// navegação (ver HomeExperienceStrip.tsx): Meu Perfil, Help Nutri,
// Eventos, Loja, Círculos, Receitas. Painel → Imagens da comunidade
// (item 7) — TODOS os 6 ganham capa configurável aqui, reaproveitando
// as 6 chaves que o CHECK de `community_card_images` (migration
// 20260924120000) já permite — sem alterar essa migration/CHECK (fora
// de escopo): as chaves eram nomes de cards antigos ("hoje", "seus
// desafios", "eventos", "na comunidade", "sua jornada", "instagram"),
// nenhum deles com card ativo há tempos; aqui elas só guardam o PATH da
// capa, sem nenhum efeito além da imagem em si. O rótulo mostrado no
// Painel (abaixo) é sempre o do destino ATUAL, não o nome antigo.
// Mapa (chave -> destino atual):
//   eventos    -> Eventos    (já era este antes)
//   jornada    -> Receitas   (ajustes de navegação anterior)
//   hoje       -> Meu Perfil
//   desafios   -> Help Nutri
//   comunidade -> Loja
//   instagram  -> Círculos   (NÃO confundir com a seção separada
//                             "Publicações do Instagram" — essa usa
//                             community_content, nunca esta tabela)

export type CommunityCardKey =
  | 'eventos'
  | 'jornada'
  | 'hoje'
  | 'desafios'
  | 'comunidade'
  | 'instagram'

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
  { key: 'instagram', label: 'Círculos', hint: 'Pequenos grupos da comunidade.' },
  { key: 'jornada', label: 'Receitas', hint: 'A biblioteca de receitas da comunidade.' },
]

export const COMMUNITY_CARD_KEYS = COMMUNITY_CARD_META.map((c) => c.key)

export const COMMUNITY_CARD_IMAGE_FORMAT =
  'Formato recomendado: retrato 4:5 (ex.: 1080 × 1350 px). JPG, PNG ou WebP, até 5 MB. Outras proporções são aceitas, mas podem aparecer recortadas.'
