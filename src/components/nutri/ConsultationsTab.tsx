import { useState } from 'react'
import type { FormEvent } from 'react'
import { brDate, isoToday } from '../../lib/nutri'
import type { Consultation } from '../../lib/nutri'

// Consultas e retornos do paciente: agendar, registrar o que aconteceu
// (evolução) e marcar o próximo retorno.

const STATUS_LABEL: Record<Consultation['status'], string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
}

export function ConsultationsTab({
  consultations,
  onAdd,
  onSetStatus,
}: {
  consultations: Consultation[]
  onAdd: (c: Omit<Consultation, 'id' | 'patient_id'>) => Promise<{ error: string | null }>
  onSetStatus: (id: string, status: Consultation['status'], evolution?: string | null, nextReturn?: string | null) => Promise<{ error: string | null }>
}) {
  const [kind, setKind] = useState<Consultation['kind']>('consulta')
  const [status, setStatus] = useState<Consultation['status']>('agendada')
  const [date, setDate] = useState(isoToday())
  const [time, setTime] = useState('')
  const [evolution, setEvolution] = useState('')
  const [nextReturn, setNextReturn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState<string | null>(null)
  const [closeText, setCloseText] = useState('')
  const [closeNext, setCloseNext] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const r = await onAdd({
      kind,
      status,
      scheduled_on: date,
      scheduled_time: time || null,
      evolution: evolution.trim() || null,
      next_return_on: nextReturn || null,
    })
    setSaving(false)
    if (r.error) setError(r.error)
    else {
      setEvolution('')
      setNextReturn('')
      setTime('')
    }
  }

  async function finish(id: string) {
    const r = await onSetStatus(id, 'realizada', closeText.trim() || null, closeNext || null)
    if (r.error) setError(r.error)
    else {
      setClosing(null)
      setCloseText('')
      setCloseNext('')
    }
  }

  return (
    <div className="nutri-consults">
      <form className="nutri-form" onSubmit={(e) => void submit(e)}>
        <h3>Registrar consulta ou retorno</h3>
        <div className="nutri-grid2">
          <label>
            Tipo
            <select value={kind} onChange={(e) => setKind(e.target.value as Consultation['kind'])}>
              <option value="consulta">Consulta</option>
              <option value="retorno">Retorno</option>
            </select>
          </label>
          <label>
            Situação
            <select value={status} onChange={(e) => setStatus(e.target.value as Consultation['status'])}>
              <option value="agendada">Agendada</option>
              <option value="realizada">Realizada</option>
            </select>
          </label>
          <label>
            Data
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Horário
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        {status === 'realizada' && (
          <label>
            Evolução
            <textarea rows={4} value={evolution} onChange={(e) => setEvolution(e.target.value)} />
          </label>
        )}
        <label>
          Próximo retorno
          <input type="date" value={nextReturn} onChange={(e) => setNextReturn(e.target.value)} />
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="water-primary" disabled={saving}>
          {saving ? 'Salvando…' : 'Registrar'}
        </button>
      </form>

      <h3>Histórico de consultas</h3>
      {consultations.length === 0 && <p className="home-muted">Nenhuma consulta registrada.</p>}
      <ul className="nutri-timeline">
        {consultations.map((c) => (
          <li key={c.id} className="nutri-timeline-item">
            <div className="nutri-timeline-head">
              <strong>
                {brDate(c.scheduled_on)}
                {c.scheduled_time ? ` · ${c.scheduled_time}` : ''} · {c.kind === 'retorno' ? 'Retorno' : 'Consulta'}
              </strong>
              <span className={`nutri-chip nutri-chip--${c.status}`}>{STATUS_LABEL[c.status]}</span>
            </div>
            {c.evolution && <p className="nutri-notes">{c.evolution}</p>}
            {c.next_return_on && <p className="home-muted">Próximo retorno: {brDate(c.next_return_on)}</p>}
            {c.status === 'agendada' && closing !== c.id && (
              <div className="nutri-actions">
                <button type="button" className="auth-link" onClick={() => setClosing(c.id)}>
                  Marcar como realizada
                </button>
                <button type="button" className="auth-link" onClick={() => void onSetStatus(c.id, 'cancelada')}>
                  Cancelar
                </button>
              </div>
            )}
            {closing === c.id && (
              <div className="nutri-form">
                <label>
                  Evolução
                  <textarea rows={3} value={closeText} onChange={(e) => setCloseText(e.target.value)} />
                </label>
                <label>
                  Próximo retorno
                  <input type="date" value={closeNext} onChange={(e) => setCloseNext(e.target.value)} />
                </label>
                <div className="nutri-actions">
                  <button type="button" className="auth-link" onClick={() => setClosing(null)}>
                    Voltar
                  </button>
                  <button type="button" className="water-primary" onClick={() => void finish(c.id)}>
                    Salvar
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
