import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useManagedContent } from '../hooks/useManagedContent'
import { useExercises } from '../hooks/useExercises'
import type { ExerciseItem } from '../hooks/useExercises'
import { CATEGORIES, GOALS, LEVELS } from '../lib/exerciseCatalog'
import { ExerciseFigure } from './ExerciseFigure'
import { CoverImageInput } from './CoverImageInput'
import { formatBrl } from '../lib/plansCatalog'

// Administração de Exercícios (dona da comunidade): matérias (cadastrar,
// editar, publicar, remover) e revisão da biblioteca (nada aparece para as
// participantes até a nutricionista publicar). O Master também ajusta o preço.

export interface ExerciseArticle {
  id: string
  title: string
  description: string | null
  category: string | null
  body: string | null
  guidance: string | null
  cover_path: string | null
  status: 'draft' | 'published'
}

const EMPTY = { id: null as string | null, title: '', description: '', category: '', body: '', guidance: '', cover: '', status: 'draft' as 'draft' | 'published' }

function ArticlesAdmin({ communityId, profileId }: { communityId: string; profileId: string }) {
  const { items, error, save, remove } = useManagedContent<ExerciseArticle>('exercise_articles', communityId, 'created_at')
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.title.trim()) return setMsg('Dê um título à matéria.')
    const r = await save(form.id, {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      body: form.body.trim() || null,
      guidance: form.guidance.trim() || null,
      cover_path: form.cover || null,
      status: form.status,
    })
    if (r.error) return setMsg(r.error)
    setForm(null)
    setMsg(null)
  }

  return (
    <section className="water-panel">
      <h3>Matérias</h3>
      {error && <p className="auth-error">{error}</p>}
      <ul className="pn-list">
        {items.map((a) => (
          <li key={a.id}>
            <strong>{a.title}</strong> <span className="home-muted">{a.status === 'published' ? 'Publicada' : 'Rascunho'}{a.category ? ` · ${a.category}` : ''}</span>
            <div className="pn-actions">
              <button
                type="button"
                onClick={() => setForm({ id: a.id, title: a.title, description: a.description ?? '', category: a.category ?? '', body: a.body ?? '', guidance: a.guidance ?? '', cover: a.cover_path ?? '', status: a.status })}
              >
                Editar
              </button>
              <button type="button" onClick={() => void save(a.id, { status: a.status === 'published' ? 'draft' : 'published' })}>
                {a.status === 'published' ? 'Despublicar' : 'Publicar'}
              </button>
              <button type="button" onClick={() => window.confirm('Remover esta matéria?') && void remove(a.id)}>
                Remover
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!form && (
        <button type="button" className="water-primary" onClick={() => setForm({ ...EMPTY })}>
          Nova matéria
        </button>
      )}
      {form && (
        <form className="pn-form" onSubmit={(e) => void submit(e)}>
          {msg && <p className="auth-error">{msg}</p>}
          <label>
            Título
            <input value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            Categoria
            <input value={form.category} maxLength={60} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Pernas, Mobilidade, Dicas" />
          </label>
          <label>
            Descrição curta
            <textarea rows={2} value={form.description} maxLength={400} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label>
            Matéria (texto completo)
            <textarea rows={8} value={form.body} maxLength={20000} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </label>
          <label>
            Orientações
            <textarea rows={3} value={form.guidance} maxLength={4000} onChange={(e) => setForm({ ...form, guidance: e.target.value })} />
          </label>
          <CoverImageInput value={form.cover} onChange={(p) => setForm({ ...form, cover: p })} communityId={communityId} uid={profileId} label="Imagem de capa" aspectRatio="16 / 9" />
          <label>
            Situação
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'draft' | 'published' })}>
              <option value="draft">Rascunho</option>
              <option value="published">Publicada</option>
            </select>
          </label>
          <button type="submit" className="water-primary">
            Salvar matéria
          </button>
          <button type="button" onClick={() => setForm(null)}>
            Cancelar
          </button>
        </form>
      )}
    </section>
  )
}

