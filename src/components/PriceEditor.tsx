import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatBrl } from '../lib/plansCatalog'

// Preço mensal de um produto avulso, editável pelo Master (tabela
// product_price_overrides). O servidor lê este valor antes do catálogo.

export function PriceEditor({ planKey, label, current }: { planKey: 'exercicios' | 'series_filmes' | 'viagens'; label: string; current: number }) {
  const [value, setValue] = useState((current / 100).toFixed(2).replace('.', ','))
  const [msg, setMsg] = useState<string | null>(null)
  async function save() {
    const cents = Math.round(Number(value.replace(',', '.')) * 100)
    if (!Number.isFinite(cents) || cents < 100 || cents > 99900) return setMsg('Informe um valor entre R$ 1,00 e R$ 999,00.')
    const { error } = await supabase.from('product_price_overrides').upsert({ plan_key: planKey, monthly_cents: cents, updated_at: new Date().toISOString() }, { onConflict: 'plan_key' })
    setMsg(error ? 'Não foi possível salvar o preço.' : `Preço de ${label} agora: ${formatBrl(cents)} por mês.`)
  }
  return (
    <div className="pn-form">
      <label>
        Preço mensal de {label} (R$)
        <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button type="button" className="water-primary" onClick={() => void save()}>
        Salvar preço
      </button>
      {msg && <p className="home-muted">{msg}</p>}
    </div>
  )
}
