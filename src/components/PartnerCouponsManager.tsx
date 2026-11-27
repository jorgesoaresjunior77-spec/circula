import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { couponValueLabel, normalizeCouponCode } from '../lib/partners'
import type { PartnerCoupon } from '../lib/partners'

// Painel → Parceiros → cupons de um parceiro. A profissional cria, edita,
// ativa/desativa e vê quantas vezes cada cupom foi usado. O controle de
// limite e o registro de cada uso acontecem no banco (redeem_partner_coupon).

type Row = Omit<PartnerCoupon, 'used' | 'available' | 'status'> & { active: boolean; partner_id: string; community_id: string }

type LimitChoice = '1' | '3' | 'custom' | 'unlimited'

interface Form {
  id: string | null
  title: string
  code: string
  benefit: string
  discount_type: PartnerCoupon['discount_type']
  discount_value: string
  instructions: string
  limit: LimitChoice
  custom: string
  after_redeem: 'hide' | 'mark'
  valid_from: string
  valid_until: string
  active: boolean
}

const EMPTY: Form = {
  id: null,
  title: '',
  code: '',
  benefit: '',
  discount_type: 'percentual',
  discount_value: '',
  instructions: '',
  limit: '1',
  custom: '5',
  after_redeem: 'mark',
  valid_from: '',
  valid_until: '',
  active: true,
}

const COLS = 'id,partner_id,community_id,title,code,benefit,discount_type,discount_value,instructions,max_per_person,after_redeem,valid_from,valid_until,active'

function limitOf(f: Form): number | null | 'invalid' {
  if (f.limit === 'unlimited') return null
  if (f.limit === '1') return 1
  if (f.limit === '3') return 3
  const n = Number(f.custom)
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 'invalid'
}

