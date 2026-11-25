// Topo do app (hero): uma única imagem fixa, cadastrada em Painel > Imagens da comunidade (campo hero_1).
// (O nome do arquivo ficou de quando havia rodízio de 6 imagens; as chaves hero_2 a hero_6 já não são usadas.)

export const HERO_KEY = 'hero_1' as const

/** Caminho da imagem do topo, ou null se nenhum campo foi preenchido. */
export function heroImage(images: Partial<Record<string, string>>): string | null {
  return images[HERO_KEY] || null
}
