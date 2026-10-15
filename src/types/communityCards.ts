// Imagens dos cards de experiência da Home da comunidade (cadastradas
// pela Profissional no Painel). SÓ visual — não muda a origem dos dados
// de nenhum card.
//
// Redesign da Home — "Círcula Hoje" é uma lista fixa de destinos de
// navegação (ver HomeExperienceStrip.tsx); só as chaves que o CHECK de
// `community_card_images` (migration 20260924120000) já permite ganham
// capa configurável aqui — sem alterar essa migration (fora de escopo).
// 'eventos' é o card "Eventos". Ajustes de navegação — "Receitas" reusa
// a chave legada 'jornada' (um dos 6 nomes originais do CHECK, sem
// nenhum card ativo há tempos) só para guardar essa capa; o rótulo no
// Painel já mostra "Receitas". Meu Perfil/Help Nutri/Loja/Círculos não
// têm chave própria — adicionar exigiria alterar o CHECK, fora de
// escopo aqui.

export type CommunityCardKey = 'eventos' | 'jornada'

export interface CommunityCardMeta {
  key: CommunityCardKey
  label: string
  hint: string
}

export const COMMUNITY_CARD_META: CommunityCardMeta[] = [
  { key: 'eventos', label: 'Eventos', hint: 'A agenda da comunidade.' },
  { key: 'jornada', label: 'Receitas', hint: 'A biblioteca de receitas da comunidade.' },
]

export const COMMUNITY_CARD_KEYS = COMMUNITY_CARD_META.map((c) => c.key)

export const COMMUNITY_CARD_IMAGE_FORMAT =
  'Formato recomendado: retrato 4:5 (ex.: 1080 × 1350 px). JPG, PNG ou WebP, até 5 MB. Outras proporções são aceitas, mas podem aparecer recortadas.'
