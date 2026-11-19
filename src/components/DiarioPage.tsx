import { useState } from 'react'
import type { FormEvent } from 'react'
import { PrayingHands } from './PrayingHands'
import { useGratitude } from '../hooks/useGratitude'
import { amenMessage, prayerOfTheDay, streak } from '../lib/gratitude'
import { brDate, isoToday } from '../lib/nutri'

// Diário da Gratidão: Oração do Dia, Gratidão de Hoje, Meus Pedidos e Minha
// Jornada. Tudo o que a pessoa escreve é privado. As orações são cadastradas
// pela nutricionista (o app não escreve orações).

type Area = 'inicio' | 'oracao' | 'gratidao' | 'pedidos' | 'jornada' | 'orar-admin'

const TILES: { key: Exclude<Area, 'inicio' | 'orar-admin'>; title: string; text: string; icon: string }[] = [
  { key: 'oracao', title: 'Oração do Dia', text: 'Uma oração para hoje', icon: '🙏' },
  { key: 'gratidao', title: 'Gratidão de Hoje', text: 'O que merece ser agradecido', icon: '📖' },
  { key: 'pedidos', title: 'Meus Pedidos', text: 'O que você leva em oração', icon: '🕊️' },
  { key: 'jornada', title: 'Minha Jornada', text: 'Seus dias de gratidão', icon: '🌅' },
]

