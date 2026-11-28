import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { formatBrl } from '../lib/plansCatalog'
import { publicWeddingUrl } from '../lib/wedding'
import circulaIcon from '../assets/circula-icon.png'

// Páginas abertas (sem login) do Casamento: o convidado confirma presença pelo link dele (?rsvp=...)
// e qualquer convidado vê a lista de presentes e reserva um (?presentes=...). Tudo passa por funções do
// banco que só aceitam o token do link.

interface RsvpInfo {
  name: string
  status: 'pendente' | 'confirmado' | 'recusou'
  companions: number
  dietary: string
  partner_one: string
  partner_two: string
  wedding_date: string | null
  venue: string
  gifts_token: string
}
interface GiftsInfo {
  partner_one: string
  partner_two: string
  wedding_date: string | null
  gifts: { id: string; name: string; category: string; value_cents: number; link: string; available: boolean }[]
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function Shell({ couple, date, children }: { couple: string; date: string | null; children: React.ReactNode }) {
  return (
    <main className="pubwed">
      <header className="pubwed-head">
        <p className="pubwed-eyebrow">Casamento</p>
        <h1 className="pubwed-names">{couple}</h1>
        {date && <p className="pubwed-date">{fmtDate(date)}</p>}
      </header>
      {children}
      <footer className="pubwed-foot">
        <img src={circulaIcon} alt="" width={22} height={22} /> Organizado com o Círcula
      </footer>
    </main>
  )
}

function Rsvp({ token }: { token: string }) {
  const [info, setInfo] = useState<RsvpInfo | null | undefined>(undefined)
  const [companions, setCompanions] = useState(0)
  const [dietary, setDietary] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void supabase.rpc('public_rsvp_get', { p_token: token }).then(({ data }) => {
      const d = (data as RsvpInfo | null) ?? null
      setInfo(d)
      if (d) {
        setCompanions(d.companions)
        setDietary(d.dietary)
      }
    })
  }, [token])
  async function answer(status: 'confirmado' | 'recusou', e?: FormEvent) {
    e?.preventDefault()
    setBusy(true)
    const { error } = await supabase.rpc('public_rsvp_answer', { p_token: token, p_status: status, p_companions: companions, p_dietary: dietary })
    setBusy(false)
    setDone(error ? 'Não foi possível registrar agora. Tente de novo.' : status === 'confirmado' ? 'Presença confirmada! Obrigado.' : 'Resposta registrada. Obrigado por avisar.')
  }
  if (info === undefined) return <main className="pubwed"><p>Carregando…</p></main>
  if (!info) return <main className="pubwed"><p>Este link de confirmação não foi encontrado.</p></main>
  const couple = [info.partner_one, info.partner_two].filter(Boolean).join(' & ')
  return (
    <Shell couple={couple} date={info.wedding_date}>
      <section className="pubwed-card">
        <h2>Olá, {info.name}!</h2>
        {info.venue && <p>Local: {info.venue}</p>}
        <p>Você vem ao nosso casamento?</p>
        <form onSubmit={(e) => void answer('confirmado', e)}>
          <label>
            Acompanhantes
            <input type="number" min={0} max={20} value={companions} onChange={(e) => setCompanions(Math.max(0, Math.min(20, Number(e.target.value) || 0)))} />
          </label>
          <label>
            Alguma restrição alimentar?
            <input value={dietary} onChange={(e) => setDietary(e.target.value)} maxLength={200} />
          </label>
          <div className="pubwed-actions">
            <button type="submit" className="pubwed-yes" disabled={busy}>Sim, eu vou</button>
            <button type="button" className="pubwed-no" disabled={busy} onClick={() => void answer('recusou')}>Não poderei ir</button>
          </div>
        </form>
        {done && <p className="pubwed-done" role="status">{done}</p>}
        {info.status !== 'pendente' && !done && <p className="pubwed-small">Sua resposta atual: {info.status === 'confirmado' ? 'confirmado' : 'não vai'}. Você pode mudar.</p>}
      </section>
      <a className="pubwed-link" href={publicWeddingUrl('presentes', info.gifts_token)}>Ver a lista de presentes</a>
    </Shell>
  )
}

function Gifts({ token }: { token: string }) {
  const [info, setInfo] = useState<GiftsInfo | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const load = () =>
    void supabase.rpc('public_gifts_get', { p_token: token }).then(({ data }) => setInfo((data as GiftsInfo | null) ?? null))
  useEffect(load, [token])
  async function reserve(id: string) {
    if (name.trim().length < 2) {
      setMsg('Escreva o seu nome antes de reservar.')
      return
    }
    const { data, error } = await supabase.rpc('public_gift_reserve', { p_token: token, p_gift: id, p_name: name })
    setMsg(error ? error.message : data ? 'Presente reservado! Obrigado.' : 'Esse presente acabou de ser reservado por outra pessoa.')
    load()
  }
  if (info === undefined) return <main className="pubwed"><p>Carregando…</p></main>
  if (!info) return <main className="pubwed"><p>Esta lista de presentes não foi encontrada.</p></main>
  const couple = [info.partner_one, info.partner_two].filter(Boolean).join(' & ')
  return (
    <Shell couple={couple} date={info.wedding_date}>
      <section className="pubwed-card">
        <h2>Lista de presentes</h2>
        <label>
          Seu nome
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Para os noivos saberem quem deu" />
        </label>
        {msg && <p className="pubwed-done" role="status">{msg}</p>}
      </section>
      <ul className="pubwed-gifts">
        {info.gifts.map((g) => (
          <li key={g.id} className={g.available ? '' : 'is-taken'}>
            <div>
              <strong>{g.name}</strong>
              <span>
                {g.category}
                {g.value_cents ? ` · ${formatBrl(g.value_cents)}` : ''}
              </span>
              {g.link && /^https?:\/\//.test(g.link) && (
                <a href={g.link} target="_blank" rel="noopener noreferrer">Ver na loja</a>
              )}
            </div>
            {g.available ? (
              <button type="button" onClick={() => void reserve(g.id)}>Reservar</button>
            ) : (
              <span className="pubwed-taken">Reservado</span>
            )}
          </li>
        ))}
        {!info.gifts.length && <li>Os noivos ainda não colocaram presentes na lista.</li>}
      </ul>
    </Shell>
  )
}

export function PublicWeddingPage({ kind, token }: { kind: 'rsvp' | 'presentes'; token: string }) {
  return kind === 'rsvp' ? <Rsvp token={token} /> : <Gifts token={token} />
}
