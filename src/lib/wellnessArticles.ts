// Matérias do Wellness: texto longo escrito pela profissional, com imagens
// espalhadas ao longo da leitura. Nada é gerado pelo app.

export interface WellnessArticle {
  id: string
  community_id: string
  title: string
  description: string | null
  body: string | null
  cover_path: string | null
  image_paths: string[]
  status: 'draft' | 'published'
  created_at: string
}

/** Mínimo de imagens recomendado numa matéria; o máximo é o do banco. */
export const ARTICLE_MIN_IMAGES = 3
export const ARTICLE_MAX_IMAGES = 12

/** Quebra o texto em parágrafos (linhas em branco separam). */
export function splitParagraphs(body: string | null | undefined): string[] {
  return (body ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export type ArticleBlock = { type: 'text'; text: string } | { type: 'image'; path: string }

/** Distribui as imagens em intervalos iguais entre os parágrafos: a primeira
 *  logo depois da abertura e as outras ao longo do texto. Sobra de imagens
 *  (mais imagens do que parágrafos) vai para o fim. */
export function layoutArticle(paragraphs: string[], images: string[]): ArticleBlock[] {
  const blocks: ArticleBlock[] = []
  const n = paragraphs.length
  const k = images.length
  if (n === 0) return images.map((path) => ({ type: 'image', path }))
  let next = 0
  paragraphs.forEach((text, i) => {
    blocks.push({ type: 'text', text })
    // depois do parágrafo i, quantas imagens já deveriam ter aparecido?
    const due = Math.min(k, Math.round(((i + 1) * k) / n))
    while (next < due) blocks.push({ type: 'image', path: images[next++] })
  })
  while (next < k) blocks.push({ type: 'image', path: images[next++] })
  return blocks
}
