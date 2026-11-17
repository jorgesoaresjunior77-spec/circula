import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { usePatientFiles, signedFileUrl } from '../../hooks/useNutriFiles'
import type { Exam, NutriDocument } from '../../hooks/useNutriFiles'
import { brDate, isoToday } from '../../lib/nutri'

// Exames laboratoriais e documentos do prontuário. Os resultados são
// registrados exatamente como o laboratório informou: o app não interpreta
// nem aponta "alterado" ou "normal".

async function openFile(path: string, setError: (m: string | null) => void) {
  setError(null)
  const url = await signedFileUrl(path)
  if (!url) {
    setError('Não foi possível abrir o arquivo agora.')
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function ExamsTab({ patientId, communityId }: { patientId: string; communityId: string }) {
  const f = usePatientFiles(patientId, communityId)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', collected_on: isoToday(), result: '', unit: '', reference_range: '', notes: '' })
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Escreva o nome do exame.')
      return
    }
    setSaving(true)
    setError(null)
    const r = await f.addExam(
      {
        name: form.name.trim(),
        collected_on: form.collected_on,
        result: form.result.trim() || null,
        unit: form.unit.trim() || null,
        reference_range: form.reference_range.trim() || null,
        notes: form.notes.trim() || null,
      },
      file,
    )
    setSaving(false)
    if (r.error) {
      setError(r.error)
      return
    }
    setAdding(false)
    setFile(null)
    setForm({ name: '', collected_on: isoToday(), result: '', unit: '', reference_range: '', notes: '' })
  }

  if (f.loading) return <p className="home-muted">Carregando exames…</p>

  return (
    <div className="nutri-exams">
      <p className="home-muted">Registre o resultado como o laboratório informou. O app não interpreta exames.</p>
      {!adding ? (
        <button type="button" className="water-primary" onClick={() => setAdding(true)}>
          Novo exame
        </button>
      ) : (
        <form className="nutri-form" onSubmit={(e) => void submit(e)}>
          <h3>Novo exame</h3>
          <label>
            Nome do exame
            <input value={form.name} maxLength={160} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <div className="nutri-grid2">
            <label>
              Data da coleta
              <input type="date" value={form.collected_on} onChange={(e) => setForm({ ...form, collected_on: e.target.value })} />
            </label>
            <label>
              Resultado
              <input value={form.result} maxLength={200} onChange={(e) => setForm({ ...form, result: e.target.value })} />
            </label>
            <label>
              Unidade
              <input value={form.unit} maxLength={40} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </label>
            <label>
              Intervalo de referência (do laboratório)
              <input value={form.reference_range} maxLength={200} onChange={(e) => setForm({ ...form, reference_range: e.target.value })} />
            </label>
          </div>
          <label>
            Observações
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <div>
            <button type="button" className="auth-link" onClick={() => fileRef.current?.click()}>
              {file ? `Arquivo: ${file.name}` : 'Anexar PDF ou imagem (até 15 MB)'}
            </button>
            <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
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
              {saving ? 'Salvando…' : 'Salvar exame'}
            </button>
          </div>
        </form>
      )}
      {!adding && error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {f.exams.length === 0 && !adding && <p className="home-muted">Nenhum exame registrado.</p>}
      <ul className="nutri-timeline">
        {f.exams.map((x: Exam) => (
          <li key={x.id} className="nutri-timeline-item">
            <div className="nutri-timeline-head">
              <strong>{x.name}</strong>
              <span className="home-muted">{brDate(x.collected_on)}</span>
            </div>
            <p className="nutri-calc">
              {x.result ? <strong>{x.result}</strong> : 'Sem resultado digitado'} {x.unit ?? ''}
              {x.reference_range ? ` · referência: ${x.reference_range}` : ''}
            </p>
            {x.notes && <p className="nutri-notes">{x.notes}</p>}
            <div className="nutri-actions nutri-actions--start">
              {x.file_path && (
                <button type="button" className="auth-link" onClick={() => void openFile(x.file_path as string, setError)}>
                  Abrir anexo
                </button>
              )}
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  if (window.confirm(`Excluir o exame "${x.name}"?`)) void f.removeExam(x)
                }}
              >
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DocumentsTab({ patientId, communityId }: { patientId: string; communityId: string }) {
  const f = usePatientFiles(patientId, communityId)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function pick(file: File | undefined) {
    if (!file) return
    if (!title.trim()) {
      setError('Dê um título ao documento antes de escolher o arquivo.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setBusy(true)
    setError(null)
    const r = await f.addDocument(title, file)
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
    if (r.error) setError(r.error)
    else setTitle('')
  }

  if (f.loading) return <p className="home-muted">Carregando documentos…</p>

  return (
    <div className="nutri-docs">
      <div className="nutri-form">
        <label>
          Título do documento
          <input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <button type="button" className="water-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Enviando…' : 'Escolher arquivo (PDF ou imagem, até 15 MB)'}
        </button>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {f.documents.length === 0 && <p className="home-muted">Nenhum documento anexado.</p>}
      <ul className="nutri-timeline">
        {f.documents.map((d: NutriDocument) => (
          <li key={d.id} className="nutri-timeline-item">
            <div className="nutri-timeline-head">
              <strong>{d.title}</strong>
              <span className="home-muted">{brDate(d.created_at)}</span>
            </div>
            {d.file_name && <p className="home-muted">{d.file_name}</p>}
            <div className="nutri-actions nutri-actions--start">
              <button type="button" className="auth-link" onClick={() => void openFile(d.file_path, setError)}>
                Abrir
              </button>
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  if (window.confirm(`Excluir "${d.title}"?`)) void f.removeDocument(d)
                }}
              >
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
