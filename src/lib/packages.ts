// Pacotes pagos à parte pela membro. Enquanto a cobrança deles não existe no
// sistema, quem libera é a nutricionista, no Painel (tabela
// member_package_access). O plano completo vale pelos outros dois.

export type PackageKey =
  | 'help_nutri'
  | 'ebooks'
  | 'total'
  | 'respiracao'
  | 'playlist'
  | 'wellness'
  | 'leitura'
  | 'premium'
  | 'magazine'
  | 'receitas'
  | 'minha_lista'

export const PACKAGE_KEYS: PackageKey[] = [
  'help_nutri',
  'ebooks',
  'respiracao',
  'wellness',
  'leitura',
  'playlist',
  'magazine',
  'receitas',
  'minha_lista',
  'premium',
  'total',
]

export const PACKAGE_LABEL: Record<PackageKey, string> = {
  help_nutri: 'Help Nutri',
  ebooks: 'E-books',
  total: 'Plano completo',
  respiracao: 'Respiração',
  playlist: 'Playlist',
  wellness: 'Wellness',
  leitura: 'Dicas de Leitura',
  premium: 'Círcula Premium',
  magazine: 'Círcula Magazine',
  receitas: 'Receitas',
  minha_lista: 'Minha Lista',
}

export const PACKAGE_HINT: Record<PackageKey, string> = {
  help_nutri: 'Pode enviar mensagem à nutri.',
  ebooks: 'Pode ler os e-books da Loja.',
  total: 'Vale pelo Help Nutri e pelos E-books.',
  respiracao: 'Pode usar as práticas de Respiração e Meditação.',
  playlist: 'Pode ouvir as playlists.',
  wellness: 'Pode ler as matérias do Wellness.',
  leitura: 'Pode ler as Dicas de Leitura.',
  premium: 'Vale por todos os conteúdos pagos.',
  magazine: 'Pode ler a revista.',
  receitas: 'Pode ver as receitas.',
  minha_lista: 'Pode usar a Minha Lista (listas de compras).',
}

type Owned = ReadonlySet<string> | readonly string[]

function has(owned: Owned, key: PackageKey): boolean {
  return Array.isArray(owned) ? owned.includes(key) : (owned as ReadonlySet<string>).has(key)
}

/** Pode falar com a nutri: pacote Help Nutri ou plano completo. */
export function canUseHelpNutri(owned: Owned): boolean {
  return has(owned, 'help_nutri') || has(owned, 'total') || has(owned, 'premium')
}

/** Pode ler os e-books: pacote E-books ou plano completo. */
export function canReadEbooks(owned: Owned): boolean {
  return has(owned, 'ebooks') || has(owned, 'total') || has(owned, 'premium')
}

/** Pode usar a Respiração e Meditação: pacote Respiração ou Círcula Premium. */
export function canUseBreathing(owned: Owned): boolean {
  return has(owned, 'respiracao') || has(owned, 'premium')
}

/** Pode ler as Dicas de Leitura: pacote Dicas de Leitura ou Círcula Premium. */
export function canReadReadingTips(owned: Owned): boolean {
  return has(owned, 'leitura') || has(owned, 'premium')
}

/** Pode ler as matérias do Wellness: pacote Wellness ou Círcula Premium. */
export function canReadWellness(owned: Owned): boolean {
  return has(owned, 'wellness') || has(owned, 'premium')
}

/** Pode ouvir as Playlists: pacote Playlist ou Círcula Premium. */
export function canListenPlaylist(owned: Owned): boolean {
  return has(owned, 'playlist') || has(owned, 'premium')
}

/** Pode usar a Minha Lista: pacote Minha Lista ou Círcula Premium (que já a inclui). */
export function canUseMinhaLista(owned: Owned): boolean {
  return has(owned, 'minha_lista') || has(owned, 'premium')
}
