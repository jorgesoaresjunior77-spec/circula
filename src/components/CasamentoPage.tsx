import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { formatBrl } from '../lib/plansCatalog'
import {
  BUDGET_STATUS_LABEL,
  GIFT_STATUS_LABEL,
  GUEST_STATUS_LABEL,
  SIDE_LABEL,
  VENDOR_STATUS_LABEL,
  budgetTotals,
  centsToInput,
  daysUntil,
  guestTotals,
  guestsToCsv,
  parseBrl,
  parseGuestsCsv,
  publicWeddingUrl,
  taskDeadline,
} from '../lib/wedding'
import type { BudgetItem, BudgetStatus, Gift, GiftStatus, Guest, GuestSide, GuestStatus, Task, Vendor, VendorStatus, Wedding } from '../lib/wedding'

// Casamento: a gestão do casamento para os noivos, dentro do Círcula. Os dois acessam o mesmo casamento
// (a outra pessoa entra com o código de compartilhamento, com a conta dela). Convidados confirmam presença
// e reservam presentes por links públicos, sem login.

type Tab = 'resumo' | 'convidados' | 'presentes' | 'orcamento' | 'fornecedores' | 'checklist' | 'compartilhar'
const TABS: [Tab, string][] = [
  ['resumo', 'Resumo'],
  ['convidados', 'Convidados'],
  ['presentes', 'Presentes'],
  ['orcamento', 'Orçamento'],
  ['fornecedores', 'Fornecedores'],
  ['checklist', 'Checklist'],
  ['compartilhar', 'Links'],
]

