import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'

// Painel → Agenda de conteúdos → "Incentivo das 5h no Feed".
// Todo dia às 5h (Brasília) o Círcula publica no Feed UMA mensagem cadastrada aqui. As três vozes se
// revezam, um dia cada: Nutri Marluce, App Círcula e Comunidade Fluir & Florescer. Voz sem mensagem
// ativa é pulada. Nada é escrito por IA: só o que a equipe cadastra (regra do Círcula).

type Signer = 'marluce' | 'circula' | 'fluir'
interface MorningMessage {
  id: number
  signer: Signer
  body: string
  active: boolean
}

const VOICES: { key: Signer; label: string; title: string }[] = [
  { key: 'marluce', label: 'Nutri Marluce', title: 'Bom dia da Nutri Marluce' },
  { key: 'circula', label: 'App Círcula', title: 'Bom dia do Círcula' },
  { key: 'fluir', label: 'Comunidade Fluir & Florescer', title: 'Bom dia do Fluir & Florescer' },
]

export function MorningMessagesManager() {
  const [items, setItems] = useState<MorningMessage[] | null>(null)
  const [voice, setVoice] = useState<Signer>('marluce')
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('daily_morning_messages').select('id, signer, body, active').order('id')
    if (error) setMsg(error.message)
    else setItems((data ?? []) as MorningMessage[])
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  async function save(e: FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    const res = editing
      ? await supabase.from('daily_morning_messages').update({ body, signer: voice, updated_at: new Date().toISOString() }).eq('id', editing)
      : await supabase.from('daily_morning_messages').insert({ body, signer: voice })
    if (res.error) return setMsg(res.error.message)
    setDraft('')
    setEditing(null)
    setMsg('Salvo.')
    void load()
  }
  async function toggle(m: MorningMessage) {
    const { error } = await supabase.from('daily_morning_messages').update({ active: !m.active }).eq('id', m.id)
    if (error) setMsg(error.message)
    else void load()
  }
  async function remove(m: MorningMessage) {
    if (!window.confirm('Apagar esta mensagem? Não dá para desfazer.')) return
    const { error } = await supabase.from('daily_morning_messages').delete().eq('id', m.id)
    if (error) setMsg(error.message)
    else void load()
  }

  const list = (items ?? []).filter((m) => m.signer === voice)
  const current = VOICES.find((v) => v.key === voice)!

  return (
    <section className="cas-card cas-form" aria-label="Incentivo das 5h no Feed">
      <h3>Incentivo das 5h no Feed</h3>
      <p className="home-muted">
        Todo dia às 5h o Círcula publica no Feed uma mensagem cadastrada aqui. As três vozes se revezam, um dia cada:
        Nutri Marluce, App Círcula e Comunidade Fluir &amp; Florescer. Uma voz sem mensagem ativa é pulada. Dentro de cada
        voz, as mensagens seguem a ordem do cadastro.
      </p>
      <div className="fluir-tabs" role="tablist">
        {VOICES.map((v) => {
          const n = (items ?? []).filter((m) => m.signer === v.key && m.active).length
          return (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={voice === v.key}
              className={voice === v.key ? 'is-active' : ''}
              onClick={() => {
                setVoice(v.key)
                setEditing(null)
                setDraft('')
              }}
            >
              {v.label} ({n})
            </button>
          )
        })}
      </div>
      <form onSubmit={(e) => void save(e)}>
        <label>
          {editing ? 'Editar mensagem' : `Nova mensagem (sai com o título “${current.title}”)`}
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} maxLength={1500} />
        </label>
        <button type="submit" className="water-primary" disabled={!draft.trim()}>
          {editing ? 'Salvar alteração' : 'Adicionar'}
        </button>
        {editing && (
          <button type="button" className="water-link" onClick={() => { setEditing(null); setDraft('') }}>
            Cancelar
          </button>
        )}
      </form>
      {items === null ? (
        <p className="home-muted">Carregando…</p>
      ) : list.length === 0 ? (
        <p className="home-muted">Nenhuma mensagem nesta voz ainda. Enquanto não houver, o dia dela vai para a próxima voz.</p>
      ) : (
        <ol className="morning-list">
          {list.map((m) => (
            <li key={m.id} className={m.active ? '' : 'is-off'}>
              <p>{m.body}</p>
              <div className="morning-actions">
                <button type="button" className="water-link" onClick={() => { setEditing(m.id); setDraft(m.body) }}>Editar</button>
                <button type="button" className="water-link" onClick={() => void toggle(m)}>{m.active ? 'Pausar' : 'Reativar'}</button>
                <button type="button" className="water-link" onClick={() => void remove(m)}>Apagar</button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {msg && <p className="home-muted">{msg}</p>}
    </section>
  )
}
