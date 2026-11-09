import { HELP_CATEGORIES } from './helpContent'
import type { HelpCategory, HelpItem } from './helpContent'

// Busca da Central de Ajuda: ignora maiúsculas/minúsculas e acentos, aceita
// palavras incompletas e exige que TODAS as palavras digitadas apareçam (no
// título, na resposta, nas palavras-chave ou na categoria).

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export interface HelpHit {
  item: HelpItem
  category: HelpCategory
  /** Maior = mais relevante (título pesa mais que o corpo). */
  score: number
}

export function searchHelp(query: string, categories: HelpCategory[] = HELP_CATEGORIES): HelpHit[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const hits: HelpHit[] = []
  for (const category of categories) {
    for (const item of category.items) {
      const title = normalize(item.q)
      const body = normalize(`${item.a} ${item.k ?? ''} ${category.title}`)
      let score = 0
      let all = true
      for (const t of tokens) {
        const inTitle = title.includes(t)
        const inBody = body.includes(t)
        if (!inTitle && !inBody) {
          all = false
          break
        }
        score += inTitle ? 3 : 1
      }
      if (all) hits.push({ item, category, score })
    }
  }
  return hits.sort((a, b) => b.score - a.score)
}