export function PartnerCouponsManager({ communityId, partnerId }: { communityId: string; partnerId: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [uses, setUses] = useState<Record<string, number>>({})
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('partner_coupons').select(COLS).eq('partner_id', partnerId).order('created_at')
    const list = ((data ?? []) as Row[]).map((r) => ({ ...r, discount_value: r.discount_value == null ? null : Number(r.discount_value) }))
    setRows(list)
    if (list.length) {
      const { data: red } = await supabase.from('partner_coupon_redemptions').select('coupon_id').in('coupon_id', list.map((r) => r.id)).limit(10000)
      const count: Record<string, number> = {}
      for (const r of (red ?? []) as { coupon_id: string }[]) count[r.coupon_id] = (count[r.coupon_id] ?? 0) + 1
      setUses(count)
    }
  }, [partnerId])

  useEffect(() => {
    void load()
  }, [load])

  function edit(r: Row) {
    const lim = r.max_per_person
    setForm({
      id: r.id,
      title: r.title,
      code: r.code,
      benefit: r.benefit,
      discount_type: r.discount_type,
      discount_value: r.discount_value == null ? '' : String(r.discount_value).replace('.', ','),
      instructions: r.instructions ?? '',
      limit: lim == null ? 'unlimited' : lim === 1 ? '1' : lim === 3 ? '3' : 'custom',
      custom: lim != null && lim !== 1 && lim !== 3 ? String(lim) : '5',
      after_redeem: r.after_redeem,
      valid_from: r.valid_from ?? '',
      valid_until: r.valid_until ?? '',
      active: r.active,
    })
    setError(null)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const code = normalizeCouponCode(form.code)
    if (!form.title.trim()) return setError('Dê um nome ao cupom (ex.: Boas-vindas).')
    if (code.length < 3) return setError('O código precisa ter de 3 a 30 letras ou números (ex.: CIRCULA10).')
    if (!form.benefit.trim()) return setError('Descreva o benefício (ex.: 10% de desconto em qualquer compra).')
    const needsValue = form.discount_type === 'percentual' || form.discount_type === 'valor'
    const value = form.discount_value.trim() ? Number(form.discount_value.replace(',', '.')) : null
    if (needsValue && (value == null || !(value > 0))) return setError('Informe o valor do desconto.')
    if (form.discount_type === 'percentual' && value != null && value > 100) return setError('O percentual vai até 100.')
    const max = limitOf(form)
    if (max === 'invalid') return setError('A quantidade personalizada precisa ser um número inteiro de 1 a 1000.')
    if (form.valid_from && form.valid_until && form.valid_until < form.valid_from) return setError('A validade final não pode ser antes da inicial.')

    setBusy(true)
    setError(null)
    // confere o código antes (o banco também barra com índice único)
    const { data: taken } = await supabase.rpc('partner_coupon_code_taken', { p_community_id: communityId, p_code: code, p_except: form.id })
    if (taken === true) {
      setBusy(false)
      return setError(`O código ${code} já existe em outro cupom. Escolha outro.`)
    }
    const row = {
      community_id: communityId,
      partner_id: partnerId,
      title: form.title.trim(),
      code,
      benefit: form.benefit.trim(),
      discount_type: form.discount_type,
      discount_value: needsValue ? value : null,
      instructions: form.instructions.trim() || null,
      max_per_person: max,
      after_redeem: form.after_redeem,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      active: form.active,
    }
    const res = form.id ? await supabase.from('partner_coupons').update(row).eq('id', form.id) : await supabase.from('partner_coupons').insert(row)
    setBusy(false)
    if (res.error) {
      setError(/partner_coupons_code_uidx|duplicate/i.test(res.error.message) ? `O código ${code} já existe em outro cupom. Escolha outro.` : 'Não foi possível salvar o cupom agora.')
      return
    }
    setForm(null)
    void load()
  }

  async function toggle(r: Row) {
    await supabase.from('partner_coupons').update({ active: !r.active }).eq('id', r.id)
    void load()
  }

  async function remove(id: string) {
    await supabase.from('partner_coupons').delete().eq('id', id)
    setForm(null)
    void load()
  }

  return (
    <section className="pcm">
      <h4>Cupons deste parceiro</h4>
      {rows.length === 0 && !form && <p className="home-muted">Nenhum cupom ainda.</p>}
      <ul className="pcm-list">
        {rows.map((r) => (
          <li key={r.id} className={`pcm-item${r.active ? '' : ' pcm-item--off'}`}>
            <div>
              <strong>{r.title}</strong> · <code>{r.code}</code> {couponValueLabel(r) && <em>· {couponValueLabel(r)}</em>}
              <p className="home-muted">
                {r.max_per_person == null ? 'Ilimitado' : `${r.max_per_person}x por pessoa`} · {r.after_redeem === 'hide' ? 'some depois de usado' : 'fica riscado depois de usado'}
                {r.valid_until ? ` · até ${r.valid_until.split('-').reverse().join('/')}` : ''} · usado {uses[r.id] ?? 0}x · {r.active ? 'ativo' : 'inativo'}
              </p>
            </div>
            <div className="pcm-item-actions">
              <button type="button" className="water-link" onClick={() => edit(r)}>
                Editar
              </button>
              <button type="button" className="water-link" onClick={() => void toggle(r)}>
                {r.active ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!form && (
        <button type="button" className="water-primary" onClick={() => setForm({ ...EMPTY })}>
          Novo cupom
        </button>
      )}
      {form && (
        <form className="wellness-form pcm-form" onSubmit={(e) => void save(e)} aria-label={form.id ? 'Editar cupom' : 'Novo cupom'}>
          <label>
            Nome do cupom
            <input value={form.title} maxLength={80} placeholder="Ex.: Boas-vindas" onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            Código (único)
            <input value={form.code} maxLength={30} placeholder="Ex.: CIRCULA10" autoCapitalize="characters" onChange={(e) => setForm({ ...form, code: normalizeCouponCode(e.target.value) })} />
          </label>
          <label>
            Benefício (o que a participante ganha)
            <textarea value={form.benefit} maxLength={300} rows={2} onChange={(e) => setForm({ ...form, benefit: e.target.value })} />
          </label>
          <div className="pcm-row">
            <label>
              Tipo de desconto
              <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as Form['discount_type'] })}>
                <option value="percentual">Percentual (%)</option>
                <option value="valor">Valor (R$)</option>
                <option value="frete_gratis">Frete grátis</option>
                <option value="brinde">Brinde</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            {(form.discount_type === 'percentual' || form.discount_type === 'valor') && (
              <label>
                {form.discount_type === 'percentual' ? 'Percentual' : 'Valor (R$)'}
                <input inputMode="decimal" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value.replace(/[^\d.,]/g, '') })} />
              </label>
            )}
          </div>
          <div className="pcm-row">
            <label>
              Quantas vezes cada pessoa pode usar
              <select value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value as LimitChoice })}>
                <option value="1">Uma vez por pessoa</option>
                <option value="3">Três vezes por pessoa</option>
                <option value="custom">Quantidade personalizada</option>
                <option value="unlimited">Ilimitado</option>
              </select>
            </label>
            {form.limit === 'custom' && (
              <label>
                Quantidade
                <input inputMode="numeric" value={form.custom} onChange={(e) => setForm({ ...form, custom: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
              </label>
            )}
          </div>
          <label>
            Depois que a pessoa usar tudo
            <select value={form.after_redeem} onChange={(e) => setForm({ ...form, after_redeem: e.target.value as 'hide' | 'mark' })} disabled={form.limit === 'unlimited'}>
              <option value="mark">Continua aparecendo, riscado como utilizado</option>
              <option value="hide">Some da página para ela</option>
            </select>
          </label>
          {form.limit === 'unlimited' && <small className="home-muted">Cupom ilimitado nunca fica esgotado por uso.</small>}
          <div className="pcm-row">
            <label>
              Válido a partir de
              <input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
            </label>
            <label>
              Válido até
              <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
            </label>
          </div>
          <label>
            Como usar (opcional)
            <textarea value={form.instructions} maxLength={600} rows={2} placeholder="Ex.: Mostre o código no caixa ou digite no site." onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
          </label>
          <label className="auth-check">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <span>Ativo (aparece para as participantes)</span>
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="wellness-form-actions">
            <button type="submit" className="water-primary" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar cupom'}
            </button>
            <button type="button" className="water-link" onClick={() => setForm(null)} disabled={busy}>
              Cancelar
            </button>
            {form.id && (
              <button type="button" className="agenda-danger" onClick={() => void remove(form.id as string)} disabled={busy}>
                Excluir
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  )
}
