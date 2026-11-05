import { useEffect, useState } from 'react'
import { daysInMonth, useGardenMonth } from '../hooks/useGardenMonth'
import { MONTH_NAMES } from './GardenPage'

// Profissional: define o desafio do mês e o texto de cada dia (28 a 31).
export function GardenMonthManager({
  communityId,
  profileId,
}: {
  communityId: string
  profileId: string
}) {
  const g = useGardenMonth(communityId, profileId)
  const now = g.today
  const [month, setMonth] = useState(now.month)
  const [title, setTitle] = useState('')
  const [texts, setTexts] = useState<string[]>(Array(31).fill(''))
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const days = daysInMonth(now.year, month)
  const existing = g.months.find((m) => m.month === month) ?? null

  useEffect(() => {
    setTitle(existing?.title ?? '')
    setTexts(Array.from({ length: 31 }, (_, i) => existing?.texts[i + 1] ?? ''))
    setMsg(null)
  }, [existing, month])

  async function save() {
    setSaving(true)
    setMsg(null)
    const r = await g.saveMonth({ year: now.year, month, title, days, texts })
    setSaving(false)
    setMsg(r.error ? 'Não foi possível salvar agora.' : 'Desafio do mês salvo.')
  }

  return (
    <section className="garden-manager">
      <h3>Desafio do mês (profissional)</h3>
      <p className="home-muted">
        O desafio dura o mês inteiro ({days} dias em {MONTH_NAMES[month - 1]}). Cada participante só
        marca o check no próprio dia.
      </p>
      <label className="rec-form-label">
        Mês
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTH_NAMES.map((n, i) => (
            <option key={n} value={i + 1}>
              {n} {now.year}
            </option>
          ))}
        </select>
      </label>
      <label className="rec-form-label">
        Nome do desafio
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Mês da água" />
      </label>
      <div className="garden-days-grid">
        {Array.from({ length: days }, (_, i) => (
          <label key={i} className="garden-day-field">
            <span>Dia {i + 1}</span>
            <textarea
              rows={2}
              value={texts[i] ?? ''}
              onChange={(e) => setTexts((prev) => prev.map((t, j) => (j === i ? e.target.value : t)))}
            />
          </label>
        ))}
      </div>
      {msg && <p className={msg.startsWith('Desafio') ? 'auth-success' : 'auth-error'}>{msg}</p>}
      <button type="button" className="profile-save-action" onClick={() => void save()} disabled={saving}>
        {saving ? 'Salvando…' : 'Salvar desafio do mês'}
      </button>
    </section>
  )
}
