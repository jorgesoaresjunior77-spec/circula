// Prateleiras da Loja: os produtos publicados são distribuídos em fileiras de
// tamanho fixo. Sempre há pelo menos 3 prateleiras (vazias enquanto não há
// produto), e a última fileira é completada com lugares vazios.

export const SHELF_SIZE = 3
export const MIN_SHELVES = 3

export function shelfRows<T>(items: T[], size = SHELF_SIZE, minRows = MIN_SHELVES): (T | null)[][] {
  const rows: (T | null)[][] = []
  for (let i = 0; i < items.length; i += size) {
    const row: (T | null)[] = items.slice(i, i + size)
    while (row.length < size) row.push(null)
    rows.push(row)
  }
  while (rows.length < minRows) rows.push(Array.from({ length: size }, () => null))
  return rows
}
