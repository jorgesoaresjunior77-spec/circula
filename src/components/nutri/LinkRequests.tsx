import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Pedidos "Sou paciente da Nutri": a participante pede, a nutricionista decide.
// Aprovar cria a ficha (ou liga a uma ficha existente) e libera o botão Nutri
// no menu dela. Nenhuma participante se vincula sozinha.

interface Req {
  id: string
  profile_id: string
  full_name: string | null
}
interface Option {
  id: string
  full_name: string
}

export function LinkRequests({ communityId, patients, onChanged }: { communityId: string; patients: Option[]; onChanged: () => void }) {
  const [reqs, setReqs] = useState<Req[]>([])
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('list_nutri_link_requests', { p_community: communityId })
    setReqs((data ?? []) as Req[])
  }, [communityId])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(id: string, approve: boolean) {
    setMessage(null)
    const patient = choice[id] || null
    const { error } = await supabase.rpc('decide_nutri_link', { p_request: id, p_approve: approve, p_patient: patient })
    if (error) return setMessage('Não foi possível concluir agora.')
    await load()
    onChanged()
  }

  if (reqs.length === 0) return null
  return (
    <section className="water-panel" aria-label="Pedidos de vínculo">
      <h3>Quem marcou “Sou paciente da Nutri”</h3>
      {message && <p className="auth-error">{message}</p>}
      <ul className="pn-list">
        {reqs.map((r) => (
          <li key={r.id}>
            <strong>{r.full_name ?? 'Participante'}</strong>
            <label>
              Ligar a uma ficha existente (opcional)
              <select value={choice[r.id] ?? ''} onChange={(e) => setChoice((c) => ({ ...c, [r.id]: e.target.value }))}>
                <option value="">Criar ficha nova com o nome dela</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </label>
            <div className="pn-actions">
              <button type="button" onClick={() => void decide(r.id, true)}>
                Confirmar como paciente
              </button>
              <button type="button" onClick={() => void decide(r.id, false)}>
                Recusar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
