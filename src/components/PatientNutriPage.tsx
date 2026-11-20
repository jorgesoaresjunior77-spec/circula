import { useEffect, useState } from 'react'
import { MyNutriPlan } from './MyNutriPlan'
import { BodyAvatar } from './BodyAvatar'
import type { AvatarMeasures, AvatarView } from '../lib/bodyAvatar'
import { BodyPhotoGuide, PhotoCompare } from './BodyPhotoGuide'
import { progressPhotoUrl, usePatientNutri } from '../hooks/usePatientNutri'
import type { NutriArea, NutriAppointment, ProgressPhoto } from '../hooks/usePatientNutri'
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

function fmt(n: number | null | undefined, digits = 1): string {
  return n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: digits })
}

type EvolutionRow = NutriArea['evolution'][number]

function toMeasures(r: EvolutionRow, fallbackHeight: number | null): AvatarMeasures {
  return {
    heightCm: r.height_cm ?? fallbackHeight ?? 165,
    weightKg: r.weight_kg,
    waistCm: r.waist_cm,
    hipCm: r.hip_cm,
    armCm: r.arm_cm,
    thighCm: r.thigh_cm,
    calfCm: r.calf_cm,
  }
}

/** Avatar calculado pelas medidas compartilhadas, com comparação entre duas avaliações. */
function EvolutionAvatar({ rows }: { rows: EvolutionRow[] }) {
  const sorted = [...rows].sort((a, b) => a.assessed_on.localeCompare(b.assessed_on))
  const [view, setView] = useState<AvatarView>('front')
  const [current, setCurrent] = useState<string | null>(null)
  const [compare, setCompare] = useState<string>('')
  if (sorted.length === 0) return null
  const height = [...sorted].reverse().find((r) => r.height_cm)?.height_cm ?? null
  const now = sorted.find((r) => r.assessed_on === current) ?? sorted[sorted.length - 1]
  const before = compare ? (sorted.find((r) => r.assessed_on === compare) ?? null) : null
  return (
    <div className="pn-avatar">
      <div className="pn-avatar-tabs" role="tablist" aria-label="Vista do avatar">
        {(['front', 'side', 'back'] as AvatarView[]).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'is-on' : ''} onClick={() => setView(v)}>
            {v === 'front' ? 'Frente' : v === 'side' ? 'Lado' : 'Costas'}
          </button>
        ))}
      </div>
      <BodyAvatar measures={toMeasures(now, height)} view={view} previous={before ? toMeasures(before, height) : null} title={'Avatar em ' + brDate(now.assessed_on)} />
      {sorted.length > 1 && (
        <div className="pn-avatar-pick">
          <label>
            Avaliação
            <select value={now.assessed_on} onChange={(e) => setCurrent(e.target.value)}>
              {sorted.map((r) => (
                <option key={r.assessed_on} value={r.assessed_on}>
                  {brDate(r.assessed_on)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Comparar com
            <select value={compare} onChange={(e) => setCompare(e.target.value)}>
              <option value="">Nenhuma</option>
              {sorted
                .filter((r) => r.assessed_on !== now.assessed_on)
                .map((r) => (
                  <option key={r.assessed_on} value={r.assessed_on}>
                    {brDate(r.assessed_on)}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}
      <p className="home-muted">
        O avatar é desenhado a partir das medidas que a sua nutricionista compartilhou. Onde não há medida, ele usa proporções médias. O contorno tracejado mostra a avaliação escolhida para comparar.
      </p>
    </div>
  )
}

/** Histórico da composição corporal que a nutricionista compartilhou (só leitura). */
function CompositionHistory({ rows }: { rows: NutriArea['evolution'] }) {
  if (rows.length === 0) {
    return <p className="home-muted">Sua nutricionista ainda não compartilhou uma avaliação corporal. Quando ela compartilhar, o histórico aparece aqui.</p>
  }
  const list = [...rows].sort((a, b) => b.assessed_on.localeCompare(a.assessed_on))
  return (
    <div className="pn-table-wrap">
      <table className="nutri-compare">
        <thead>
          <tr>
            <th>Data</th>
            <th>Peso (kg)</th>
            <th>Gordura (%)</th>
            <th>Massa gorda (kg)</th>
            <th>Massa magra (kg)</th>
            <th>Cintura (cm)</th>
            <th>Quadril (cm)</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const lean = r.weight_kg != null && r.fat_mass_kg != null ? Math.round((r.weight_kg - r.fat_mass_kg) * 10) / 10 : null
            return (
              <tr key={r.assessed_on}>
                <td>{brDate(r.assessed_on)}</td>
                <td>{fmt(r.weight_kg)}</td>
                <td>{fmt(r.body_fat_pct)}</td>
                <td>{fmt(r.fat_mass_kg)}</td>
                <td>{fmt(lean)}</td>
                <td>{fmt(r.waist_cm)}</td>
                <td>{fmt(r.hip_cm)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function PatientNutriPage() {
  const n = usePatientNutri()
  const [tab, setTab] = useState<Tab>('plano')
  const [message, setMessage] = useState<string | null>(null)
  const [photoView, setPhotoView] = useState<'frente' | 'lado' | 'costas'>('frente')
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<{ error: string | null }>) {
    setBusy(true)
    setMessage(null)
    const { error } = await fn()
    setBusy(false)
    if (error) setMessage(error)
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
          <h3>Minha composição corporal</h3>
          <p className="home-muted">
            Aqui aparece o que a sua nutricionista avaliou e compartilhou com você: peso, percentual de gordura, massa de gordura, massa magra e medidas. Você não precisa
            medir nem anotar nada.
          </p>
          <EvolutionAvatar rows={area.evolution} />
          <CompositionHistory rows={area.evolution} />

          <h3>Minhas fotos</h3>
          <p className="home-muted">Envie suas fotos quando quiser: frente, lado e costas. Elas ficam guardadas com a data, formando o seu histórico, e a sua nutricionista faz a avaliação.</p>
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
