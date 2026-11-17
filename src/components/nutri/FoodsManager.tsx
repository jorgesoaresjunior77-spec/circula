import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { parseFoodsCsv } from '../../lib/nutriPlan'
import type { Food, FoodRow } from '../../lib/nutriPlan'

// Banco de alimentos da nutricionista. Nada vem pré-carregado: ela cadastra
// os alimentos que usa ou importa um arquivo CSV de uma base confiável (TACO,
// TBCA...), respeitando a licença de uso de cada base.

const FIELDS: { key: keyof FoodRow; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calorias', unit: 'kcal' },
  { key: 'protein_g', label: 'Proteínas', unit: 'g' },
  { key: 'carb_g', label: 'Carboidratos', unit: 'g' },
  { key: 'fat_g', label: 'Gorduras totais', unit: 'g' },
  { key: 'sat_fat_g', label: 'Gorduras saturadas', unit: 'g' },
  { key: 'fiber_g', label: 'Fibras', unit: 'g' },
  { key: 'sodium_mg', label: 'Sódio', unit: 'mg' },
]

const EMPTY: FoodRow = {
  name: '',
  category: null,
  portion_label: null,
  portion_g: 100,
  kcal: null,
  protein_g: null,
  carb_g: null,
  fat_g: null,
  sat_fat_g: null,
  fiber_g: null,
  sodium_mg: null,
}

const toNum = (v: string): number | null => {
  const n = Number(v.replace(',', '.'))
  return v.trim() === '' || Number.isNaN(n) || n < 0 ? null : n
}

