// Imagens dos cards de experiência da Home da comunidade (cadastradas
// pela Profissional no Painel). SÓ visual — não muda a origem dos dados
// de nenhum card. As chaves batem 1:1 com o `key` de cada experiência
// em HomeExperienceStrip.

export type CommunityCardKey =
  | 'hoje'
  | 'desafios'
  | 'eventos'
  | 'comunidade'
  | 'jornada'
  | 'instagram'

export interface CommunityCardMeta {
  key: CommunityCardKey
  label: string
  hint: string
}

export const COMMUNITY_CARD_META: CommunityCardMeta[] = [
  { key: 'hoje', label: 'Hoje no Círcula', hint: 'A entrada do dia na comunidade.' },
  { key: 'desafios', label: 'Seus desafios', hint: 'A experiência dos desafios ativos.' },
  { key: 'eventos', label: 'Próximos eventos', hint: 'A agenda da comunidade.' },
  { key: 'comunidade', label: 'Na comunidade', hint: 'O feed e a conversa entre todas.' },
  {
    key: 'jornada',
    label: 'Sua jornada',
    hint: 'Pontos e conquistas de cada participante.',
  },
  {
    key: 'instagram',
    label: 'No Instagram',
    hint: 'As publicações que a comunidade destaca.',
  },
]

export const COMMUNITY_CARD_KEYS = COMMUNITY_CARD_META.map((c) => c.key)

export const COMMUNITY_CARD_IMAGE_FORMAT =
  'Formato recomendado: retrato 4:5 (ex.: 1080 × 1350 px). JPG, PNG ou WebP, até 5 MB. Outras proporções são aceitas, mas podem aparecer recortadas.'
