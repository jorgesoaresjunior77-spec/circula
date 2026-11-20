import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { brDate, isoToday } from '../../lib/nutri'
import { progressPhotoUrl } from '../../hooks/usePatientNutri'
import { BodyPhotoGuide, PhotoCompare, photoInviteMessage } from '../BodyPhotoGuide'
import type { BodyEntry, ProgressPhoto } from '../../hooks/usePatientNutri'

// Acompanhamento da paciente (painel da nutricionista): orientações e tarefas
// que aparecem na área Nutri dela, medidas e fotos de evolução, pedidos de
// reagendamento e a isenção da assinatura do Círculo (só para vinculada).

interface Update {
  id: string
  kind: 'orientacao' | 'tarefa' | 'mensagem'
  title: string
  body: string | null
  done_at: string | null
  created_at: string
}
interface Request {
  id: string
  scheduled_on: string
  scheduled_time: string | null
  patient_request_note: string | null
}

const KIND_LABEL = { orientacao: 'Orientação', tarefa: 'Tarefa', mensagem: 'Mensagem' }
const FAIL = 'Não foi possível concluir agora.'

function Thumb({ photo }: { photo: ProgressPhoto }) {
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
      </figcaption>
    </figure>
  )
}

export function FollowUpTab({ patientId, communityId, linkedProfileId, patientName = '', whatsapp = null }: { patientId: string; communityId: string; linkedProfileId: string | null; patientName?: string; whatsapp?: string | null }) {
  const [updates, setUpdates] = useState<Update[]>([])
  const [entries, setEntries] = useState<BodyEntry[]>([])
  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [requests, setRequests] = useState<Request[]>([])
  const [exempt, setExempt] = useState(false)
  const [kind, setKind] = useState<Update['kind']>('orientacao')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [token, setToken] = useState(0)
  const reload = useCallback(() => setToken((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [u, e, p, r, x] = await Promise.all([
        supabase.from('nutri_patient_updates').select('id,kind,title,body,done_at,created_at').eq('patient_id', patientId).order('created_at', { ascending: false }),
        supabase.from('nutri_body_entries').select('id,taken_on,arm_cm,thigh_cm,waist_cm,abdomen_cm,hip_cm,other_label,other_cm,notes,source').eq('patient_id', patientId).order('taken_on', { ascending: false }),
        supabase.from('nutri_progress_photos').select('id,taken_on,view,file_path,source').eq('patient_id', patientId).order('taken_on', { ascending: false }),
        supabase.from('nutri_consultations').select('id,scheduled_on,scheduled_time,patient_request_note').eq('patient_id', patientId).eq('status', 'agendada').eq('patient_request', 'reagendar'),
        supabase.from('nutri_exemptions').select('id').eq('patient_id', patientId).is('revoked_at', null).maybeSingle(),
      ])
      if (cancelled) return
      setUpdates((u.data ?? []) as Update[])
      setEntries((e.data ?? []) as BodyEntry[])
      setPhotos((p.data ?? []) as ProgressPhoto[])
      setRequests((r.data ?? []) as Request[])
      setExempt(!!x.data)
    })()
    return () => {
      cancelled = true
    }
  }, [patientId, token])

  async function addUpdate(ev: FormEvent) {
    ev.preventDefault()
    if (!title.trim()) return setMessage('Escreva um título.')
    setMessage(null)
    const { error } = await supabase.from('nutri_patient_updates').insert({ patient_id: patientId, community_id: communityId, kind, title: title.trim(), body: body.trim() || null })
    if (error) return setMessage(FAIL)
    setTitle('')
    setBody('')
    reload()
  }

  async function removeUpdate(id: string) {
    if (!window.confirm('Apagar este item? A paciente deixa de vê-lo.')) return
    const { error } = await supabase.from('nutri_patient_updates').delete().eq('id', id)
    if (error) setMessage(FAIL)
    else reload()
  }

  async function clearRequest(id: string) {
    const { error } = await supabase.from('nutri_consultations').update({ patient_request: null, patient_request_note: null }).eq('id', id)
    if (error) setMessage(FAIL)
    else reload()
  }

  async function toggleExemption() {
    setMessage(null)
    if (exempt) {
      if (!window.confirm('Retirar o acesso total? O Premium e a assinatura gratuita dela serão encerrados e a cobrança normal volta a valer.')) return
      const { error } = await supabase.rpc('revoke_nutri_exemption', { p_patient: patientId })
      if (error) return setMessage(FAIL)
    } else {
      if (!window.confirm('Conceder acesso total e gratuito ao Círculo a esta paciente (Premium sem cobrança)? Fica registrado que foi você.')) return
      const { error } = await supabase.rpc('grant_nutri_exemption', { p_patient: patientId, p_note: null })
      if (error) return setMessage(error.message.includes('patient_not_linked') ? 'Vincule a paciente a uma participante antes (aba Dados pessoais).' : FAIL)
    }
    reload()
  }

  return (
    <section className="nutri-followup">
      {message && (
        <p className="auth-error" role="alert">
          {message}
        </p>
      )}

      <article className="water-panel">
        <h3>Acesso total gratuito (paciente)</h3>
        <p className="home-muted">
          {linkedProfileId
            ? exempt
              ? 'Esta paciente tem acesso total e gratuito ao Círculo: a comunidade, todos os conteúdos e a área Nutri, sem nenhuma cobrança.'
              : 'Libere o acesso total e gratuito do Círculo para esta paciente: comunidade, todos os conteúdos (Premium) e a área Nutri, sem cobrança.'
            : 'Para conceder o acesso, ela precisa estar no Círcula: convide pelo WhatsApp e vincule-a a uma participante na aba Dados pessoais.'}
        </p>
        {linkedProfileId && (
          <button type="button" className="water-primary" onClick={() => void toggleExemption()}>
            {exempt ? 'Retirar acesso total' : 'Conceder acesso total gratuito'}
          </button>
        )}
      </article>

      {requests.length > 0 && (
        <article className="water-panel">
          <h3>Pedidos de reagendamento</h3>
          <ul className="pn-list">
            {requests.map((r) => (
              <li key={r.id}>
                Consulta de <strong>{brDate(r.scheduled_on)}{r.scheduled_time ? ` · ${r.scheduled_time}` : ''}</strong>
                {r.patient_request_note ? ` — “${r.patient_request_note}”` : ''}
                <button type="button" className="own-menu-btn" onClick={() => void clearRequest(r.id)}>
                  Marcar como resolvido
                </button>
              </li>
            ))}
          </ul>
          <p className="home-muted">Para remarcar, altere a data na aba Consultas e evolução; ela recebe o aviso.</p>
        </article>
      )}

      <article className="water-panel">
        <h3>Orientações e tarefas para a paciente</h3>
        <form className="pn-form" onSubmit={(e) => void addUpdate(e)}>
          <label>
            Tipo
            <select value={kind} onChange={(e) => setKind(e.target.value as Update['kind'])}>
              <option value="orientacao">Orientação</option>
              <option value="tarefa">Tarefa (ela marca como feita)</option>
              <option value="mensagem">Mensagem</option>
            </select>
          </label>
          <label>
            Título
            <input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Detalhes
            <textarea rows={3} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
          </label>
          <button type="submit" className="water-primary">
            Enviar para a paciente
          </button>
        </form>
        <ul className="pn-list">
          {updates.map((u) => (
            <li key={u.id}>
              <strong>{KIND_LABEL[u.kind]}:</strong> {u.title} <span className="home-muted">{brDate(u.created_at.slice(0, 10))}</span>
              {u.kind === 'tarefa' && <span className="home-muted"> · {u.done_at ? 'feita' : 'pendente'}</span>}
              <button type="button" className="own-menu-btn" onClick={() => void removeUpdate(u.id)}>
                Apagar
              </button>
            </li>
          ))}
        </ul>
      </article>

      <article className="water-panel">
        <h3>Medidas registradas</h3>
        {entries.length === 0 ? (
          <p className="home-muted">A paciente ainda não registrou medidas.</p>
        ) : (
          <div className="pn-table-wrap">
            <table className="nutri-compare">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Braço</th>
                  <th>Coxa</th>
                  <th>Cintura</th>
                  <th>Abdômen</th>
                  <th>Quadril</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{brDate(e.taken_on)}</td>
                    <td>{e.arm_cm ?? '—'}</td>
                    <td>{e.thigh_cm ?? '—'}</td>
                    <td>{e.waist_cm ?? '—'}</td>
                    <td>{e.abdomen_cm ?? '—'}</td>
                    <td>{e.hip_cm ?? '—'}</td>
                    <td>{e.source === 'paciente' ? 'Paciente' : 'Nutri'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="water-panel">
        <h3>Fotos de evolução</h3>
        <p className="home-muted">Acesso restrito: só você e a paciente. Hoje: {brDate(isoToday())}.</p>
        <div className="pn-actions">
          <button
            type="button"
            className="water-primary"
            onClick={() => {
              const text = photoInviteMessage(patientName, `${window.location.origin}${import.meta.env.BASE_URL}`)
              const digits = (whatsapp ?? '').replace(/\D/g, '')
              const to = digits ? (digits.startsWith('55') ? digits : `55${digits}`) : ''
              window.open(`https://wa.me/${to}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
            }}
          >
            Enviar link e passo a passo das fotos (WhatsApp)
          </button>
        </div>
        <BodyPhotoGuide />
        {photos.length > 1 && <PhotoCompare photos={photos} />}
        {photos.length === 0 ? <p className="home-muted">Nenhuma foto enviada.</p> : <div className="pn-photos">{photos.map((p) => <Thumb key={p.id} photo={p} />)}</div>}
      </article>
    </section>
  )
}
