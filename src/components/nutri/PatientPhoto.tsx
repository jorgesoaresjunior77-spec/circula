import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { signedFileUrl } from '../../hooks/useNutriFiles'
import { uid } from '../../lib/nutriPlan'
import type { Patient } from '../../lib/nutri'

// Foto de perfil da paciente (opcional). Fica no espaço privado da Gestão
// Nutricional, nunca no público da comunidade.

const MAX = 5 * 1024 * 1024

export function PatientPhoto({ patient, communityId, onChanged }: { patient: Patient; communityId: string; onChanged: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    if (!patient.photo_path) {
      setUrl(null)
      return
    }
    void signedFileUrl(patient.photo_path).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [patient.photo_path])

  async function pick(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Escolha uma imagem (JPG, PNG ou WebP).')
      return
    }
    if (file.size > MAX) {
      setError('A foto passa de 5 MB.')
      return
    }
    setBusy(true)
    setError(null)
    const ext = (file.name.split('.').pop() ?? 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg'
    const path = `${communityId}/${patient.id}/foto-${uid()}.${ext}`
    const up = await supabase.storage.from('nutri-files').upload(path, file, { contentType: file.type })
    if (up.error) {
      setBusy(false)
      setError('Não foi possível enviar a foto agora.')
      return
    }
    const upd = await supabase.from('nutri_patients').update({ photo_path: path }).eq('id', patient.id)
    if (upd.error) {
      await supabase.storage.from('nutri-files').remove([path])
      setBusy(false)
      setError('Não foi possível salvar a foto agora.')
      return
    }
    if (patient.photo_path) await supabase.storage.from('nutri-files').remove([patient.photo_path])
    setBusy(false)
    if (ref.current) ref.current.value = ''
    onChanged()
  }

  return (
    <div className="nutri-photo">
      {url ? <img src={url} alt={`Foto de ${patient.full_name}`} className="nutri-photo-img" /> : <span className="nutri-photo-img nutri-photo-empty" aria-hidden="true">{patient.full_name.charAt(0).toUpperCase()}</span>}
      <button type="button" className="auth-link" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? 'Enviando…' : url ? 'Trocar foto' : 'Adicionar foto'}
      </button>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
