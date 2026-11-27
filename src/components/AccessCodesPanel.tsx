import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Painel → Planos e assinaturas: a nutricionista gera códigos de acesso ilimitado (um por pessoa), vê quem usou
// e pode desativar os que ainda não foram usados. O código também pode ir direto no convite pelo WhatsApp.

interface CodeRow {
  id: string
  code: string
  note: string | null
  created_at: string
  used_at: string | null
  revoked_at: string | null
  used_by: string | null
}

const FMT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

export function AccessCodesPanel({ communityId }: { communityId: string }) {
  const [rows, setRows] = useState<CodeRow[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('access_codes')
      .select('id, code, note, created_at, used_at, revoked_at, used_by')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (e) {
      setError('Não foi possível carregar os códigos.')
      return
    }
    const list = (data as CodeRow[] | null) ?? []
    setRows(list)
    const ids = [...new Set(list.map((r) => r.used_by).filter((x): x is string => !!x))]
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      setNames(Object.fromEntries(((ps as { id: string; full_name: string | null }[] | null) ?? []).map((p) => [p.id, p.full_name ?? 'Participante'])))
    }
  }, [communityId])

  useEffect(() => {
    void load()
  }, [load])

  async function generate() {
    setBusy(true)
    setError(null)
    const { data, error: e } = await supabase.rpc('create_access_code', { p_community_id: communityId, p_note: note.trim() || null })
    setBusy(false)
    if (e || typeof data !== 'string') {
      setError('Não foi possível gerar o código agora.')
      return
    }
    setFresh(data)
    setNote('')
    void load()
  }

  async function revoke(id: string) {
    const { error: e } = await supabase.rpc('revoke_access_code', { p_id: id })
    if (e) setError('Não foi possível desativar o código.')
    void load()
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      setCopied(null)
    }
  }

  return (
    <section className="community-card access-codes" aria-labelledby="access-codes-title">
      <h3 id="access-codes-title">Códigos de acesso ilimitado</h3>
      <p className="challenge-field-hint">
        Para quem você quer dar o Círcula inteiro, sem cobrança e para sempre. Cada código vale para uma pessoa: ela digita no primeiro acesso
        (ou depois, em Planos). Você também pode mandar o código junto com o convite pelo WhatsApp.
      </p>
      <div className="access-codes-new">
        <label htmlFor="access-code-note">Para quem é (opcional)</label>
        <input id="access-code-note" type="text" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Ana, minha sócia" />
        <button type="button" className="water-primary" onClick={() => void generate()} disabled={busy}>
          {busy ? 'Gerando…' : 'Gerar código'}
        </button>
      </div>
      {fresh && (
        <p className="access-codes-fresh" role="status">
          Código gerado: <strong>{fresh}</strong>{' '}
          <button type="button" className="water-link" onClick={() => void copy(fresh)}>
            {copied === fresh ? 'Copiado!' : 'Copiar'}
          </button>
        </p>
      )}
      {error && <p className="auth-error">{error}</p>}
      {rows.length > 0 && (
        <ul className="access-codes-list">
          {rows.map((r) => {
            const state = r.used_at ? 'usado' : r.revoked_at ? 'desativado' : 'livre'
            return (
              <li key={r.id} className={`access-code access-code--${state}`}>
                <span className="access-code-value">{r.code}</span>
                <span className="access-code-info">
                  {r.note ? `${r.note} · ` : ''}
                  {state === 'usado'
                    ? `usado por ${r.used_by ? (names[r.used_by] ?? 'participante') : 'participante'} em ${FMT.format(new Date(r.used_at as string))}`
                    : state === 'desativado'
                      ? 'desativado'
                      : `livre · criado em ${FMT.format(new Date(r.created_at))}`}
                </span>
                {state === 'livre' && (
                  <span className="access-code-actions">
                    <button type="button" className="water-link" onClick={() => void copy(r.code)}>
                      {copied === r.code ? 'Copiado!' : 'Copiar'}
                    </button>
                    <button type="button" className="water-link" onClick={() => void revoke(r.id)}>
                      Desativar
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
