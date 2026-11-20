import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { MyNutriPlan } from './MyNutriPlan'
import { BodyMeasureGuide } from './BodyMeasureGuide'
import { BodyPhotoGuide, PhotoCompare } from './BodyPhotoGuide'
import { progressPhotoUrl, usePatientNutri } from '../hooks/usePatientNutri'
import type { BodyEntry, NutriAppointment, ProgressPhoto } from '../hooks/usePatientNutri'
import { brDate, isoToday } from '../lib/nutri'

// Área "Nutri" da paciente: plano, agenda (com pedido de cancelamento ou
// reagendamento), orientações e tarefas, e a evolução (medidas e fotos
// privadas). Tudo sincronizado com o que a nutricionista registra no painel.

type Tab = 'plano' | 'agenda' | 'orientacoes' | 'evolucao'
const TABS: { key: Tab; label: string }[] = [
  { key: 'plano', label: 'Plano' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'orientacoes', label: 'Orientações' },
  { key: 'evolucao', label: 'Evolução' },
]

const STATUS_LABEL = { agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada' }

function AppointmentRow({ a, onCancel, onReschedule }: { a: NutriAppointment; onCancel: () => void; onReschedule: (note: string) => void }) {
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const open = a.status === 'agendada'
  return (
    <li className={`pn-appt${open ? '' : ' is-past'}`}>
      <div>
        <strong>
          {brDate(a.scheduled_on)}
          {a.scheduled_time ? ` · ${a.scheduled_time}` : ''}
        </strong>{' '}
        <span className="home-muted">
          {a.kind === 'retorno' ? 'Retorno' : 'Consulta'} · {STATUS_LABEL[a.status]}
          {a.status === 'cancelada' && a.canceled_by === 'paciente' ? ' por você' : ''}
        </span>
        {a.patient_request === 'reagendar' && <p className="pn-pending">Pedido de reagendamento enviado. Aguarde a resposta da sua nutricionista.</p>}
      </div>
      {open && !asking && (
        <div className="pn-actions">
          {a.patient_request !== 'reagendar' && (
            <button type="button" onClick={() => setAsking(true)}>
              Pedir reagendamento
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Cancelar esta consulta? Sua nutricionista será avisada.')) onCancel()
            }}
          >
            Cancelar
          </button>
        </div>
      )}
      {asking && (
        <div className="pn-ask">
          <textarea rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Qual dia ou horário fica melhor para você? (opcional)" />
          <div className="pn-actions">
            <button
              type="button"
              onClick={() => {
                onReschedule(note.trim())
                setAsking(false)
              }}
            >
              Enviar pedido
            </button>
            <button type="button" onClick={() => setAsking(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function PhotoThumb({ photo, onDelete }: { photo: ProgressPhoto; onDelete?: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void progressPhotoUrl(photo.file_path).then((u) => !cancelled && setUrl(u))
    return () => {
      cancelled = true
    }
  }, [photo.file_path])
  return (
    <figure className="pn-photo">
      {url ? <img src={url} alt={`Foto de ${photo.view}`} loading="lazy" /> : <span className="pn-photo-ph" />}
      <figcaption>
        {brDate(photo.taken_on)} · {photo.view}
        {onDelete && photo.source === 'paciente' && (
          <button type="button" className="own-menu-btn" onClick={() => window.confirm('Apagar esta foto?') && onDelete()}>
            Apagar
          </button>
        )}
      </figcaption>
    </figure>
  )
}

const FIELDS: { key: 'arm_cm' | 'thigh_cm' | 'waist_cm' | 'abdomen_cm' | 'hip_cm'; label: string }[] = [
  { key: 'arm_cm', label: 'Braço (cm)' },
  { key: 'thigh_cm', label: 'Perna / coxa (cm)' },
  { key: 'waist_cm', label: 'Cintura (cm)' },
  { key: 'abdomen_cm', label: 'Abdômen (cm)' },
  { key: 'hip_cm', label: 'Quadril (cm)' },
]

function num(v: string): number | null {
  const n = Number(v.replace(',', '.'))
  return v.trim() && Number.isFinite(n) ? n : null
}

function EntryTable({ entries, onDelete }: { entries: BodyEntry[]; onDelete: (id: string) => void }) {
  if (entries.length === 0) return <p className="home-muted">Nenhuma medida registrada ainda.</p>
  return (
    <div className="pn-table-wrap">
      <table className="nutri-compare">
        <thead>
          <tr>
            <th>Data</th>
            {FIELDS.map((f) => (
              <th key={f.key}>{f.label.replace(' (cm)', '')}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{brDate(e.taken_on)}</td>
              {FIELDS.map((f) => (
                <td key={f.key}>{e[f.key] ?? '—'}</td>
              ))}
              <td>
                {e.source === 'paciente' ? (
                  <button type="button" className="own-menu-btn" onClick={() => window.confirm('Apagar este registro?') && onDelete(e.id)}>
                    Apagar
                  </button>
                ) : (
                  <span className="home-muted">Nutri</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PatientNutriPage() {
  const n = usePatientNutri()
  const [tab, setTab] = useState<Tab>('plano')
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({ taken_on: isoToday() })
  const [photoView, setPhotoView] = useState<'frente' | 'lado' | 'costas'>('frente')
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<{ error: string | null }>) {
    setBusy(true)
    setMessage(null)
    const { error } = await fn()
    setBusy(false)
    if (error) setMessage(error)
  }

  async function saveEntry(e: FormEvent) {
    e.preventDefault()
    const input = {
      taken_on: form.taken_on || isoToday(),
      arm_cm: num(form.arm_cm ?? ''),
      thigh_cm: num(form.thigh_cm ?? ''),
      waist_cm: num(form.waist_cm ?? ''),
      abdomen_cm: num(form.abdomen_cm ?? ''),
      hip_cm: num(form.hip_cm ?? ''),
      other_label: form.other_label?.trim() || null,
      other_cm: num(form.other_cm ?? ''),
      notes: form.notes?.trim() || null,
    }
    if (!input.arm_cm && !input.thigh_cm && !input.waist_cm && !input.abdomen_cm && !input.hip_cm && !input.other_cm) {
      setMessage('Preencha pelo menos uma medida.')
      return
    }
    await run(async () => {
      const r = await n.addEntry(input)
      if (!r.error) setForm({ taken_on: isoToday() })
      return r
    })
  }

  if (n.loading) return <p className="home-muted">Carregando…</p>
  const { area } = n
  if (!area) return <p className="home-muted">Sua nutricionista ainda não confirmou o seu vínculo.</p>

  const upcoming = area.appointments.filter((a) => a.status === 'agendada').sort((a, b) => (a.scheduled_on + (a.scheduled_time ?? '')).localeCompare(b.scheduled_on + (b.scheduled_time ?? '')))
  const past = area.appointments.filter((a) => a.status !== 'agendada')
  const tasks = area.updates.filter((u) => u.kind === 'tarefa')
  const notes = area.updates.filter((u) => u.kind !== 'tarefa')

  return (
    <div className="patient-nutri">
      <p className="section-label">Nutri</p>
      <div className="pn-tabs" role="tablist" aria-label="Áreas da Nutri">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-on' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {message && (
        <p className="auth-error" role="alert">
          {message}
        </p>
      )}

      {tab === 'plano' && (
        <>
          {area.next_consultation && (
            <p className="pn-next">
              Próxima consulta: <strong>{brDate(area.next_consultation)}</strong>
            </p>
          )}
          <MyNutriPlan />
        </>
      )}

      {tab === 'agenda' && (
        <section>
          <h3>Próximos compromissos</h3>
          {upcoming.length === 0 ? (
            <p className="home-muted">Nenhuma consulta marcada no momento.</p>
          ) : (
            <ul className="pn-list">
              {upcoming.map((a) => (
                <AppointmentRow key={a.id} a={a} onCancel={() => void run(() => n.cancelAppointment(a.id))} onReschedule={(note) => void run(() => n.requestReschedule(a.id, note))} />
              ))}
            </ul>
          )}
          {past.length > 0 && (
            <>
              <h4>Histórico</h4>
              <ul className="pn-list">
                {past.map((a) => (
                  <AppointmentRow key={a.id} a={a} onCancel={() => undefined} onReschedule={() => undefined} />
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {tab === 'orientacoes' && (
        <section>
          <h3>Tarefas e recomendações</h3>
          {tasks.length === 0 ? (
            <p className="home-muted">Nenhuma tarefa por enquanto.</p>
          ) : (
            <ul className="pn-list">
              {tasks.map((t) => (
                <li key={t.id} className={`pn-task${t.done_at ? ' is-done' : ''}`}>
                  <label>
                    <input type="checkbox" checked={!!t.done_at} disabled={busy} onChange={(e) => void run(() => n.completeTask(t.id, e.target.checked))} />
                    <span>
                      <strong>{t.title}</strong>
                      {t.body && <small>{t.body}</small>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <h3>Histórico de orientações</h3>
          {notes.length === 0 ? (
            <p className="home-muted">As orientações da sua nutricionista aparecem aqui.</p>
          ) : (
            <ul className="pn-list">
              {notes.map((u) => (
                <li key={u.id} className="pn-note">
                  <strong>{u.title}</strong> <span className="home-muted">{brDate(u.created_at.slice(0, 10))}</span>
                  {u.body && <p>{u.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'evolucao' && (
        <section>
          <h3>Minhas medidas</h3>
          <p className="home-muted">
            Anote suas medidas com fita métrica. O app guarda a data e mostra a evolução. Fotos comuns não dão medida exata, por isso não calculamos medidas pelas fotos.
          </p>
          <BodyMeasureGuide />
          <form className="pn-form" onSubmit={(e) => void saveEntry(e)}>
            <label>
              Data
              <input type="date" value={form.taken_on} max={isoToday()} onChange={(e) => setForm((f) => ({ ...f, taken_on: e.target.value }))} />
            </label>
            {FIELDS.map((f) => (
              <label key={f.key}>
                {f.label}
                <input inputMode="decimal" value={form[f.key] ?? ''} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} placeholder="0,0" />
              </label>
            ))}
            <label>
              Outra medida (nome)
              <input value={form.other_label ?? ''} maxLength={60} onChange={(e) => setForm((s) => ({ ...s, other_label: e.target.value }))} placeholder="Ex.: panturrilha" />
            </label>
            <label>
              Outra medida (cm)
              <input inputMode="decimal" value={form.other_cm ?? ''} onChange={(e) => setForm((s) => ({ ...s, other_cm: e.target.value }))} />
            </label>
            <button type="submit" className="water-primary" disabled={busy}>
              Salvar medidas
            </button>
          </form>
          <EntryTable entries={n.entries} onDelete={(id) => void run(() => n.deleteEntry(id))} />

          <h3>Fotos de evolução</h3>
          <BodyPhotoGuide />
          <p className="home-muted">As fotos ficam guardadas em área privada: só você e a sua nutricionista veem. Prefira roupa justa, boa luz e o mesmo lugar a cada foto.</p>
          <div className="pn-photo-add">
            <select value={photoView} onChange={(e) => setPhotoView(e.target.value as 'frente' | 'lado' | 'costas')} aria-label="Posição da foto">
              <option value="frente">Frente</option>
              <option value="lado">Lado</option>
              <option value="costas">Costas</option>
            </select>
            <label className="water-primary pn-file">
              Enviar foto
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void run(() => n.addPhoto(file, photoView, isoToday()))
                }}
              />
            </label>
          </div>
          {n.photos.length > 1 && <PhotoCompare photos={n.photos} />}
          {n.photos.length === 0 ? (
            <p className="home-muted">Nenhuma foto enviada.</p>
          ) : (
            <div className="pn-photos">
              {n.photos.map((p) => (
                <PhotoThumb key={p.id} photo={p} onDelete={() => void run(() => n.deletePhoto(p))} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