export function FoodsManager({
  foods,
  onSave,
  onImport,
  onRemove,
  onBack,
}: {
  foods: Food[]
  onSave: (id: string | null, row: FoodRow) => Promise<{ error: string | null }>
  onImport: (rows: FoodRow[]) => Promise<{ error: string | null; inserted: number }>
  onRemove: (id: string) => Promise<{ error: string | null }>
  onBack: () => void
}) {
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<{ id: string | null; row: FoodRow } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState<{ rows: FoodRow[]; skipped: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return foods.filter((f) => !t || f.name.toLowerCase().includes(t) || (f.category ?? '').toLowerCase().includes(t)).slice(0, 100)
  }, [foods, q])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    if (!editing.row.name.trim()) {
      setError('Escreva o nome do alimento.')
      return
    }
    const r = await onSave(editing.id, { ...editing.row, name: editing.row.name.trim() })
    if (r.error) setError(r.error)
    else {
      setEditing(null)
      setError(null)
    }
  }

  async function pickFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setMsg(null)
    const parsed = parseFoodsCsv(await file.text())
    if (parsed.error) {
      setError(parsed.error)
      return
    }
    setPending({ rows: parsed.rows, skipped: parsed.skipped })
  }

  async function loadTaco() {
    setError(null)
    setMsg(null)
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}taco-4a-edicao.csv`)
      if (!res.ok) throw new Error('http')
      const parsed = parseFoodsCsv(await res.text())
      if (parsed.error) {
        setError(parsed.error)
        return
      }
      const have = new Set(foods.map((f) => f.name.trim().toLowerCase()))
      const fresh = parsed.rows.filter((r) => !have.has(r.name.trim().toLowerCase()))
      if (fresh.length === 0) {
        setMsg('A tabela TACO já está no seu banco de alimentos.')
        return
      }
      setPending({ rows: fresh, skipped: parsed.rows.length - fresh.length })
    } catch {
      setError('Não foi possível carregar a tabela TACO agora. Verifique a internet e tente de novo.')
    }
  }

  async function confirmImport() {
    if (!pending) return
    const r = await onImport(pending.rows)
    setPending(null)
    if (fileRef.current) fileRef.current.value = ''
    if (r.error) setError(r.error)
    else setMsg(`${r.inserted} alimentos importados.`)
  }

  if (editing) {
    const row = editing.row
    const set = (patch: Partial<FoodRow>) => setEditing({ ...editing, row: { ...row, ...patch } })
    return (
      <form className="nutri-form" onSubmit={(e) => void submit(e)}>
        <h3>{editing.id ? 'Editar alimento' : 'Novo alimento'}</h3>
        <label>
          Nome
          <input value={row.name} maxLength={200} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label>
          Categoria
          <input value={row.category ?? ''} maxLength={80} onChange={(e) => set({ category: e.target.value || null })} />
        </label>
        <div className="nutri-grid2">
          <label>
            Porção de referência (g)
            <input inputMode="decimal" value={row.portion_g} onChange={(e) => set({ portion_g: toNum(e.target.value) ?? 100 })} />
          </label>
          <label>
            Medida caseira
            <input value={row.portion_label ?? ''} maxLength={80} placeholder="ex.: 1 colher de sopa" onChange={(e) => set({ portion_label: e.target.value || null })} />
          </label>
        </div>
        <p className="home-muted">Os valores abaixo são os da porção de referência.</p>
        <div className="nutri-grid2">
          {FIELDS.map((f) => (
            <label key={f.key}>
              {f.label} ({f.unit})
              <input
                inputMode="decimal"
                value={(row[f.key] as number | null) ?? ''}
                onChange={(e) => set({ [f.key]: toNum(e.target.value) } as Partial<FoodRow>)}
              />
            </label>
          ))}
        </div>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="nutri-actions">
          <button type="button" className="auth-link" onClick={() => setEditing(null)}>
            Cancelar
          </button>
          <button type="submit" className="water-primary">
            Salvar
          </button>
        </div>
      </form>
    )
  }

  return (
    <section className="nutri-module">
      <button type="button" className="auth-link" onClick={onBack}>
        ‹ Gestão Nutricional
      </button>
      <h2>Banco de alimentos</h2>
      <p className="home-muted">
        {foods.length} alimentos. Cadastre os seus ou importe um CSV de uma base confiável (TACO, TBCA), respeitando a
        licença dela. O app não traz alimentos prontos.
      </p>
      <div className="nutri-actions nutri-actions--start">
        <button type="button" className="water-primary" onClick={() => setEditing({ id: null, row: { ...EMPTY } })}>
          Novo alimento
        </button>
        <button type="button" className="water-primary" onClick={() => void loadTaco()}>
          Importar a tabela TACO
        </button>
        <button type="button" className="water-primary" onClick={() => fileRef.current?.click()}>
          Importar outro CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => void pickFile(e.target.files?.[0])} />
      </div>
      <p className="home-muted">
        A tabela TACO traz 591 alimentos brasileiros com os valores por 100 g. Fonte: Tabela Brasileira de Composição de
        Alimentos (TACO), 4ª edição ampliada e revisada, NEPA/UNICAMP, 2011. Alimentos sem valor medido na tabela ficam em
        branco, e o app nunca preenche esses valores por conta própria.
      </p>
      <details className="nutri-help">
        <summary>Como montar o CSV</summary>
        <p>
          Primeira linha com os nomes das colunas: <code>nome; categoria; porcao; kcal; proteina; carboidrato; gordura;
          gordura saturada; fibra; sodio</code>. Separador ponto e vírgula ou vírgula; decimal com vírgula ou ponto.
          Os valores são os da porção informada (sem coluna de porção, vale 100 g).
        </p>
      </details>

      {pending && (
        <div className="nutri-form">
          <p>
            Encontrei <strong>{pending.rows.length}</strong> alimentos
            {pending.skipped ? ` (${pending.skipped} já existentes ou sem dados foram deixados de fora)` : ''}. Importar?
          </p>
          <div className="nutri-actions">
            <button type="button" className="auth-link" onClick={() => setPending(null)}>
              Cancelar
            </button>
            <button type="button" className="water-primary" onClick={() => void confirmImport()}>
              Importar
            </button>
          </div>
        </div>
      )}
      {msg && (
        <p className="auth-success" role="status">
          {msg}
        </p>
      )}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <input type="search" className="magazine-input" placeholder="Buscar alimento ou categoria" aria-label="Buscar alimento" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="nutri-list">
        {list.map((f) => (
          <li key={f.id}>
            <div className="nutri-row nutri-row--split">
              <span>
                <strong>{f.name}</strong>
                <small>
                  {f.kcal != null ? `${f.kcal} kcal` : 'sem calorias'} · {f.portion_g} g{f.category ? ` · ${f.category}` : ''}
                </small>
              </span>
              <span className="nutri-actions">
                <button
                  type="button"
                  className="auth-link"
                  onClick={() =>
                    setEditing({
                      id: f.id,
                      row: {
                        name: f.name,
                        category: f.category,
                        portion_label: f.portion_label,
                        portion_g: f.portion_g,
                        kcal: f.kcal,
                        protein_g: f.protein_g,
                        carb_g: f.carb_g,
                        fat_g: f.fat_g,
                        sat_fat_g: f.sat_fat_g,
                        fiber_g: f.fiber_g,
                        sodium_mg: f.sodium_mg,
                      },
                    })
                  }
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => {
                    if (window.confirm(`Excluir "${f.name}"? Planos já feitos não mudam.`)) void onRemove(f.id)
                  }}
                >
                  Excluir
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {foods.length > list.length && <p className="home-muted">Mostrando {list.length}. Use a busca para achar os demais.</p>}
    </section>
  )
}
