// Módulo 7 — SALVOS. Sem tabela por tipo: `saved_items` é polimórfica
// (item_type + item_id), sem FK real — a integridade é garantida pela
// RLS (ver migration) e por gatilhos de limpeza, não pelo schema.

export type SavedItemType = 'content' | 'post' | 'event'

export interface SavedItemRow {
  id: string
  profile_id: string
  item_type: SavedItemType
  item_id: string
  created_at: string
}

export type ToggleSaveResult = { error: string | null }
