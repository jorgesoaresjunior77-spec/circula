export type ProductType =
  | 'course'
  | 'ebook'
  | 'workshop'
  | 'event'
  | 'consultation'
  | 'physical'

export type ProductStatus = 'draft' | 'published' | 'archived'

export type ProductDeliverableKind = 'none' | 'file' | 'external_link' | 'scheduling'

export interface Product {
  id: string
  community_id: string
  created_by: string
  type: ProductType
  title: string
  description: string | null
  cover_image_url: string | null
  price_cents: number
  currency: string
  status: ProductStatus
  max_quantity: number | null
  deliverable_kind: ProductDeliverableKind
  deliverable_url: string | null
  deliverable_file_path: string | null
  event_starts_at: string | null
  event_is_online: boolean | null
  event_location: string | null
  requires_shipping: boolean
  // Legado (Hotmart): link de checkout externo. A Loja não usa mais — os
  // produtos digitais passaram a ser liberados pelo plano. A coluna segue
  // no banco e o valor é só preservado ao editar.
  checkout_url: string | null
  created_at: string
  updated_at: string
}

// Campos que a Professional edita pela interface. Não inclui
// deliverable_file_path (reservado para a etapa de Storage), nem status
// (alterado por ações dedicadas: publicar / arquivar / voltar a rascunho),
// nem currency (fixo em 'BRL' no banco).
export interface ProductInput {
  type: ProductType
  title: string
  description: string | null
  cover_image_url: string | null
  price_cents: number
  max_quantity: number | null
  deliverable_kind: ProductDeliverableKind
  deliverable_url: string | null
  event_starts_at: string | null
  event_is_online: boolean | null
  event_location: string | null
  requires_shipping: boolean
  checkout_url: string | null
}

export type ProductResult = { error: string | null }

// ---- rótulos e helpers de domínio (pt-BR) -------------------------

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  course: 'Curso',
  ebook: 'E-book',
  workshop: 'Workshop',
  event: 'Evento',
  consultation: 'Consulta',
  physical: 'Produto físico',
}

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  archived: 'Arquivado',
}

export const PRODUCT_DELIVERABLE_KIND_LABELS: Record<ProductDeliverableKind, string> = {
  none: 'Sem entrega digital',
  file: 'Arquivo',
  external_link: 'Link externo',
  scheduling: 'Agendamento',
}

export function isEventProductType(type: ProductType): boolean {
  return type === 'event' || type === 'workshop'
}

// Produtos digitais: não são vendidos um a um; ficam liberados para quem tem
// o pacote de E-books ou o Superpacote (ver ProductCard.tsx).
export function isDigitalProductType(type: ProductType): boolean {
  return type === 'ebook' || type === 'course'
}

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatPriceBRL(cents: number): string {
  return BRL_FORMATTER.format(cents / 100)
}