export function DiarioPage({ communityId, profileId, isOwner }: { communityId: string; profileId: string; isOwner: boolean }) {
  const g = useGratitude(communityId, profileId)
  const [area, setArea] = useState<Area>('inicio')
  const today = isoToday()
  const [amen, setAmen] = useState(false)
  const [items, setItems] = useState<string[] | null>(null)
  const [req, setReq] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [prayerForm, setPrayerForm] = useState<{ id: string | null; title: string; body: string; status: 'draft' | 'published' } | null>(null)

  const prayer = prayerOfTheDay(g.prayers, today)
  const todayEntry = g.entries.find((e) => e.day === today)
  const draft = items ?? todayEntry?.items ?? ['']
  const days = Array.from(new Set([...g.entries.map((e) => e.day), ...g.amenDays]))
  const run = streak(days, today)
  const amenToday = amen || g.amenDays.includes(today)

  async function saveGratitude(e: FormEvent) {
    e.preventDefault()
    const clean = draft.map((s) => s.trim()).filter(Boolean).slice(0, 5)
    if (clean.length === 0) return setMsg('Escreva pelo menos uma gratidão.')
    const r = await g.saveToday(today, clean)
    setMsg(r.error ?? 'Gratidão guardada. 💛')
    if (!r.error) setItems(null)
  }

  async function addRequest(e: FormEvent) {
    e.preventDefault()
    if (!req.trim()) return
    const r = await g.addRequest(req.trim())
    if (r.error) setMsg(r.error)
    else setReq('')
  }

  async function savePrayer(e: FormEvent) {
    e.preventDefault()
    if (!prayerForm || !prayerForm.body.trim()) return setMsg('Escreva a oração.')
    const r = await g.savePrayer(prayerForm.id, { title: prayerForm.title.trim() || null, body: prayerForm.body.trim(), status: prayerForm.status })
    if (r.error) return setMsg(r.error)
    setPrayerForm(null)
    setMsg(null)
  }

  const back = (
    <button type="button" className="water-link" onClick={() => { setArea('inicio'); setMsg(null) }}>
      ‹ Diário da Gratidão
    </button>
  )

  return (
    <section className="diary">
      {area === 'inicio' && (
        <>
          <div className="diary-hero">
            <PrayingHands size={110} />
            <div>
              <h2>Diário da Gratidão</h2>
              <p>Um momento de fé, agradecimento e acolhimento. Sem pressa, do seu jeito.</p>
              {run > 0 && <p className="diary-streak">🌅 {run} {run === 1 ? 'dia seguido' : 'dias seguidos'} de gratidão</p>}
            </div>
          </div>
          <button type="button" className="ex-cta" onClick={() => setArea('oracao')}>
            Começar agora
          </button>
          <div className="diary-tiles">
            {TILES.map((t) => (
              <button key={t.key} type="button" className="diary-tile" onClick={() => setArea(t.key)}>
                <span className="diary-tile-icon" aria-hidden="true">{t.icon}</span>
                <strong>{t.title}</strong>
                <span className="home-muted">{t.text}</span>
              </button>
            ))}
          </div>
          {isOwner && (
            <button type="button" className="water-primary" onClick={() => setArea('orar-admin')}>
              Cadastrar orações do dia
            </button>
          )}
          <p className="water-note">Tudo o que você escreve aqui é só seu.</p>
        </>
      )}

      {area === 'oracao' && (
        <>
          {back}
          <h2>Oração do Dia</h2>
          <p className="home-muted">{new Date(today + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          {g.loading && <p className="home-muted">Carregando…</p>}
          {!g.loading && !prayer && <p className="home-muted">A oração de hoje ainda não foi cadastrada. Volte em breve.</p>}
          {prayer && (
            <article className="diary-prayer">
              {prayer.title && <h3>{prayer.title}</h3>}
              {prayer.body.split(/\n{1,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </article>
          )}
          {prayer && !amenToday && (
            <button
              type="button"
              className="ex-big"
              onClick={() => {
                setAmen(true)
                void g.sayAmen(today)
              }}
            >
              Amém 🙏
            </button>
          )}
          {prayer && amenToday && (
            <div className="diary-amen" role="status">
              <PrayingHands size={80} label="Amém" />
              <p>{amenMessage(today)}</p>
            </div>
          )}
        </>
      )}

      {area === 'gratidao' && (
        <>
          {back}
          <h2>Gratidão de Hoje</h2>
          <p className="home-muted">Escreva até 5 coisas pelas quais você é grata hoje, grandes ou pequenas.</p>
          <form className="pn-form" onSubmit={(e) => void saveGratitude(e)}>
            {draft.map((it, i) => (
              <label key={i}>
                {i + 1}.
                <input value={it} maxLength={200} onChange={(e) => setItems(draft.map((x, j) => (j === i ? e.target.value : x)))} placeholder="Sou grata por…" />
              </label>
            ))}
            {draft.length < 5 && (
              <button type="button" onClick={() => setItems([...draft, ''])}>
                + Mais uma
              </button>
            )}
            <button type="submit" className="water-primary">
              Guardar
            </button>
          </form>
          {msg && <p className="home-muted" role="status">{msg}</p>}
        </>
      )}

      {area === 'pedidos' && (
        <>
          {back}
          <h2>Meus Pedidos</h2>
          <form className="pn-form" onSubmit={(e) => void addRequest(e)}>
            <label>
              Novo pedido
              <textarea rows={2} value={req} maxLength={500} onChange={(e) => setReq(e.target.value)} />
            </label>
            <button type="submit" className="water-primary">
              Entregar em oração
            </button>
          </form>
          {msg && <p className="auth-error">{msg}</p>}
          <ul className="pn-list">
            {g.requests.map((r) => (
              <li key={r.id} className={r.status === 'atendido' ? 'is-past' : ''}>
                <span>{r.body}</span>
                <span className="home-muted">
                  {r.status === 'atendido' ? `Atendido${r.answered_at ? ` em ${brDate(r.answered_at.slice(0, 10))}` : ''} 💛` : `Em oração desde ${brDate(r.created_at.slice(0, 10))}`}
                </span>
                <div className="pn-actions">
                  <button type="button" onClick={() => void g.setAnswered(r.id, r.status !== 'atendido')}>
                    {r.status === 'atendido' ? 'Reabrir' : 'Marcar como atendido'}
                  </button>
                  <button type="button" onClick={() => window.confirm('Apagar este pedido?') && void g.removeRequest(r.id)}>
                    Apagar
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {g.requests.length === 0 && <p className="home-muted">Seus pedidos aparecem aqui.</p>}
        </>
      )}

      {area === 'jornada' && (
        <>
          {back}
          <h2>Minha Jornada</h2>
          <ul className="diary-stats">
            <li>
              <strong>{run}</strong> dias seguidos
            </li>
            <li>
              <strong>{days.length}</strong> dias de gratidão
            </li>
            <li>
              <strong>{g.requests.filter((r) => r.status === 'atendido').length}</strong> pedidos atendidos
            </li>
          </ul>
          <h3>Minhas gratidões</h3>
          {g.entries.length === 0 ? (
            <p className="home-muted">Suas gratidões aparecem aqui.</p>
          ) : (
            <ul className="pn-list">
              {g.entries.slice(0, 60).map((e) => (
                <li key={e.id}>
                  <strong>{brDate(e.day)}</strong>
                  <ul>
                    {e.items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {area === 'orar-admin' && (
        <>
          {back}
          <h2>Orações do dia</h2>
          <p className="home-muted">Cadastre as orações. Uma delas é mostrada por dia, em rodízio, entre as publicadas.</p>
          {msg && <p className="auth-error">{msg}</p>}
          <ul className="pn-list">
            {g.prayers.map((p) => (
              <li key={p.id}>
                <strong>{p.title || 'Sem título'}</strong> <span className="home-muted">{p.status === 'published' ? 'Publicada' : 'Rascunho'}</span>
                <div className="pn-actions">
                  <button type="button" onClick={() => setPrayerForm({ id: p.id, title: p.title ?? '', body: p.body, status: p.status })}>
                    Editar
                  </button>
                  <button type="button" onClick={() => void g.savePrayer(p.id, { title: p.title, body: p.body, status: p.status === 'published' ? 'draft' : 'published' })}>
                    {p.status === 'published' ? 'Despublicar' : 'Publicar'}
                  </button>
                  <button type="button" onClick={() => window.confirm('Remover esta oração?') && void g.removePrayer(p.id)}>
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {!prayerForm && (
            <button type="button" className="water-primary" onClick={() => setPrayerForm({ id: null, title: '', body: '', status: 'draft' })}>
              Nova oração
            </button>
          )}
          {prayerForm && (
            <form className="pn-form" onSubmit={(e) => void savePrayer(e)}>
              <label>
                Título (opcional)
                <input value={prayerForm.title} maxLength={120} onChange={(e) => setPrayerForm({ ...prayerForm, title: e.target.value })} />
              </label>
              <label>
                Oração
                <textarea rows={8} value={prayerForm.body} maxLength={4000} onChange={(e) => setPrayerForm({ ...prayerForm, body: e.target.value })} />
              </label>
              <label>
                Situação
                <select value={prayerForm.status} onChange={(e) => setPrayerForm({ ...prayerForm, status: e.target.value as 'draft' | 'published' })}>
                  <option value="draft">Rascunho</option>
                  <option value="published">Publicada</option>
                </select>
              </label>
              <button type="submit" className="water-primary">
                Salvar oração
              </button>
              <button type="button" onClick={() => setPrayerForm(null)}>
                Cancelar
              </button>
            </form>
          )}
        </>
      )}
    </section>
  )
}
