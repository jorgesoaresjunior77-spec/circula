// Casamento: tipos, contas e CSV dos convidados (sem acesso ao banco: testável).

export type GuestStatus = 'pendente' | 'confirmado' | 'recusou'
export type GuestSide = 'noiva' | 'noivo' | 'ambos'
export type GiftStatus = 'disponivel' | 'reservado' | 'comprado' | 'recebido'
export type VendorStatus = 'pesquisando' | 'orcamento' | 'contratado' | 'descartado'
export type BudgetStatus = 'a_contratar' | 'contratado' | 'pago'

export interface Wedding {
  id: string
  owner_id: string
  partner_one: string
  partner_two: string
  wedding_date: string | null
  venue: string
  budget_cents: number
  share_code: string
  public_token: string
}
export interface Guest {
  id: string
  name: string
  status: GuestStatus
  companions: number
  side: GuestSide
  group_name: string
  phone: string
  table_label: string
  dietary: string
  notes: string
  rsvp_token: string
}
export interface Gift {
  id: string
  name: string
  category: string
  value_cents: number
  link: string
  status: GiftStatus
  giver_name: string
  thanked: boolean
}
export interface Vendor {
  id: string
  name: string
  service: string
  contact: string
  phone: string
  email: string
  status: VendorStatus
  agreed_cents: number
  notes: string
}
export interface BudgetItem {
  id: string
  item: string
  category: string
  planned_cents: number
  paid_cents: number
  status: BudgetStatus
  vendor_id: string | null
  due_date: string | null
  notes: string
}
export interface Task {
  id: string
  title: string
  months_before: number
  done: boolean
  notes: string
}

export const GUEST_STATUS_LABEL: Record<GuestStatus, string> = { pendente: 'Pendente', confirmado: 'Confirmado', recusou: 'Recusou' }
export const SIDE_LABEL: Record<GuestSide, string> = { noiva: 'Noiva', noivo: 'Noivo', ambos: 'Ambos' }
export const GIFT_STATUS_LABEL: Record<GiftStatus, string> = { disponivel: 'Disponível', reservado: 'Reservado', comprado: 'Comprado', recebido: 'Recebido' }
export const VENDOR_STATUS_LABEL: Record<VendorStatus, string> = { pesquisando: 'Pesquisando', orcamento: 'Orçamento', contratado: 'Contratado', descartado: 'Descartado' }
export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = { a_contratar: 'A contratar', contratado: 'Contratado', pago: 'Pago' }

/** Dias até o casamento (negativo se já passou; null sem data). Conta em dias de calendário. */
export function daysUntil(date: string | null, now: Date = new Date()): number | null {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return null
  const target = Date.UTC(y, m - 1, d)
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86400000)
}

/** Prazo da tarefa: a data do casamento menos os meses (frações viram dias). */
export function taskDeadline(date: string | null, monthsBefore: number): Date | null {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return null
  const whole = Math.floor(monthsBefore)
  const extraDays = Math.round((monthsBefore - whole) * 30)
  const out = new Date(y, m - 1 - whole, d)
  out.setDate(out.getDate() - extraDays)
  return out
}

export function guestTotals(guests: Pick<Guest, 'status' | 'companions'>[]) {
  const t = { confirmado: 0, pendente: 0, recusou: 0, pessoasConfirmadas: 0 }
  for (const g of guests) {
    t[g.status] += 1
    if (g.status === 'confirmado') t.pessoasConfirmadas += 1 + (g.companions || 0)
  }
  return t
}

export function budgetTotals(items: Pick<BudgetItem, 'planned_cents' | 'paid_cents'>[]) {
  let planned = 0
  let paid = 0
  for (const i of items) {
    planned += i.planned_cents || 0
    paid += i.paid_cents || 0
  }
  return { planned, paid, remaining: Math.max(0, planned - paid) }
}

