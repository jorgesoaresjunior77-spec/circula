// Pacotes pagos à parte pela membro. Enquanto a cobrança deles não existe no
// sistema, quem libera é a nutricionista, no Painel (tabela
// member_package_access). O plano completo vale pelos outros dois.

export type PackageKey = 'help_nutri' | 'ebooks' | 'total'

export const PACKAGE_KEYS: PackageKey[] = ['help_nutri', 'ebooks', 'total']

export const PACKAGE_LABEL: Record<PackageKey, string> = {
  help_nutri: 'Help Nutri',
  ebooks: 'E-books',
  total: 'Plano completo',
}

export const PACKAGE_HINT: Record<PackageKey, string> = {
  help_nutri: 'Pode enviar mensagem à nutri.',
  ebooks: 'Pode ler os e-books da Loja.',
  total: 'Vale pelo Help Nutri e pelos E-books.',
}

type Owned = ReadonlySet<string> | readonly string[]

function has(owned: Owned, key: PackageKey): boolean {
  return Array.isArray(owned) ? owned.includes(key) : (owned as ReadonlySet<string>).has(key)
}

/** Pode falar com a nutri: pacote Help Nutri ou plano completo. */
export function canUseHelpNutri(owned: Owned): boolean {
  return has(owned, 'help_nutri') || has(owned, 'total')
}

/** Pode ler os e-books: pacote E-books ou plano completo. */
export function canReadEbooks(owned: Owned): boolean {
  return has(owned, 'ebooks') || has(owned, 'total')
}
