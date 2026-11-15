import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { IMC_WEIGHT_MAX_KG, IMC_WEIGHT_MIN_KG, parseDecimal } from '../lib/imc'
import { m } from '../lib/motionKit'

// Histórico de peso: a própria pessoa registra o peso do dia e acompanha a
// evolução num gráfico. É dado de saúde — fica só na conta dela (RLS: ninguém
// mais lê, nem a profissional). Um registro por dia (regravar atualiza).

interface Entry {
  id: string
  weight_kg: number
  measured_on: string
}

const W = 320
const H = 150
const PAD = { top: 16, right: 14, bottom: 24, left: 34 }

function todayIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function shortDate(iso: string): string {
  const [, mm, dd] = iso.split('-')
  return `${dd}/${mm}`
}

function fmtKg(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/** Pontos do gráfico (x pela ordem do registro, y pelo peso) e o caminho da linha. */
export function chartGeometry(entries: { weight_kg: number }[]) {
  const values = entries.map((e) => Number(e.weight_kg))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(1, max - min)
  const lo = min - span * 0.15
  const hi = max + span * 0.15
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const points = values.map((v, i) => ({
    x: PAD.left + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW),
    y: PAD.top + (1 - (v - lo) / (hi - lo)) * innerH,
  }))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  return { points, path, lo, hi }
}

export function WeightHistory() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(todayIso())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('weight_entries')
      .select('id,weight_kg,measured_on')
      .order('measured_on', { ascending: true })
      .limit(120)
    setEntries(((data as Entry[] | null) ?? []).map((e) => ({ ...e, weight_kg: Number(e.weight_kg) })))
    setLoaded(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const w = parseDecimal(weight)
    if (w === null || w < IMC_WEIGHT_MIN_KG || w > IMC_WEIGHT_MAX_KG) {
      setError(`Informe o peso em quilos, entre ${IMC_WEIGHT_MIN_KG} e ${IMC_WEIGHT_MAX_KG}.`)
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayIso()) {
      setError('Escolha uma data de hoje ou anterior.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: saveError } = await supabase
      .from('weight_entries')
      .upsert({ weight_kg: Math.round(w * 100) / 100, measured_on: date }, { onConflict: 'profile_id,measured_on' })
    setBusy(false)
    if (saveError) {
      setError('Não foi possível salvar agora. Tente novamente.')
      return
    }
    setWeight('')
    void load()
  }

  async function removeEntry(id: string) {
    setBusy(true)
    await supabase.from('weight_entries').delete().eq('id', id)
    setBusy(false)
    void load()
  }

  const geo = useMemo(() => (entries.length > 0 ? chartGeometry(entries) : null), [entries])
  const first = entries[0]
  const last = entries[entries.length - 1]
  const diff = first && last && entries.length > 1 ? last.weight_kg - first.weight_kg : null

  return (
    <section className="weight-history" aria-label="Histórico de peso">
      <h3>Minha evolução</h3>
      <p className="home-muted">
        Registre seu peso quando quiser e acompanhe o caminho. Só você vê estes números.
      </p>

      <form className="weight-form" onSubmit={(e) => void handleSubmit(e)}>
        <label>
          Peso (kg)
          <input
            type="text"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Ex.: 64,5"
          />
        </label>
        <label>
          Data
          <input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button type="submit" className="water-primary" disabled={busy || !weight.trim()}>
          {busy ? 'Salvando…' : 'Registrar'}
        </button>
      </form>
      {error && <p className="auth-error">{error}</p>}

      {loaded && entries.length === 0 && (
        <p className="home-muted">Ainda não há registros. O gráfico aparece a partir do primeiro.</p>
      )}

      {geo && last && (
        <>
          <div className="weight-summary">
            <span className="weight-summary-now">
              {fmtKg(last.weight_kg)} <small>kg</small>
            </span>
            {diff !== null && (
              <span className="weight-summary-diff">
                {diff === 0 ? 'sem variação' : `${diff > 0 ? '+' : '−'}${fmtKg(Math.abs(diff))} kg desde ${shortDate(first.measured_on)}`}
              </span>
            )}
          </div>

          <svg
            className="weight-chart"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Gráfico de evolução do peso, de ${shortDate(first.measured_on)} a ${shortDate(last.measured_on)}`}
          >
            <defs>
              <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ee7f98" stopOpacity="0.35" />
                <stop offset="1" stopColor="#ee7f98" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((t) => {
              const y = PAD.top + t * (H - PAD.top - PAD.bottom)
              const value = geo.hi - t * (geo.hi - geo.lo)
              return (
                <g key={t}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className="weight-chart-grid" />
                  <text x={PAD.left - 6} y={y + 3.5} textAnchor="end" className="weight-chart-label">
                    {geo.hi - geo.lo < 4 ? fmtKg(value) : Math.round(value)}
                  </text>
                </g>
              )
            })}
            {entries.length > 1 && (
              <m.path
                key={`fill-${entries.length}`}
                d={`${geo.path} L${geo.points[geo.points.length - 1].x.toFixed(1)} ${H - PAD.bottom} L${geo.points[0].x.toFixed(1)} ${H - PAD.bottom} Z`}
                fill="url(#weight-fill)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.7 }}
              />
            )}
            <m.path
              key={`line-${entries.length}-${last.weight_kg}`}
              d={geo.path}
              className="weight-chart-line"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.3, ease: 'easeInOut' }}
            />
            {geo.points.map((p, i) => (
              <m.circle
                key={`${entries[i].id}-${entries.length}`}
                cx={p.x}
                cy={p.y}
                r={i === geo.points.length - 1 ? 5 : 3.2}
                className={`weight-chart-dot${i === geo.points.length - 1 ? ' weight-chart-dot--last' : ''}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.25 + (i / geo.points.length) * 1.1 }}
              />
            ))}
            <text x={geo.points[0].x} y={H - 6} textAnchor="middle" className="weight-chart-label">
              {shortDate(first.measured_on)}
            </text>
            {entries.length > 1 && (
              <text x={geo.points[geo.points.length - 1].x} y={H - 6} textAnchor="middle" className="weight-chart-label">
                {shortDate(last.measured_on)}
              </text>
            )}
          </svg>

          <details className="weight-list">
            <summary>Ver registros ({entries.length})</summary>
            <ul>
              {[...entries].reverse().map((e) => (
                <li key={e.id}>
                  <span>{shortDate(e.measured_on)}/{e.measured_on.slice(0, 4)}</span>
                  <strong>{fmtKg(e.weight_kg)} kg</strong>
                  <button type="button" className="auth-link" disabled={busy} onClick={() => void removeEntry(e.id)}>
                    Apagar
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  )
}