function ItemEditor({ item, onSave, onClose }: { item: ExerciseItem; onSave: (v: Partial<ExerciseItem>) => Promise<{ error: string | null }>; onClose: () => void }) {
  const [d, setD] = useState({
    name: item.name,
    description: item.description ?? '',
    steps: item.steps.join('\n'),
    muscles: item.muscles.join(', '),
    cautions: item.cautions ?? '',
    mistakes: item.mistakes.join('\n'),
    level: item.level,
    mode: item.mode,
    target: String(item.target),
    sets: String(item.sets),
    rest: String(item.rest_sec),
    categories: item.categories as string[],
    goals: item.goals as string[],
  })
  const [msg, setMsg] = useState<string | null>(null)
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
  const toggle = (key: 'categories' | 'goals', v: string) => setD((p) => ({ ...p, [key]: p[key].includes(v) ? p[key].filter((x) => x !== v) : [...p[key], v] }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const r = await onSave({
      name: d.name.trim(),
      description: d.description.trim() || null,
      steps: lines(d.steps),
      muscles: d.muscles.split(',').map((x) => x.trim()).filter(Boolean),
      cautions: d.cautions.trim() || null,
      mistakes: lines(d.mistakes),
      level: d.level,
      mode: d.mode,
      target: Number(d.target) || 10,
      sets: Number(d.sets) || 3,
      rest_sec: Number(d.rest) || 0,
      categories: d.categories,
      goals: d.goals,
    } as Partial<ExerciseItem>)
    if (r.error) setMsg(r.error)
    else onClose()
  }

  return (
    <form className="pn-form ex-editor" onSubmit={(e) => void submit(e)}>
      {msg && <p className="auth-error">{msg}</p>}
      <label>
        Nome
        <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      </label>
      <label>
        Descrição
        <textarea rows={2} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
      </label>
      <label>
        Passo a passo (um por linha)
        <textarea rows={5} value={d.steps} onChange={(e) => setD({ ...d, steps: e.target.value })} />
      </label>
      <label>
        Músculos (separados por vírgula)
        <input value={d.muscles} onChange={(e) => setD({ ...d, muscles: e.target.value })} />
      </label>
      <label>
        Cuidados e contraindicações
        <textarea rows={2} value={d.cautions} onChange={(e) => setD({ ...d, cautions: e.target.value })} />
      </label>
      <label>
        Erros comuns (um por linha)
        <textarea rows={3} value={d.mistakes} onChange={(e) => setD({ ...d, mistakes: e.target.value })} />
      </label>
      <label>
        Nível
        <select value={d.level} onChange={(e) => setD({ ...d, level: e.target.value as ExerciseItem['level'] })}>
          {LEVELS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      <label>
        Medida
        <select value={d.mode} onChange={(e) => setD({ ...d, mode: e.target.value as 'reps' | 'time' })}>
          <option value="reps">Repetições</option>
          <option value="time">Tempo (segundos)</option>
        </select>
      </label>
      <label>
        {d.mode === 'time' ? 'Segundos por série' : 'Repetições por série'}
        <input inputMode="numeric" value={d.target} onChange={(e) => setD({ ...d, target: e.target.value })} />
      </label>
      <label>
        Séries
        <input inputMode="numeric" value={d.sets} onChange={(e) => setD({ ...d, sets: e.target.value })} />
      </label>
      <label>
        Descanso (s)
        <input inputMode="numeric" value={d.rest} onChange={(e) => setD({ ...d, rest: e.target.value })} />
      </label>
      <fieldset className="ex-fieldset">
        <legend>Categorias</legend>
        {CATEGORIES.map((c) => (
          <label key={c} className="ex-check">
            <input type="checkbox" checked={d.categories.includes(c)} onChange={() => toggle('categories', c)} /> {c}
          </label>
        ))}
      </fieldset>
      <fieldset className="ex-fieldset">
        <legend>Objetivos</legend>
        {GOALS.map((g) => (
          <label key={g} className="ex-check">
            <input type="checkbox" checked={d.goals.includes(g)} onChange={() => toggle('goals', g)} /> {g}
          </label>
        ))}
      </fieldset>
      <button type="submit" className="water-primary">
        Salvar exercício
      </button>
      <button type="button" onClick={onClose}>
        Cancelar
      </button>
    </form>
  )
}

export function PriceEditor({ planKey, label, current }: { planKey: 'exercicios' | 'series_filmes'; label: string; current: number }) {
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

export function ExercisesAdmin({ communityId, profileId, isMaster, priceCents }: { communityId: string; profileId: string; isMaster: boolean; priceCents: number }) {
  const api = useExercises(communityId, profileId, true)
  const [editing, setEditing] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => setMsg(null), [api.items.length])

  const drafts = api.items.filter((i) => i.status === 'draft').length

  async function doImport() {
    const r = await api.importBase()
    setMsg(r.error ?? (r.added ? `${r.added} exercícios adicionados como rascunho. Revise e publique um a um.` : 'A biblioteca base já está carregada.'))
  }

  return (
    <div className="ex-admin">
      <ArticlesAdmin communityId={communityId} profileId={profileId} />

      <section className="water-panel">
        <h3>Biblioteca “Se exercite em casa”</h3>
        <p className="home-muted">
          Os exercícios novos entram como <strong>rascunho</strong>: as participantes só veem o que você publicar, depois de revisar o texto e o desenho. {drafts} aguardando revisão.
        </p>
        <button type="button" className="water-primary" onClick={() => void doImport()}>
          Carregar biblioteca base (rascunhos)
        </button>
        {msg && <p className="home-muted">{msg}</p>}
        <ul className="pn-list">
          {api.items.map((it) => (
            <li key={it.id}>
              <div className="ex-admin-row">
                <div className="ex-admin-fig">
                  <ExerciseFigure pose={it.pose_start} label="Posição inicial" />
                  <ExerciseFigure pose={it.pose_end} label="Execução" />
                </div>
                <div>
                  <strong>{it.name}</strong> <span className="home-muted">{it.status === 'published' ? 'Publicado' : 'Rascunho'} · {it.level}</span>
                </div>
              </div>
              {editing === it.id ? (
                <ItemEditor item={it} onSave={(v) => api.saveItem(it.id, v)} onClose={() => setEditing(null)} />
              ) : (
                <div className="pn-actions">
                  <button type="button" onClick={() => setEditing(it.id)}>
                    Revisar / editar
                  </button>
                  <button type="button" onClick={() => void api.saveItem(it.id, { status: it.status === 'published' ? 'draft' : 'published' })}>
                    {it.status === 'published' ? 'Despublicar' : 'Aprovar e publicar'}
                  </button>
                  <button type="button" onClick={() => window.confirm('Remover este exercício?') && void api.deleteItem(it.id)}>
                    Remover
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isMaster && (
        <section className="water-panel">
          <h3>Preço (administração)</h3>
          <PriceEditor planKey="exercicios" label="Exercícios" current={priceCents} />
        </section>
      )}
    </div>
  )
}
