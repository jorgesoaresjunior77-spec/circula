import { useState } from 'react'
import { collectPatientData, downloadJson, erasePatient, setConsent } from '../../hooks/useNutriLgpd'
import { brDate } from '../../lib/nutri'
import type { Patient } from '../../lib/nutri'
import { CONSENT_PARAGRAPHS, consentHtml } from '../../lib/nutriConsent'
import { printDocument } from '../../lib/nutriPrint'

// Privacidade (LGPD) da paciente: consentimento, cópia dos dados e exclusão.

export function PrivacyTab({
  patient,
  nutriName,
  onChanged,
  onErased,
}: {
  patient: Patient
  nutriName: string
  onChanged: () => void
  onErased: () => void
}) {
  const [note, setNote] = useState(patient.consent_note ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const consented = !!patient.consent_at

  async function toggle(on: boolean) {
    setBusy(true)
    const r = await setConsent(patient.id, on, note.trim() || null)
    setBusy(false)
    setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: on ? 'Consentimento registrado.' : 'Consentimento retirado.' })
    if (!r.error) onChanged()
  }

  async function exportData() {
    setBusy(true)
    const data = await collectPatientData(patient.id)
    setBusy(false)
    if (!data) {
      setMsg({ ok: false, text: 'Não foi possível reunir os dados agora.' })
      return
    }
    downloadJson(`dados-${patient.full_name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.json`, data)
    setMsg({ ok: true, text: 'Cópia dos dados baixada.' })
  }

  async function erase() {
    setBusy(true)
    const r = await erasePatient(patient.id)
    setBusy(false)
    if (r.error) {
      setMsg({ ok: false, text: r.error })
      return
    }
    onChanged()
    onErased()
  }

  return (
    <div className="nutri-privacy">
      <div className="nutri-form">
        <h3>Consentimento da paciente</h3>
        <p className="home-muted">
          {consented ? `Registrado em ${brDate(patient.consent_at)}.` : 'Ainda não registrado. Peça a assinatura do termo antes de começar o acompanhamento.'}
        </p>
        {CONSENT_PARAGRAPHS.map((p, i) => (
          <p key={i} className="nutri-notes">
            {p}
          </p>
        ))}
        <button type="button" className="auth-link" onClick={() => printDocument(consentHtml(patient.full_name, nutriName))}>
          Imprimir o termo para assinar (PDF)
        </button>
        <p className="home-muted">Modelo de partida: vale revisar o texto com quem cuida da parte jurídica da sua clínica.</p>
        <label>
          Como foi dado (opcional)
          <input value={note} maxLength={400} placeholder="ex.: termo assinado em papel, na consulta" onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="nutri-actions nutri-actions--start">
          {!consented ? (
            <button type="button" className="water-primary" disabled={busy} onClick={() => void toggle(true)}>
              Registrar que a paciente consentiu
            </button>
          ) : (
            <button type="button" className="auth-link" disabled={busy} onClick={() => void toggle(false)}>
              Retirar o consentimento
            </button>
          )}
        </div>
      </div>

      <div className="nutri-form">
        <h3>Direitos da paciente</h3>
        <p className="home-muted">A pedido dela, você pode entregar uma cópia dos dados ou apagar tudo.</p>
        <button type="button" className="water-primary" disabled={busy} onClick={() => void exportData()}>
          Baixar a cópia dos dados (arquivo)
        </button>
        <hr />
        <p>
          <strong>Apagar todos os dados desta paciente</strong>: cadastro, anamnese, avaliações, consultas, exames, documentos,
          planos e fotos. Não dá para desfazer.
        </p>
        <label>
          Para confirmar, digite o nome dela: <strong>{patient.full_name}</strong>
          <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
        </label>
        <button
          type="button"
          className="agenda-danger"
          disabled={busy || confirmName.trim() !== patient.full_name.trim()}
          onClick={() => void erase()}
        >
          Apagar tudo
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