function fmtDate(iso: string | null): string {
  if (!iso) return 'sem data'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function useWeddingData(weddingId: string | null) {
  const [guests, setGuests] = useState<Guest[]>([])
  const [gifts, setGifts] = useState<Gift[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [budget, setBudget] = useState<BudgetItem[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const load = useCallback(async () => {
    if (!weddingId) return
    const [g, gi, v, b, t] = await Promise.all([
      supabase.from('wedding_guests').select('*').eq('wedding_id', weddingId).order('name'),
      supabase.from('wedding_gifts').select('*').eq('wedding_id', weddingId).order('created_at'),
      supabase.from('wedding_vendors').select('*').eq('wedding_id', weddingId).order('name'),
      supabase.from('wedding_budget_items').select('*').eq('wedding_id', weddingId).order('created_at'),
      supabase.from('wedding_tasks').select('*').eq('wedding_id', weddingId).order('months_before', { ascending: false }),
    ])
    setGuests((g.data ?? []) as Guest[])
    setGifts((gi.data ?? []) as Gift[])
    setVendors((v.data ?? []) as Vendor[])
    setBudget((b.data ?? []) as BudgetItem[])
    setTasks(((t.data ?? []) as Task[]).map((x) => ({ ...x, months_before: Number(x.months_before) })))
  }, [weddingId])
  useEffect(() => {
    void load()
  }, [load])
  return { guests, gifts, vendors, budget, tasks, reload: load }
}

export function CasamentoPage() {
  const [wedding, setWedding] = useState<Wedding | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('resumo')
  const [error, setError] = useState<string | null>(null)

  const loadWedding = useCallback(async () => {
    setLoading(true)
    const { data, error: e } = await supabase.from('weddings').select('*').order('created_at').limit(1)
    if (e) setError(e.message)
    setWedding(((data ?? [])[0] as Wedding | undefined) ?? null)
    setLoading(false)
  }, [])
  useEffect(() => {
    void loadWedding()
  }, [loadWedding])

  const data = useWeddingData(wedding?.id ?? null)

  if (loading) return <p className="home-muted">Carregando…</p>
  if (!wedding) return <WeddingStart onReady={loadWedding} />

  return (
    <section className="cas-page">
      <header className="cas-head">
        <p className="cas-eyebrow">Casamento</p>
        <h2 className="cas-names">
          {wedding.partner_one || 'Noiva'} <span>&amp;</span> {wedding.partner_two || 'Noivo(a)'}
        </h2>
        <p className="cas-date">{fmtDate(wedding.wedding_date)}{wedding.venue ? ` · ${wedding.venue}` : ''}</p>
      </header>
      <nav className="cas-tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>
      {error && <p className="auth-error">{error}</p>}
      {tab === 'resumo' && <Resumo wedding={wedding} {...data} onEdit={loadWedding} />}
      {tab === 'convidados' && <Convidados weddingId={wedding.id} guests={data.guests} reload={data.reload} />}
      {tab === 'presentes' && <Presentes wedding={wedding} gifts={data.gifts} reload={data.reload} />}
      {tab === 'orcamento' && <Orcamento wedding={wedding} items={data.budget} vendors={data.vendors} reload={data.reload} />}
      {tab === 'fornecedores' && <Fornecedores weddingId={wedding.id} vendors={data.vendors} reload={data.reload} />}
      {tab === 'checklist' && <Checklist wedding={wedding} tasks={data.tasks} reload={data.reload} />}
      {tab === 'compartilhar' && <Compartilhar wedding={wedding} />}
    </section>
  )
}

// ---------------------------------------------------------------- começo
function WeddingStart({ onReady }: { onReady: () => void }) {
  const [one, setOne] = useState('')
  const [two, setTwo] = useState('')
  const [date, setDate] = useState('')
  const [venue, setVenue] = useState('')
  const [budget, setBudget] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.from('weddings').insert({
      partner_one: one.trim(),
      partner_two: two.trim(),
      wedding_date: date || null,
      venue: venue.trim(),
      budget_cents: parseBrl(budget),
    })
    setBusy(false)
    if (error) setMsg(error.message)
    else onReady()
  }
  return (
    <section className="cas-page">
      <header className="cas-head">
        <p className="cas-eyebrow">Casamento</p>
        <h2 className="cas-names">Vamos organizar o seu casamento</h2>
        <p className="cas-date">Convidados, confirmação de presença, presentes, orçamento, fornecedores e checklist num lugar só.</p>
      </header>
      <form className="cas-card cas-form" onSubmit={(e) => void create(e)}>
        <h3>Começar</h3>
        <p className="home-muted">O casamento fica todo na sua conta: só você cuida dele aqui no Círcula.</p>
        <label>
          Nome da noiva
          <input value={one} onChange={(e) => setOne(e.target.value)} maxLength={80} required />
        </label>
        <label>
          Nome do(a) parceiro(a)
          <input value={two} onChange={(e) => setTwo(e.target.value)} maxLength={80} />
        </label>
        <label>
          Data do casamento
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Local
          <input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={200} />
        </label>
        <label>
          Orçamento total (R$)
          <input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Ex.: 40.000,00" />
        </label>
        <button type="submit" className="water-primary" disabled={busy || !one.trim()}>
          Criar o casamento
        </button>
        <p className="home-muted">O checklist já vem com 20 tarefas típicas de casamento, com prazo calculado pela data.</p>
      </form>
      {msg && <p className="auth-error">{msg}</p>}
    </section>
  )
}

// ---------------------------------------------------------------- resumo
function Resumo({
  wedding,
  guests,
  gifts,
  budget,
  tasks,
  onEdit,
}: {
  wedding: Wedding
  guests: Guest[]
  gifts: Gift[]
  budget: BudgetItem[]
  tasks: Task[]
  onEdit: () => void
}) {
  const days = daysUntil(wedding.wedding_date)
  const gt = guestTotals(guests)
  const bt = budgetTotals(budget)
  const planned = bt.planned || wedding.budget_cents
  const received = gifts.filter((g) => g.status === 'recebido').length
  const done = tasks.filter((t) => t.done).length
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  const [editing, setEditing] = useState(false)
  return (
    <div className="cas-grid">
      <div className="cas-stat cas-stat--big">
        <strong>{days === null ? '—' : days >= 0 ? days : 0}</strong>
        <span>{days === null ? 'defina a data' : days === 0 ? 'é hoje!' : days > 0 ? 'dias para o casamento' : 'dias desde o casamento'}</span>
      </div>
      <div className="cas-stat">
        <strong>{gt.confirmado}</strong>
        <span>confirmados ({gt.pessoasConfirmadas} pessoas)</span>
      </div>
      <div className="cas-stat">
        <strong>{gt.pendente}</strong>
        <span>pendentes</span>
      </div>
      <div className="cas-stat">
        <strong>{gt.recusou}</strong>
        <span>recusaram</span>
      </div>
      <div className="cas-card cas-span">
        <h3>Orçamento</h3>
        <p>
          Previsto <b>{formatBrl(planned)}</b> · Pago <b>{formatBrl(bt.paid)}</b> · Falta pagar <b>{formatBrl(Math.max(0, planned - bt.paid))}</b>
        </p>
        <div className="cas-bar">
          <i style={{ width: `${planned ? Math.min(100, (bt.paid / planned) * 100) : 0}%` }} />
        </div>
      </div>
      <div className="cas-card cas-span">
        <h3>Checklist</h3>
        <p>
          {done} de {tasks.length} tarefas feitas ({pct}%)
        </p>
        <div className="cas-bar">
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="cas-card cas-span">
        <h3>Presentes</h3>
        <p>
          {received} recebidos · {gifts.filter((g) => g.status === 'reservado').length} reservados · {gifts.filter((g) => g.status === 'disponivel').length} disponíveis
        </p>
      </div>
      <div className="cas-span">
        {editing ? <EditWedding wedding={wedding} onDone={() => { setEditing(false); onEdit() }} /> : (
          <button type="button" className="water-link" onClick={() => setEditing(true)}>
            Editar nomes, data, local e orçamento
          </button>
        )}
      </div>
    </div>
  )
}

function EditWedding({ wedding, onDone }: { wedding: Wedding; onDone: () => void }) {
  const [one, setOne] = useState(wedding.partner_one)
  const [two, setTwo] = useState(wedding.partner_two)
  const [date, setDate] = useState(wedding.wedding_date ?? '')
  const [venue, setVenue] = useState(wedding.venue)
  const [budget, setBudget] = useState(centsToInput(wedding.budget_cents))
  async function save(e: FormEvent) {
    e.preventDefault()
    await supabase
      .from('weddings')
      .update({ partner_one: one.trim(), partner_two: two.trim(), wedding_date: date || null, venue: venue.trim(), budget_cents: parseBrl(budget) })
      .eq('id', wedding.id)
    onDone()
  }
  return (
    <form className="cas-card cas-form" onSubmit={(e) => void save(e)}>
      <label>Noiva<input value={one} onChange={(e) => setOne(e.target.value)} maxLength={80} /></label>
      <label>Parceiro(a)<input value={two} onChange={(e) => setTwo(e.target.value)} maxLength={80} /></label>
      <label>Data<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label>Local<input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={200} /></label>
      <label>Orçamento total (R$)<input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} /></label>
      <button type="submit" className="water-primary">Salvar</button>
    </form>
  )
}

// ---------------------------------------------------------------- convidados
const EMPTY_GUEST = { name: '', status: 'pendente' as GuestStatus, companions: 0, side: 'ambos' as GuestSide, group_name: '', phone: '', table_label: '', dietary: '', notes: '' }

function Convidados({ weddingId, guests, reload }: { weddingId: string; guests: Guest[]; reload: () => void }) {
  const [q, setQ] = useState('')
  const [fStatus, setFStatus] = useState<'' | GuestStatus>('')
  const [fSide, setFSide] = useState<'' | GuestSide>('')
  const [edit, setEdit] = useState<(typeof EMPTY_GUEST & { id?: string }) | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const list = useMemo(() => {
    const n = q.trim().toLowerCase()
    return guests.filter(
      (g) =>
        (!n || g.name.toLowerCase().includes(n) || g.group_name.toLowerCase().includes(n) || g.phone.includes(n)) &&
        (!fStatus || g.status === fStatus) &&
        (!fSide || g.side === fSide),
    )
  }, [guests, q, fStatus, fSide])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!edit) return
    const { id, ...row } = edit
    const res = id
      ? await supabase.from('wedding_guests').update(row).eq('id', id)
      : await supabase.from('wedding_guests').insert({ ...row, wedding_id: weddingId })
    if (res.error) setMsg(res.error.message)
    else {
      setEdit(null)
      reload()
    }
  }
  async function remove(id: string) {
    if (!window.confirm('Apagar este convidado?')) return
    await supabase.from('wedding_guests').delete().eq('id', id)
    reload()
  }
  function exportCsv() {
    const blob = new Blob(['﻿' + guestsToCsv(guests)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'convidados.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  async function importCsv(file: File) {
    const rows = parseGuestsCsv(await file.text())
    if (!rows.length) {
      setMsg('Nenhum convidado encontrado no arquivo. A primeira coluna deve ser o nome.')
      return
    }
    const { error } = await supabase.from('wedding_guests').insert(rows.map((r) => ({ ...r, wedding_id: weddingId })))
    setMsg(error ? error.message : `${rows.length} convidados importados.`)
    reload()
  }
  async function shareRsvp(g: Guest) {
    const url = publicWeddingUrl('rsvp', g.rsvp_token)
    const text = `Olá, ${g.name}! Confirme sua presença no nosso casamento por este link: ${url}`
    const phone = g.phone.replace(/\D/g, '')
    if (phone.length >= 10) window.open(`https://wa.me/${phone.length <= 11 ? '55' + phone : phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    else setMsg((await copy(url)) ? 'Link de confirmação copiado.' : url)
  }

  return (
    <div className="cas-section">
      <div className="cas-tools">
        <input className="cas-search" placeholder="Buscar por nome, grupo ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value as GuestStatus | '')} aria-label="Filtrar por status">
          <option value="">Todos</option>
          {Object.entries(GUEST_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={fSide} onChange={(e) => setFSide(e.target.value as GuestSide | '')} aria-label="Filtrar por lado">
          <option value="">Os dois lados</option>
          {Object.entries(SIDE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="cas-tools">
        <button type="button" className="water-primary" onClick={() => setEdit({ ...EMPTY_GUEST })}>+ Convidado</button>
        <button type="button" className="water-link" onClick={exportCsv} disabled={!guests.length}>Exportar CSV</button>
        <label className="water-link cas-file">
          Importar CSV
          <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importCsv(f); e.target.value = '' }} />
        </label>
      </div>
      {msg && <p className="home-muted">{msg}</p>}
      {edit && (
        <form className="cas-card cas-form" onSubmit={(e) => void save(e)}>
          <label>Nome<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={120} required /></label>
          <div className="cas-row">
            <label>Status
              <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as GuestStatus })}>
                {Object.entries(GUEST_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Acompanhantes<input type="number" min={0} max={20} value={edit.companions} onChange={(e) => setEdit({ ...edit, companions: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })} /></label>
            <label>Lado
              <select value={edit.side} onChange={(e) => setEdit({ ...edit, side: e.target.value as GuestSide })}>
                {Object.entries(SIDE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <div className="cas-row">
            <label>Grupo<input value={edit.group_name} onChange={(e) => setEdit({ ...edit, group_name: e.target.value })} maxLength={80} placeholder="Família, amigos…" /></label>
            <label>Telefone<input inputMode="tel" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} maxLength={30} /></label>
            <label>Mesa<input value={edit.table_label} onChange={(e) => setEdit({ ...edit, table_label: e.target.value })} maxLength={30} /></label>
          </div>
          <label>Restrição alimentar<input value={edit.dietary} onChange={(e) => setEdit({ ...edit, dietary: e.target.value })} maxLength={200} /></label>
          <label>Observações<textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} maxLength={1000} rows={2} /></label>
          <div className="cas-row">
            <button type="submit" className="water-primary">Salvar</button>
            <button type="button" className="water-link" onClick={() => setEdit(null)}>Cancelar</button>
          </div>
        </form>
      )}
      <p className="home-muted">{list.length} de {guests.length} convidados</p>
      <ul className="cas-list">
        {list.map((g) => (
          <li key={g.id} className={`cas-item cas-item--${g.status}`}>
            <div>
              <strong>{g.name}</strong>
              <span>
                {GUEST_STATUS_LABEL[g.status]}
                {g.companions ? ` · +${g.companions}` : ''} · {SIDE_LABEL[g.side]}
                {g.group_name ? ` · ${g.group_name}` : ''}
                {g.table_label ? ` · Mesa ${g.table_label}` : ''}
              </span>
              {g.dietary && <span>Restrição: {g.dietary}</span>}
            </div>
            <div className="cas-item-actions">
              <button type="button" onClick={() => void shareRsvp(g)}>Convite</button>
              <button type="button" onClick={() => setEdit({ ...g })}>Editar</button>
              <button type="button" onClick={() => void remove(g.id)}>Apagar</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- presentes
function Presentes({ wedding, gifts, reload }: { wedding: Wedding; gifts: Gift[]; reload: () => void }) {
  const [edit, setEdit] = useState<{ id?: string; name: string; category: string; value: string; link: string; status: GiftStatus; giver_name: string; thanked: boolean } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!edit) return
    const row = { name: edit.name.trim(), category: edit.category.trim(), value_cents: parseBrl(edit.value), link: edit.link.trim(), status: edit.status, giver_name: edit.giver_name.trim(), thanked: edit.thanked }
    const res = edit.id ? await supabase.from('wedding_gifts').update(row).eq('id', edit.id) : await supabase.from('wedding_gifts').insert({ ...row, wedding_id: wedding.id })
    if (res.error) setMsg(res.error.message)
    else {
      setEdit(null)
      reload()
    }
  }
  async function patch(id: string, row: Partial<Gift>) {
    await supabase.from('wedding_gifts').update(row).eq('id', id)
    reload()
  }
  const total = gifts.filter((g) => g.status === 'recebido' || g.status === 'comprado').reduce((s, g) => s + g.value_cents, 0)
  return (
    <div className="cas-section">
      <div className="cas-tools">
        <button type="button" className="water-primary" onClick={() => setEdit({ name: '', category: '', value: '', link: '', status: 'disponivel', giver_name: '', thanked: false })}>+ Presente</button>
        <button type="button" className="water-link" onClick={async () => setMsg((await copy(publicWeddingUrl('presentes', wedding.public_token))) ? 'Link da lista de presentes copiado. Mande para os convidados.' : publicWeddingUrl('presentes', wedding.public_token))}>
          Copiar link da lista
        </button>
      </div>
      <p className="home-muted">Recebidos e comprados: {formatBrl(total)}</p>
      {msg && <p className="home-muted">{msg}</p>}
      {edit && (
        <form className="cas-card cas-form" onSubmit={(e) => void save(e)}>
          <label>Presente<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={160} required /></label>
          <div className="cas-row">
            <label>Categoria<input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} maxLength={60} placeholder="Cozinha, cama…" /></label>
            <label>Valor (R$)<input inputMode="decimal" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} /></label>
          </div>
          <label>Link da loja (opcional)<input value={edit.link} onChange={(e) => setEdit({ ...edit, link: e.target.value })} maxLength={500} /></label>
          <div className="cas-row">
            <label>Status
              <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as GiftStatus })}>
                {Object.entries(GIFT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Quem deu<input value={edit.giver_name} onChange={(e) => setEdit({ ...edit, giver_name: e.target.value })} maxLength={120} /></label>
          </div>
          <label className="cas-check"><input type="checkbox" checked={edit.thanked} onChange={(e) => setEdit({ ...edit, thanked: e.target.checked })} /> Agradecimento enviado</label>
          <div className="cas-row">
            <button type="submit" className="water-primary">Salvar</button>
            <button type="button" className="water-link" onClick={() => setEdit(null)}>Cancelar</button>
          </div>
        </form>
      )}
      <ul className="cas-list">
        {gifts.map((g) => (
          <li key={g.id} className={`cas-item cas-item--${g.status}`}>
            <div>
              <strong>{g.name}</strong>
              <span>
                {GIFT_STATUS_LABEL[g.status]}
                {g.value_cents ? ` · ${formatBrl(g.value_cents)}` : ''}
                {g.category ? ` · ${g.category}` : ''}
                {g.giver_name ? ` · de ${g.giver_name}` : ''}
              </span>
            </div>
            <div className="cas-item-actions">
              <label className="cas-check"><input type="checkbox" checked={g.thanked} onChange={(e) => void patch(g.id, { thanked: e.target.checked })} /> Agradeci</label>
              <button type="button" onClick={() => setEdit({ id: g.id, name: g.name, category: g.category, value: centsToInput(g.value_cents), link: g.link, status: g.status, giver_name: g.giver_name, thanked: g.thanked })}>Editar</button>
              <button type="button" onClick={async () => { if (window.confirm('Apagar este presente?')) { await supabase.from('wedding_gifts').delete().eq('id', g.id); reload() } }}>Apagar</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- orçamento
function Orcamento({ wedding, items, vendors, reload }: { wedding: Wedding; items: BudgetItem[]; vendors: Vendor[]; reload: () => void }) {
  const [edit, setEdit] = useState<{ id?: string; item: string; category: string; planned: string; paid: string; status: BudgetStatus; vendor_id: string; due_date: string; notes: string } | null>(null)
  const t = budgetTotals(items)
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!edit) return
    const row = { item: edit.item.trim(), category: edit.category.trim(), planned_cents: parseBrl(edit.planned), paid_cents: parseBrl(edit.paid), status: edit.status, vendor_id: edit.vendor_id || null, due_date: edit.due_date || null, notes: edit.notes.trim() }
    const res = edit.id ? await supabase.from('wedding_budget_items').update(row).eq('id', edit.id) : await supabase.from('wedding_budget_items').insert({ ...row, wedding_id: wedding.id })
    if (!res.error) {
      setEdit(null)
      reload()
    }
  }
  return (
    <div className="cas-section">
      <div className="cas-grid">
        <div className="cas-stat"><strong>{formatBrl(t.planned)}</strong><span>previsto</span></div>
        <div className="cas-stat"><strong>{formatBrl(t.paid)}</strong><span>pago</span></div>
        <div className="cas-stat"><strong>{formatBrl(t.remaining)}</strong><span>falta pagar</span></div>
        <div className="cas-stat"><strong>{formatBrl(wedding.budget_cents)}</strong><span>orçamento total</span></div>
      </div>
      <div className="cas-tools">
        <button type="button" className="water-primary" onClick={() => setEdit({ item: '', category: '', planned: '', paid: '', status: 'a_contratar', vendor_id: '', due_date: '', notes: '' })}>+ Item</button>
      </div>
      {edit && (
        <form className="cas-card cas-form" onSubmit={(e) => void save(e)}>
          <label>Item<input value={edit.item} onChange={(e) => setEdit({ ...edit, item: e.target.value })} maxLength={120} required /></label>
          <div className="cas-row">
            <label>Categoria<input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} maxLength={60} /></label>
            <label>Previsto (R$)<input inputMode="decimal" value={edit.planned} onChange={(e) => setEdit({ ...edit, planned: e.target.value })} /></label>
            <label>Pago (R$)<input inputMode="decimal" value={edit.paid} onChange={(e) => setEdit({ ...edit, paid: e.target.value })} /></label>
          </div>
          <div className="cas-row">
            <label>Status
              <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as BudgetStatus })}>
                {Object.entries(BUDGET_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Fornecedor
              <select value={edit.vendor_id} onChange={(e) => setEdit({ ...edit, vendor_id: e.target.value })}>
                <option value="">—</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <label>Vencimento<input type="date" value={edit.due_date} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} /></label>
          </div>
          <label>Observações<textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} rows={2} maxLength={1000} /></label>
          <div className="cas-row">
            <button type="submit" className="water-primary">Salvar</button>
            <button type="button" className="water-link" onClick={() => setEdit(null)}>Cancelar</button>
          </div>
        </form>
      )}
      <ul className="cas-list">
        {items.map((i) => (
          <li key={i.id} className={`cas-item cas-item--${i.status}`}>
            <div>
              <strong>{i.item}</strong>
              <span>
                {BUDGET_STATUS_LABEL[i.status]} · previsto {formatBrl(i.planned_cents)} · pago {formatBrl(i.paid_cents)} · falta {formatBrl(Math.max(0, i.planned_cents - i.paid_cents))}
              </span>
              <span>
                {vendors.find((v) => v.id === i.vendor_id)?.name ?? ''}
                {i.due_date ? ` · vence ${fmtDate(i.due_date)}` : ''}
              </span>
            </div>
            <div className="cas-item-actions">
              <button type="button" onClick={() => setEdit({ id: i.id, item: i.item, category: i.category, planned: centsToInput(i.planned_cents), paid: centsToInput(i.paid_cents), status: i.status, vendor_id: i.vendor_id ?? '', due_date: i.due_date ?? '', notes: i.notes })}>Editar</button>
              <button type="button" onClick={async () => { if (window.confirm('Apagar este item?')) { await supabase.from('wedding_budget_items').delete().eq('id', i.id); reload() } }}>Apagar</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- fornecedores
function Fornecedores({ weddingId, vendors, reload }: { weddingId: string; vendors: Vendor[]; reload: () => void }) {
  const [edit, setEdit] = useState<{ id?: string; name: string; service: string; contact: string; phone: string; email: string; status: VendorStatus; agreed: string; notes: string } | null>(null)
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!edit) return
    const row = { name: edit.name.trim(), service: edit.service.trim(), contact: edit.contact.trim(), phone: edit.phone.trim(), email: edit.email.trim(), status: edit.status, agreed_cents: parseBrl(edit.agreed), notes: edit.notes.trim() }
    const res = edit.id ? await supabase.from('wedding_vendors').update(row).eq('id', edit.id) : await supabase.from('wedding_vendors').insert({ ...row, wedding_id: weddingId })
    if (!res.error) {
      setEdit(null)
      reload()
    }
  }
  return (
    <div className="cas-section">
      <div className="cas-tools">
        <button type="button" className="water-primary" onClick={() => setEdit({ name: '', service: '', contact: '', phone: '', email: '', status: 'pesquisando', agreed: '', notes: '' })}>+ Fornecedor</button>
      </div>
      {edit && (
        <form className="cas-card cas-form" onSubmit={(e) => void save(e)}>
          <div className="cas-row">
            <label>Nome<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={120} required /></label>
            <label>Serviço<input value={edit.service} onChange={(e) => setEdit({ ...edit, service: e.target.value })} maxLength={80} placeholder="Buffet, foto…" /></label>
          </div>
          <div className="cas-row">
            <label>Contato<input value={edit.contact} onChange={(e) => setEdit({ ...edit, contact: e.target.value })} maxLength={120} /></label>
            <label>Telefone<input inputMode="tel" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} maxLength={30} /></label>
            <label>E-mail<input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} maxLength={160} /></label>
          </div>
          <div className="cas-row">
            <label>Status
              <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as VendorStatus })}>
                {Object.entries(VENDOR_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Valor combinado (R$)<input inputMode="decimal" value={edit.agreed} onChange={(e) => setEdit({ ...edit, agreed: e.target.value })} /></label>
          </div>
          <label>Observações<textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} rows={2} maxLength={1000} /></label>
          <div className="cas-row">
            <button type="submit" className="water-primary">Salvar</button>
            <button type="button" className="water-link" onClick={() => setEdit(null)}>Cancelar</button>
          </div>
        </form>
      )}
      <ul className="cas-list">
        {vendors.map((v) => (
          <li key={v.id} className={`cas-item cas-item--${v.status}`}>
            <div>
              <strong>{v.name}</strong>
              <span>
                {v.service ? `${v.service} · ` : ''}
                {VENDOR_STATUS_LABEL[v.status]}
                {v.agreed_cents ? ` · ${formatBrl(v.agreed_cents)}` : ''}
              </span>
              <span>{[v.contact, v.phone, v.email].filter(Boolean).join(' · ')}</span>
            </div>
            <div className="cas-item-actions">
              <button type="button" onClick={() => setEdit({ id: v.id, name: v.name, service: v.service, contact: v.contact, phone: v.phone, email: v.email, status: v.status, agreed: centsToInput(v.agreed_cents), notes: v.notes })}>Editar</button>
              <button type="button" onClick={async () => { if (window.confirm('Apagar este fornecedor?')) { await supabase.from('wedding_vendors').delete().eq('id', v.id); reload() } }}>Apagar</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- checklist
function Checklist({ wedding, tasks, reload }: { wedding: Wedding; tasks: Task[]; reload: () => void }) {
  const [title, setTitle] = useState('')
  const [months, setMonths] = useState('1')
  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await supabase.from('wedding_tasks').insert({ wedding_id: wedding.id, title: title.trim(), months_before: Math.max(0, Math.min(36, Number(months.replace(',', '.')) || 0)) })
    setTitle('')
    reload()
  }
  async function toggle(t: Task) {
    await supabase.from('wedding_tasks').update({ done: !t.done, done_at: !t.done ? new Date().toISOString() : null }).eq('id', t.id)
    reload()
  }
  const today = new Date()
  return (
    <div className="cas-section">
      {!wedding.wedding_date && <p className="home-muted">Defina a data do casamento no Resumo para ver o prazo de cada tarefa.</p>}
      <ul className="cas-list">
        {tasks.map((t) => {
          const due = taskDeadline(wedding.wedding_date, t.months_before)
          const late = !t.done && due && due < today
          return (
            <li key={t.id} className={`cas-item cas-task${t.done ? ' is-done' : ''}${late ? ' is-late' : ''}`}>
              <label className="cas-check">
                <input type="checkbox" checked={t.done} onChange={() => void toggle(t)} />
                <span>
                  <strong>{t.title}</strong>
                  <span>
                    {t.months_before >= 1 ? `${String(t.months_before).replace('.', ',')} ${t.months_before === 1 ? 'mês' : 'meses'} antes` : `${Math.round(t.months_before * 30)} dias antes`}
                    {due ? ` · até ${due.toLocaleDateString('pt-BR')}` : ''}
                    {late ? ' · atrasada' : ''}
                  </span>
                </span>
              </label>
              <div className="cas-item-actions">
                <button type="button" onClick={async () => { if (window.confirm('Apagar esta tarefa?')) { await supabase.from('wedding_tasks').delete().eq('id', t.id); reload() } }}>Apagar</button>
              </div>
            </li>
          )
        })}
      </ul>
      <form className="cas-card cas-form" onSubmit={(e) => void add(e)}>
        <h3>Nova tarefa</h3>
        <div className="cas-row">
          <label>Tarefa<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} /></label>
          <label>Meses antes<input inputMode="decimal" value={months} onChange={(e) => setMonths(e.target.value)} /></label>
        </div>
        <button type="submit" className="water-primary" disabled={!title.trim()}>Adicionar</button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------- links e acesso
function Compartilhar({ wedding }: { wedding: Wedding }) {
  const [msg, setMsg] = useState<string | null>(null)
  const gifts = publicWeddingUrl('presentes', wedding.public_token)
  return (
    <div className="cas-section">
      <div className="cas-card">
        <h3>Lista de presentes</h3>
        <p>Página aberta, sem login: os convidados veem a lista e reservam um presente.</p>
        <button type="button" className="water-link" onClick={async () => setMsg((await copy(gifts)) ? 'Link da lista copiado.' : gifts)}>Copiar link</button>
      </div>
      <div className="cas-card">
        <h3>Confirmação de presença</h3>
        <p>Cada convidado tem um link único. Em Convidados, toque em “Convite” para mandar pelo WhatsApp (ou copiar).</p>
      </div>
      {msg && <p className="home-muted">{msg}</p>}
    </div>
  )
}
