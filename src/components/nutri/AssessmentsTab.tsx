import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ALL_MEASURES,
  BODY_MEASURES,
  COMPOSITION_MEASURES,
  bmi,
  bmiRangeLabel,
  brDate,
  derive,
  diff,
  heightAt,
  isoToday,
  percentVariation,
  sortAssessments,
  waistHeightRatio,
  waistHipRatio,
} from '../../lib/nutri'
import type { Assessment, AssessmentInput, MeasureDef } from '../../lib/nutri'

// Avaliação antropométrica: formulário, linha do tempo, gráficos de evolução e
// comparação entre duas avaliações. Composição corporal só entra se a
// nutricionista informar (bioimpedância ou protocolo) — nunca é calculada.

const fmt = (n: number | null | undefined, digits = 1): string =>
  n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: digits })

function LineChart({ points, unit }: { points: { x: string; y: number }[]; unit: string }) {
  if (points.length < 2) return <p className="home-muted">Precisa de pelo menos 2 avaliações para o gráfico.</p>
  const W = 300
  const H = 120
  const pad = 14
  const ys = points.map((p) => p.y)
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const span = max - min || 1
  const px = (i: number) => pad + (i * (W - pad * 2)) / (points.length - 1)
  const py = (y: number) => H - pad - ((y - min) / span) * (H - pad * 2)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${py(p.y).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="nutri-chart" role="img" aria-label={`Evolução em ${unit}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={px(i)} cy={py(p.y)} r="3.5" fill="currentColor" />
          <text x={px(i)} y={py(p.y) - 7} textAnchor="middle" fontSize="9" fill="currentColor">
            {fmt(p.y)}
          </text>
          <text x={px(i)} y={H - 2} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.6">
            {brDate(p.x).slice(0, 5)}
          </text>
        </g>
      ))}
    </svg>
  )
}

const num = (v: string): number | null => {
  const n = Number(v.replace(',', '.'))
  return v.trim() === '' || Number.isNaN(n) ? null : n
}

function MeasureInputs({ defs, values, onChange }: { defs: MeasureDef[]; values: Record<string, string>; onChange: (k: string, v: string) => void }) {
  return (
    <div className="nutri-grid2">
      {defs.map((d) => (
        <label key={d.key}>
          {d.label} ({d.unit})
          <input inputMode="decimal" value={values[d.key] ?? ''} onChange={(e) => onChange(d.key, e.target.value)} />
        </label>
      ))}
    </div>
  )
}

export function AssessmentsTab({
  assessments,
  sex,
  onAdd,
  onRemove,
}: {
  assessments: Assessment[]
  sex: 'F' | 'M' | null
  onAdd: (input: AssessmentInput) => Promise<{ error: string | null }>
  onRemove: (id: string, on: string) => Promise<{ error: string | null }>
}) {
  const sorted = useMemo(() => sortAssessments(assessments), [assessments])
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState(isoToday())
  const [vals, setVals] = useState<Record<string, string>>({})
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [chartKey, setChartKey] = useState<keyof Assessment>('weight_kg')
  const [cmpA, setCmpA] = useState('')
  const [cmpB, setCmpB] = useState('')

  const liveHeight = num(vals.height_cm ?? '') ?? heightAt(sorted, sorted.length - 1)
  const liveBmi = bmi(num(vals.weight_kg ?? ''), liveHeight)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const input: AssessmentInput = { assessed_on: date, source: source.trim() || null, notes: notes.trim() || null }
    let any = false
    for (const m of ALL_MEASURES) {
      const v = num(vals[m.key] ?? '')
      if (v !== null) {
        ;(input as Record<string, unknown>)[m.key] = v
        any = true
      }
    }
    if (!any) {
      setError('Informe pelo menos uma medida.')
      return
    }
    setSaving(true)
    setError(null)
    const r = await onAdd(input)
    setSaving(false)
    if (r.error) {
      setError(r.error)
      return
    }
    setAdding(false)
    setVals({})
    setNotes('')
    setSource('')
  }

  const chartDefs = ALL_MEASURES.filter((m) => sorted.filter((a) => a[m.key] != null).length > 0)
  const chartDef = ALL_MEASURES.find((m) => m.key === chartKey) ?? ALL_MEASURES[0]
  const points = sorted
    .filter((a) => a[chartKey] != null)
    .map((a) => ({ x: a.assessed_on, y: a[chartKey] as number }))

  const a = sorted.find((x) => x.id === cmpA)
  const b = sorted.find((x) => x.id === cmpB)

  return (
    <div className="nutri-assess">
      {!adding ? (
        <button type="button" className="water-primary" onClick={() => setAdding(true)}>
          Nova avaliação
        </button>
      ) : (
        <form className="nutri-form" onSubmit={(e) => void submit(e)}>
          <h3>Nova avaliação</h3>
          <p className="home-muted">Cada avaliação é um registro novo: as anteriores não são alteradas.</p>
          <label>
            Data da avaliação
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <h4>Medidas corporais</h4>
          <MeasureInputs defs={BODY_MEASURES} values={vals} onChange={(k, v) => setVals((s) => ({ ...s, [k]: v }))} />
          <p className="nutri-calc">
            IMC calculado: <strong>{liveBmi ?? '—'}</strong>
            {liveBmi ? ` (faixa ${bmiRangeLabel(liveBmi)}; é uma referência, não um diagnóstico${sex ? '' : '; informe o sexo no cadastro'})` : ''}
            {' · '}Cintura/quadril: <strong>{waistHipRatio(num(vals.waist_cm ?? ''), num(vals.hip_cm ?? '')) ?? '—'}</strong>
            {' · '}Cintura/estatura: <strong>{waistHeightRatio(num(vals.waist_cm ?? ''), liveHeight) ?? '—'}</strong>
          </p>
          <h4>Composição corporal</h4>
          <p className="home-muted">
            Preencha só com valores medidos (bioimpedância ou protocolo). O app não calcula esses indicadores a partir de peso e altura.
          </p>
          <MeasureInputs defs={COMPOSITION_MEASURES} values={vals} onChange={(k, v) => setVals((s) => ({ ...s, [k]: v }))} />
          <label>
            Equipamento ou protocolo usado
            <input value={source} maxLength={120} onChange={(e) => setSource(e.target.value)} />
          </label>
          <label>
            Observações
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="nutri-actions">
            <button type="button" className="auth-link" onClick={() => setAdding(false)} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="water-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar avaliação'}
            </button>
          </div>
        </form>
      )}

      {sorted.length === 0 && !adding && <p className="home-muted">Nenhuma avaliação registrada ainda.</p>}

      {sorted.length > 0 && (
        <>
          <h3>Evolução</h3>
          <label className="nutri-inline">
            Indicador
            <select value={String(chartKey)} onChange={(e) => setChartKey(e.target.value as keyof Assessment)}>
              {(chartDefs.length ? chartDefs : ALL_MEASURES).map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <LineChart points={points} unit={chartDef.unit} />

          <h3>Linha do tempo</h3>
          <ol className="nutri-timeline">
            {[...sorted].reverse().map((s) => {
              const idx = sorted.indexOf(s)
              const prev = idx > 0 ? sorted[idx - 1] : null
              const d = derive(s, heightAt(sorted, idx))
              const dw = diff(s.weight_kg, prev?.weight_kg)
              const pv = percentVariation(s.weight_kg, prev?.weight_kg)
              return (
                <li key={s.id} className="nutri-timeline-item">
                  <div className="nutri-timeline-head">
                    <strong>{brDate(s.assessed_on)}</strong>
                    <button
                      type="button"
                      className="auth-link"
                      onClick={() => {
                        if (window.confirm(`Excluir a avaliação de ${brDate(s.assessed_on)}?`)) void onRemove(s.id, s.assessed_on)
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                  <ul className="nutri-facts">
                    {s.weight_kg != null && <li>Peso {fmt(s.weight_kg)} kg</li>}
                    {s.height_cm != null && <li>Altura {fmt(s.height_cm)} cm</li>}
                    {d.bmi != null && <li>IMC {fmt(d.bmi)}</li>}
                    {d.whr != null && <li>Cintura/quadril {fmt(d.whr, 2)}</li>}
                    {d.whtr != null && <li>Cintura/estatura {fmt(d.whtr, 2)}</li>}
                    {[...BODY_MEASURES, ...COMPOSITION_MEASURES]
                      .filter((m) => m.key !== 'weight_kg' && m.key !== 'height_cm' && s[m.key] != null)
                      .map((m) => (
                        <li key={m.key}>
                          {m.label} {fmt(s[m.key] as number)} {m.unit}
                        </li>
                      ))}
                  </ul>
                  {prev && dw != null && (
                    <p className="nutri-delta">
                      Desde {brDate(prev.assessed_on)}: {dw > 0 ? '+' : ''}
                      {fmt(dw, 2)} kg{pv != null ? ` (${pv > 0 ? '+' : ''}${fmt(pv)}%)` : ''}
                    </p>
                  )}
                  {s.source && <p className="home-muted">Fonte: {s.source}</p>}
                  {s.notes && <p className="nutri-notes">{s.notes}</p>}
                </li>
              )
            })}
          </ol>

          {sorted.length >= 2 && (
            <>
              <h3>Comparar duas avaliações</h3>
              <div className="nutri-grid2">
                <label>
                  Avaliação A
                  <select value={cmpA} onChange={(e) => setCmpA(e.target.value)}>
                    <option value="">—</option>
                    {sorted.map((s) => (
                      <option key={s.id} value={s.id}>
                        {brDate(s.assessed_on)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Avaliação B
                  <select value={cmpB} onChange={(e) => setCmpB(e.target.value)}>
                    <option value="">—</option>
                    {sorted.map((s) => (
                      <option key={s.id} value={s.id}>
                        {brDate(s.assessed_on)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {a && b && (
                <table className="nutri-compare">
                  <thead>
                    <tr>
                      <th>Medida</th>
                      <th>{brDate(a.assessed_on)}</th>
                      <th>{brDate(b.assessed_on)}</th>
                      <th>Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_MEASURES.filter((m) => a[m.key] != null || b[m.key] != null).map((m) => (
                      <tr key={m.key}>
                        <td>{m.label}</td>
                        <td>{fmt(a[m.key] as number | null)}</td>
                        <td>{fmt(b[m.key] as number | null)}</td>
                        <td>{fmt(diff(b[m.key] as number | null, a[m.key] as number | null), 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
