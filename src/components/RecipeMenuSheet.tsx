import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ALLERGENS, COURSES, CUISINES, DIETS, DIFFICULTIES } from '../lib/menuBuilder'
import type { Course, Difficulty } from '../lib/menuBuilder'

// Ficha do cardápio de UMA receita (só a nutricionista edita). É o que permite ao
// "Crie seu Cardápio" filtrar com segurança: tipo de prato, estilo, restrições
// verificadas, alergênicos, tempo, dificuldade, rendimento e custo aproximado.
// Receita sem ficha não entra nos cardápios.

interface Props {
  contentId: string
  communityId: string
}

interface Form {
  course: Course | ''
  cuisines: string[]
  diets: string[]
  allergens: string[]
  verified: boolean
  prep: string
  difficulty: Difficulty | ''
  servings: string
  cost: string
}

const EMPTY: Form = { course: '', cuisines: [], diets: [], allergens: [], verified: false, prep: '', difficulty: '', servings: '', cost: '' }

function toggle(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key]
}

export function RecipeMenuSheet({ contentId, communityId }: Props) {
  const [form, setForm] = useState<Form>(EMPTY)
  const [exists, setExists] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase
        .from('recipe_menu_meta')
        .select('course,cuisines,diets,allergens,allergens_verified,prep_minutes,difficulty,servings,est_cost_cents')
        .eq('content_id', contentId)
        .maybeSingle()
      if (!active) return
      if (data) {
        const d = data as {
          course: Course
          cuisines: string[]
          diets: string[]
          allergens: string[]
          allergens_verified: boolean
          prep_minutes: number | null
          difficulty: Difficulty | null
          servings: number | null
          est_cost_cents: number | null
        }
        setForm({
          course: d.course,
          cuisines: d.cuisines,
          diets: d.diets,
          allergens: d.allergens,
          verified: d.allergens_verified,
          prep: d.prep_minutes?.toString() ?? '',
          difficulty: d.difficulty ?? '',
          servings: d.servings?.toString() ?? '',
          cost: d.est_cost_cents != null ? (d.est_cost_cents / 100).toFixed(2).replace('.', ',') : '',
        })
        setExists(true)
      }
      setLoaded(true)
    })()
    return () => {
      active = false
    }
  }, [contentId])

  async function save() {
    setMessage(null)
    if (!form.course) {
      setMessage({ ok: false, text: 'Escolha o tipo de prato.' })
      return
    }
    const servings = form.servings ? Number(form.servings) : null
    if (servings != null && (!Number.isInteger(servings) || servings < 1)) {
      setMessage({ ok: false, text: 'O rendimento precisa ser um número inteiro de porções.' })
      return
    }
    const prep = form.prep ? Number(form.prep) : null
    const cost = form.cost ? Math.round(Number(form.cost.replace(/\./g, '').replace(',', '.')) * 100) : null
    setBusy(true)
    const { error } = await supabase.from('recipe_menu_meta').upsert(
      {
        content_id: contentId,
        community_id: communityId,
        course: form.course,
        cuisines: form.cuisines,
        diets: form.diets,
        allergens: form.allergens,
        allergens_verified: form.verified,
        prep_minutes: prep && prep > 0 ? prep : null,
        difficulty: form.difficulty || null,
        servings,
        est_cost_cents: cost != null && Number.isFinite(cost) && cost >= 0 ? cost : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'content_id' },
    )
    setBusy(false)
    if (error) setMessage({ ok: false, text: 'Não foi possível salvar a ficha agora.' })
    else {
      setExists(true)
      setMessage({ ok: true, text: 'Ficha salva. A receita já pode entrar nos cardápios.' })
    }
  }

  async function remove() {
    setBusy(true)
    const { error } = await supabase.from('recipe_menu_meta').delete().eq('content_id', contentId)
    setBusy(false)
    if (error) setMessage({ ok: false, text: 'Não foi possível tirar a ficha agora.' })
    else {
      setForm(EMPTY)
      setExists(false)
      setMessage({ ok: true, text: 'Ficha removida. A receita não entra mais nos cardápios.' })
    }
  }

  if (!loaded) return null

  return (
    <fieldset className="menu-sheet">
      <legend>Ficha do cardápio (Crie seu Cardápio)</legend>
      <p className="home-muted">
        Preencha para a receita poder entrar nos cardápios das assinantes. Marque só o que você confirmou: restrições e
        alergênicos são usados para proteger quem tem alergia.
      </p>

      <label>
        Tipo de prato
        <select value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value as Course | '' })}>
          <option value="">Escolha…</option>
          {COURSES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.singular}
            </option>
          ))}
        </select>
      </label>

      <div className="menu-sheet-group">
        <span>Estilo</span>
        {CUISINES.map((c) => (
          <label key={c.key} className="menu-check">
            <input type="checkbox" checked={form.cuisines.includes(c.key)} onChange={() => setForm({ ...form, cuisines: toggle(form.cuisines, c.key) })} />
            {c.label}
          </label>
        ))}
      </div>

      <div className="menu-sheet-group">
        <span>Restrições que a receita atende (verificadas)</span>
        {DIETS.map((d) => (
          <label key={d.key} className="menu-check">
            <input type="checkbox" checked={form.diets.includes(d.key)} onChange={() => setForm({ ...form, diets: toggle(form.diets, d.key) })} />
            {d.label}
          </label>
        ))}
      </div>

      <div className="menu-sheet-group">
        <span>Alergênicos presentes na receita</span>
        {ALLERGENS.map((a) => (
          <label key={a.key} className="menu-check">
            <input type="checkbox" checked={form.allergens.includes(a.key)} onChange={() => setForm({ ...form, allergens: toggle(form.allergens, a.key) })} />
            {a.label}
          </label>
        ))}
        <label className="menu-check menu-check--strong">
          <input type="checkbox" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} />
          Revisei os ingredientes e o risco de contaminação cruzada: a lista de alergênicos acima está completa.
        </label>
        <p className="home-muted">Sem esta confirmação, a receita nunca é sugerida para quem informou alguma alergia.</p>
      </div>

      <div className="menu-sheet-row">
        <label>
          Rendimento (porções)
          <input type="number" min={1} inputMode="numeric" value={form.servings} onChange={(e) => setForm({ ...form, servings: e.target.value })} />
        </label>
        <label>
          Preparo (minutos)
          <input type="number" min={1} inputMode="numeric" value={form.prep} onChange={(e) => setForm({ ...form, prep: e.target.value })} />
        </label>
        <label>
          Dificuldade
          <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty | '' })}>
            <option value="">—</option>
            {DIFFICULTIES.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Custo aproximado da receita (R$)
          <input type="text" inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="Ex.: 45,00" />
        </label>
      </div>

      {message && <p className={message.ok ? 'auth-success' : 'auth-error'}>{message.text}</p>}
      <div className="menu-sheet-actions">
        <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar ficha'}
        </button>
        {exists && (
          <button type="button" className="auth-link" onClick={() => void remove()} disabled={busy}>
            Tirar dos cardápios
          </button>
        )}
      </div>
    </fieldset>
  )
}