/** "1.234,56" ou "1234.56" ou "R$ 50" -> centavos. */
export function parseBrl(text: string): number {
  const clean = text.replace(/[^\d,.-]/g, '')
  if (!clean) return 0
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  const n = Number(normalized)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0
}

export function centsToInput(cents: number): string {
  return cents ? (cents / 100).toFixed(2).replace('.', ',') : ''
}

const CSV_HEAD = ['nome', 'status', 'acompanhantes', 'lado', 'grupo', 'telefone', 'mesa', 'restricao_alimentar', 'observacoes']

function csvCell(v: string | number): string {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV com ponto e vírgula (abre direto no Excel em português). */
export function guestsToCsv(guests: Guest[]): string {
  const rows = guests.map((g) =>
    [g.name, GUEST_STATUS_LABEL[g.status], g.companions, SIDE_LABEL[g.side], g.group_name, g.phone, g.table_label, g.dietary, g.notes].map(csvCell).join(';'),
  )
  return [CSV_HEAD.join(';'), ...rows].join('\n')
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') q = false
      else cur += ch
    } else if (ch === '"') q = true
    else if (ch === sep) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Lê o CSV de convidados (vírgula ou ponto e vírgula; a 1ª linha pode ser o cabeçalho). Só o nome é obrigatório. */
export function parseGuestsCsv(text: string): Omit<Guest, 'id' | 'rsvp_token'>[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
  let start = 0
  let idx: Record<string, number> = { nome: 0, status: 1, acompanhantes: 2, lado: 3, grupo: 4, telefone: 5, mesa: 6, restricao_alimentar: 7, observacoes: 8 }
  const head = splitCsvLine(lines[0], sep).map(norm)
  if (head.includes('nome')) {
    start = 1
    idx = {}
    head.forEach((h, i) => {
      const key = h.replace(/\s+/g, '_')
      idx[key.startsWith('restric') ? 'restricao_alimentar' : key.startsWith('observ') ? 'observacoes' : key] = i
    })
  }
  const status = (v: string): GuestStatus => {
    const n = norm(v)
    return n.startsWith('conf') ? 'confirmado' : n.startsWith('rec') ? 'recusou' : 'pendente'
  }
  const side = (v: string): GuestSide => {
    const n = norm(v)
    return n === 'noiva' ? 'noiva' : n === 'noivo' ? 'noivo' : 'ambos'
  }
  const out: Omit<Guest, 'id' | 'rsvp_token'>[] = []
  for (const line of lines.slice(start)) {
    const c = splitCsvLine(line, sep)
    const get = (k: string) => (idx[k] !== undefined ? (c[idx[k]] ?? '') : '')
    const name = get('nome').slice(0, 120)
    if (!name) continue
    out.push({
      name,
      status: status(get('status')),
      companions: Math.max(0, Math.min(20, parseInt(get('acompanhantes'), 10) || 0)),
      side: side(get('lado')),
      group_name: get('grupo').slice(0, 80),
      phone: get('telefone').slice(0, 30),
      table_label: get('mesa').slice(0, 30),
      dietary: get('restricao_alimentar').slice(0, 200),
      notes: get('observacoes').slice(0, 1000),
    })
  }
  return out
}

/** Endereço público (sem login) do app: confirmação de presença ou lista de presentes. */
export function publicWeddingUrl(kind: 'rsvp' | 'presentes', token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?${kind}=${encodeURIComponent(token)}`
}

/** Lê ?rsvp= ou ?presentes= do endereço (páginas públicas do casamento). */
export function readPublicWeddingParam(search: string = window.location.search): { kind: 'rsvp' | 'presentes'; token: string } | null {
  const p = new URLSearchParams(search)
  const rsvp = p.get('rsvp')
  if (rsvp && /^[a-f0-9]{16,64}$/i.test(rsvp)) return { kind: 'rsvp', token: rsvp }
  const gifts = p.get('presentes')
  if (gifts && /^[a-f0-9]{16,64}$/i.test(gifts)) return { kind: 'presentes', token: gifts }
  return null
}
