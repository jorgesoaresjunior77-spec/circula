import { useEffect, useState } from 'react'
import type { ListShare, useShopping } from '../../hooks/useShopping'
import { listAsText } from '../../lib/shopping'
import type { ListItem, ShoppingList } from '../../lib/shopping'

// Compartilhar uma lista: com outras participantes (ver ou editar, só a dona
// decide) e como texto para mandar pelo WhatsApp. O texto leva só nomes e
// quantidades, nunca preços.

type Api = ReturnType<typeof useShopping>

export function ShareDialog({ list, items, api, onClose }: { list: ShoppingList; items: ListItem[]; api: Api; onClose: () => void }) {
  const [shares, setShares] = useState<ListShare[]>([])
  const [people, setPeople] = useState<{ id: string; full_name: string | null }[]>([])
  const [who, setWho] = useState('')
  const [perm, setPerm] = useState<'view' | 'edit'>('view')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([api.loadShares(list.id), api.loadPeople()]).then(([s, p]) => {
      if (cancelled) return
      setShares(s)
      setPeople(p)
    })
    return () => {
      cancelled = true
    }
    // carrega uma vez ao abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.id])

  async function add() {
    if (!who) return
    const r = await api.share(list.id, who, perm)
    if (r.error) {
      setMsg({ ok: false, text: r.error })
      return
    }
    setShares(await api.loadShares(list.id))
    setWho('')
    setMsg({ ok: true, text: 'Lista compartilhada.' })
  }

  async function remove(id: string) {
    const r = await api.unshare(id)
    if (r.error) setMsg({ ok: false, text: r.error })
    else setShares((cur) => cur.filter((s) => s.id !== id))
  }

  async function changePerm(s: ListShare, permission: 'view' | 'edit') {
    const r = await api.share(list.id, s.profile_id, permission)
    if (r.error) setMsg({ ok: false, text: r.error })
    else setShares((cur) => cur.map((x) => (x.id === s.id ? { ...x, permission } : x)))
  }

  const text = listAsText(list, items)
  const free = people.filter((p) => !shares.some((s) => s.profile_id === p.id))

  return (
    <div className="ml-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Compartilhar lista">
      <div className="ml-sheet">
        <button type="button" className="plans-sheet-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <h3>Compartilhar “{list.name}”</h3>

        <h4>Com participantes da comunidade</h4>
        <div className="ml-share-row">
          <select aria-label="Participante" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">Escolha uma pessoa…</option>
            {free.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? 'Participante'}
              </option>
            ))}
          </select>
          <select aria-label="Permissão" value={perm} onChange={(e) => setPerm(e.target.value as 'view' | 'edit')}>
            <option value="view">Só ver</option>
            <option value="edit">Ver e editar</option>
          </select>
          <button type="button" className="water-primary" onClick={() => void add()} disabled={!who}>
            Compartilhar
          </button>
        </div>
        <ul className="ml-shares">
          {shares.length === 0 && <li className="home-muted">Ainda não está compartilhada com ninguém.</li>}
          {shares.map((s) => (
            <li key={s.id}>
              <span>{s.full_name ?? 'Participante'}</span>
              <select aria-label={`Permissão de ${s.full_name ?? 'participante'}`} value={s.permission} onChange={(e) => void changePerm(s, e.target.value as 'view' | 'edit')}>
                <option value="view">Só ver</option>
                <option value="edit">Ver e editar</option>
              </select>
              <button type="button" className="auth-link" onClick={() => void remove(s.id)}>
                Remover
              </button>
            </li>
          ))}
        </ul>

        <h4>Mandar como texto</h4>
        <div className="ml-actions">
          <button
            type="button"
            className="water-primary"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')}
          >
            Enviar pelo WhatsApp
          </button>
          <button
            type="button"
            className="auth-link"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text)
                setMsg({ ok: true, text: 'Lista copiada.' })
              } catch {
                setMsg({ ok: false, text: 'Não foi possível copiar.' })
              }
            }}
          >
            Copiar lista
          </button>
        </div>
        {msg && (
          <p className={msg.ok ? 'auth-success' : 'auth-error'} role={msg.ok ? 'status' : 'alert'}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  )
}
