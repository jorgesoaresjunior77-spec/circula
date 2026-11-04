// Revista Círcula Woman Magazine — edições e páginas (migration
// 20261104120000_revista_circula.sql). Só imagens: nada é gerado por IA.

export interface MagazinePage {
  id: string
  issue_id: string
  position: number
  image_path: string
}

export interface MagazineIssue {
  id: string
  community_id: string
  title: string
  cover_path: string | null
  /** 'YYYY-MM-DD' — a edição só aparece para as membros a partir daqui. */
  release_date: string
  pages: MagazinePage[]
}

/** Edições em branco mostradas enquanto a primeira ainda não foi cadastrada. */
export const MAGAZINE_PLACEHOLDER_COUNT = 4
/** Páginas em branco do leitor quando a edição ainda não tem páginas. */
export const MAGAZINE_BLANK_PAGES = 4
