// Texto da receita (ingredientes e modo de preparo) em itens, só para apresentar.
// O texto cadastrado não muda: aqui apenas se separa uma linha por item e se tira
// o marcador que a profissional já tenha digitado ("- ", "• ", "1. ").

const BULLET = /^\s*[-–•*]\s+/
const NUMBERING = /^\s*\d+\s*[.)]\s+/

/**
 * Uma linha por item. Em ingredientes, só tira marcadores (um "2 ovos" nunca
 * perde o número). No preparo, tira também a numeração ("1. ", "2) ").
 * Devolve `[]` para texto vazio.
 */
export function recipeItems(text: string | null | undefined, opts: { steps?: boolean } = {}): string[] {
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map((line) => {
      const noBullet = line.replace(BULLET, '')
      return (opts.steps ? noBullet.replace(NUMBERING, '') : noBullet).trim()
    })
    .filter(Boolean)
}

/** Só vira lista quando há mais de uma linha; um parágrafo único segue como texto. */
export function isList(items: string[]): boolean {
  return items.length > 1
}
