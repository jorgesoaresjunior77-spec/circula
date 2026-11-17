import { useEffect, useRef, useState } from 'react'
import { ANAMNESIS_SECTIONS, anamnesisProgress } from '../../lib/nutriAnamnesis'
import type { AnamnesisData, AnamnesisField } from '../../lib/nutriAnamnesis'
import { brDate } from '../../lib/nutri'

// Anamnese por categorias, com rascunho salvo sozinho (2 s depois de parar de
// digitar) e botão de concluir. Os campos vêm de lib/nutriAnamnesis.

const AUTOSAVE_MS = 2000

function Field({ f, value, onChange }: { f: AnamnesisField; value: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  const text = typeof value === 'string' ? value : ''
  const id = `anm-${f.key}`
  if (f.kind === 'multi') {
    const list = Array.isArray(value) ? value : []
    return (
      <fieldset className="nutri-checks">
        <legend>{f.label}</legend>
        {f.options?.map((o) => (
          <label key={o} className="nutri-check">
            <input
              type="checkbox"
              checked={list.includes(o)}
              onChange={(e) => onChange(e.target.checked ? [...list, o] : list.filter((x) => x !== o))}
            />
            {o}
          </label>
        ))}
      </fieldset>
    )
  }
  return (
    <label htmlFor={id}>
      {f.label}
      {f.hint && <small> · {f.hint}</small>}
      {f.kind === 'textarea' ? (
        <textarea id={id} rows={3} value={text} onChange={(e) => onChange(e.target.value)} />
      ) : f.kind === 'select' ? (
        <select id={id} value={text} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {f.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={f.kind === 'time' ? 'time' : f.kind === 'number' ? 'number' : 'text'}
          inputMode={f.kind === 'number' ? 'decimal' : undefined}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  )
}

export function AnamnesisForm({
  initial,
  status,
  updatedAt,
  onSave,
}: {
  initial: AnamnesisData
  status: 'rascunho' | 'concluida' | null
  updatedAt: string | null
  onSave: (data: AnamnesisData, status: 'rascunho' | 'concluida') => Promise<{ error: string | null }>
}) {
  const [data, setData] = useState<AnamnesisData>(initial)
  const [open, setOpen] = useState<string>(ANAMNESIS_SECTIONS[0].key)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const timer = useRef<number | null>(null)
  const latest = useRef(data)
  latest.current = data

  const { filled, total } = anamnesisProgress(data)

  function change(key: string, v: string | string[]) {
    setData((d) => ({ ...d, [key]: v }))
    setDirty(true)
    setMsg(null)
  }

  useEffect(() => {
    if (!dirty) return
    timer.current = window.setTimeout(async () => {
      const r = await onSave(latest.current, 'rascunho')
      if (!r.error) {
        setDirty(false)
        setMsg({ ok: true, text: 'Rascunho salvo.' })
      } else setMsg({ ok: false, text: r.error })
    }, AUTOSAVE_MS)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
    // onSave muda a cada render do hook; o salvamento só reage a alteração dos dados
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dirty])

  async function conclude() {
    if (timer.current) window.clearTimeout(timer.current)
    const r = await onSave(data, 'concluida')
    setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: 'Anamnese concluída.' })
    if (!r.error) setDirty(false)
  }

  return (
    <div className="nutri-anamnesis">
      <p className="nutri-progress">
        {filled} de {total} campos preenchidos ·{' '}
        {status === 'concluida' ? 'Concluída' : 'Rascunho'}
        {updatedAt ? ` · atualizada em ${brDate(updatedAt)}` : ''}
      </p>
      {ANAMNESIS_SECTIONS.map((s) => (
        <section key={s.key} className="nutri-section">
          <button
            type="button"
            className="nutri-section-head"
            aria-expanded={open === s.key}
            onClick={() => setOpen(open === s.key ? '' : s.key)}
          >
            {s.title}
            <span aria-hidden="true">{open === s.key ? '−' : '+'}</span>
          </button>
          {open === s.key && (
            <div className="nutri-section-body">
              {s.fields.map((f) => (
                <Field key={f.key} f={f} value={data[f.key]} onChange={(v) => change(f.key, v)} />
              ))}
            </div>
          )}
        </section>
      ))}
      <div className="nutri-actions">
        <button type="button" className="water-primary" onClick={() => void conclude()}>
          Concluir anamnese
        </button>
      </div>
      {msg && (
        <p className={msg.ok ? 'auth-success' : 'auth-error'} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}
    </div>
  )
}
