import { useState } from 'react'
import type { FormEvent } from 'react'
import { redeemAccessCode } from '../lib/accessCode'

// Planos: quem recebeu da nutricionista um código de acesso ilimitado digita aqui (se não digitou no cadastro).
export function AccessCodeRedeem({ onRedeemed }: { onRedeemed?: () => void }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { error } = await redeemAccessCode(code)
    setBusy(false)
    if (error) {
      setMsg({ ok: false, text: error })
      return
    }
    setMsg({ ok: true, text: 'Pronto! Seu acesso ilimitado ao Círcula está liberado.' })
    setCode('')
    onRedeemed?.()
  }

  if (!open) {
    return (
      <button type="button" className="water-link access-redeem-open" onClick={() => setOpen(true)}>
        Tenho um código de acesso
      </button>
    )
  }
  return (
    <form className="access-redeem" onSubmit={(e) => void submit(e)}>
      <label htmlFor="access-redeem-code">Código de acesso ilimitado</label>
      <input
        id="access-redeem-code"
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        maxLength={12}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Ex.: ABCD2345"
      />
      <button type="submit" className="water-primary" disabled={busy || !code.trim()}>
        {busy ? 'Conferindo…' : 'Usar código'}
      </button>
      {msg && <p className={msg.ok ? 'auth-success' : 'auth-error'}>{msg.text}</p>}
    </form>
  )
}
