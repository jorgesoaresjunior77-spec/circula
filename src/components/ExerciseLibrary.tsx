import { useMemo, useState } from 'react'
import { ExerciseFigure } from './ExerciseFigure'
import { ExercisePlayer } from './ExercisePlayer'
import type { RunSummary } from './ExercisePlayer'
import { useExercises } from '../hooks/useExercises'
import type { ExerciseItem } from '../hooks/useExercises'
import { CATEGORIES, GENERAL_SAFETY, GOALS, LEVELS, QUICK_MINUTES, WEEKDAYS, buildQuickWorkout, exerciseSeconds, filterExercises, formatClock } from '../lib/exerciseCatalog'

// "Se exercite em casa": biblioteca com filtros, favoritos e histórico, treinos
// rápidos (5 a 30 min), treinos montados pela usuária e programa da semana.

type Tab = 'biblioteca' | 'treinos' | 'semana' | 'historico'
const TABS: { key: Tab; label: string }[] = [
  { key: 'biblioteca', label: 'Exercícios' },
  { key: 'treinos', label: 'Treinos' },
  { key: 'semana', label: 'Minha semana' },
  { key: 'historico', label: 'Histórico' },
]

type Api = ReturnType<typeof useExercises>

function Detail({ e, api, onBack }: { e: ExerciseItem; api: Api; onBack: () => void }) {
  const fav = api.favorites.has(e.id)
  const [msg, setMsg] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  if (playing) {
    return (
      <ExercisePlayer
        title={e.name}
        exercises={[e]}
        onFinish={(s) => {
          void api.finishRun({ name: e.name, total: s.total, done: s.done, seconds: s.seconds })
          if (s.done > 0) void api.logDone(e.id)
        }}
        onExit={() => setPlaying(false)}
      />
    )
  }
  return (
    <article className="ex-detail">
      <button type="button" className="water-link" onClick={onBack}>
        ‹ Voltar
      </button>
      <h3>{e.name}</h3>
      <p className="home-muted">
        {e.level} · {e.sets} séries de {e.mode === 'time' ? `${e.target} s` : `${e.target} repetições`} · descanso {e.rest_sec} s
      </p>
      <div className="ex-pair">
        <figure>
          <ExerciseFigure pose={e.pose_start} label={`${e.name}: posição inicial`} />
          <figcaption>1. Posição inicial</figcaption>
        </figure>
        <figure>
          <ExerciseFigure pose={e.pose_end} label={`${e.name}: execução`} />
          <figcaption>2. Execução</figcaption>
        </figure>
      </div>
      {e.description && <p>{e.description}</p>}
      <h4>Passo a passo</h4>
      <ol className="ex-steps">
        {e.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <p>
        <strong>Músculos trabalhados:</strong> {e.muscles.join(', ')}
      </p>
      {e.cautions && (
        <p className="ex-caution">
          <strong>Cuidados:</strong> {e.cautions}
        </p>
      )}
      {e.mistakes.length > 0 && (
        <>
          <h4>Erros comuns</h4>
          <ul>
            {e.mistakes.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </>
      )}
      {msg && <p className="auth-error">{msg}</p>}
      <div className="ex-controls">
        <button type="button" className="ex-big" onClick={() => setPlaying(true)}>
          Fazer agora
        </button>
        <button type="button" onClick={() => void api.toggleFavorite(e.id).then((r) => setMsg(r.error))}>
          {fav ? '♥ Favorito' : '♡ Favoritar'}
        </button>
        <button type="button" onClick={() => void api.logDone(e.id).then((r) => setMsg(r.error ?? 'Marcado como concluído hoje. 👏'))}>
          Marcar como feito
        </button>
      </div>
      <p className="water-note">{GENERAL_SAFETY}</p>
    </article>
  )
}

export function ExerciseLibrary({ communityId, profileId, onBack }: { communityId: string; profileId: string; onBack: () => void }) {
  const api = useExercises(communityId, profileId, true)
  const [tab, setTab] = useState<Tab>('biblioteca')
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [goal, setGoal] = useState('')
  const [level, setLevel] = useState('')
  const [favOnly, setFavOnly] = useState(false)
  const [play, setPlay] = useState<{ title: string; list: ExerciseItem[] } | null>(null)
  const [pick, setPick] = useState<Set<string>>(new Set())
  const [workoutName, setWorkoutName] = useState('')
  const [lowImpact, setLowImpact] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const published = useMemo(() => api.items.filter((i) => i.status === 'published'), [api.items])
  const shown = useMemo(
    () => filterExercises(published, { query, category: category || null, goal: goal || null, level: level || null, favoritesOnly: favOnly }, api.favorites),
    [published, query, category, goal, level, favOnly, api.favorites],
  )
  const open = openId ? api.byId.get(openId) ?? null : null
  const doneToday = new Set(api.logs.filter((l) => l.done_on === new Date().toISOString().slice(0, 10)).map((l) => l.item_id))

  if (play) {
    return (
      <ExercisePlayer
        title={play.title}
        exercises={play.list}
        onFinish={(s: RunSummary) => {
          void api.finishRun({ name: play.title, total: s.total, done: s.done, seconds: s.seconds })
          for (const id of s.doneIds) void api.logDone(id)
        }}
        onExit={() => setPlay(null)}
      />
    )
  }

  if (open) return <Detail e={open} api={api} onBack={() => setOpenId(null)} />

  const quick = (m: number) => {
    const list = buildQuickWorkout(published, m, { lowImpactOnly: lowImpact })
    if (list.length === 0) return setMessage('Ainda não há exercícios suficientes publicados para este treino.')
    setMessage(null)
    setPlay({ title: `Treino rápido de ${m} minutos`, list })
  }

  function togglePick(id: string) {
    setPick((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function saveCustom() {
    if (!workoutName.trim() || pick.size === 0) return setMessage('Dê um nome e escolha ao menos um exercício.')
    const r = await api.saveWorkout(workoutName.trim(), [...pick])
    if (r.error) return setMessage(r.error)
    setWorkoutName('')
    setPick(new Set())
    setMessage('Treino salvo.')
  }

  const weekFor = (d: number) => api.week.find((w) => w.weekday === d)
  const today = new Date().getDay()

  function startWeekDay(d: number) {
    const entry = weekFor(d)
    if (!entry) return
    if (entry.quick_minutes) return quick(entry.quick_minutes)
    const w = api.workouts.find((x) => x.id === entry.workout_id)
    if (!w) return
    const list = w.item_ids.map((id) => api.byId.get(id)).filter((x): x is ExerciseItem => !!x && x.status === 'published')
    if (list.length) setPlay({ title: w.name, list })
  }

  return (
    <section className="ex-lib">
      <button type="button" className="water-link" onClick={onBack}>
        ‹ Exercícios
      </button>
      <h2>Se exercite em casa</h2>
      <p className="water-note">{GENERAL_SAFETY}</p>
      <div className="pn-tabs" role="tablist" aria-label="Áreas">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-on' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {message && <p className="auth-error" role="status">{message}</p>}
      {api.loading && <p className="home-muted">Carregando…</p>}

      {tab === 'biblioteca' && (
        <>
          <div className="ex-filters">
            <input type="search" placeholder="Buscar exercício" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar exercício" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Região ou categoria">
              <option value="">Todas as categorias</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} aria-label="Objetivo">
              <option value="">Todos os objetivos</option>
              {GOALS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Nível">
              <option value="">Todos os níveis</option>
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <label className="ex-check">
              <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} /> Só favoritos
            </label>
          </div>
          {!api.loading && published.length === 0 && <p className="home-muted">Os exercícios ainda estão sendo revisados pela nutricionista. Em breve, por aqui.</p>}
          <div className="ex-grid">
            {shown.map((e) => (
              <button key={e.id} type="button" className="ex-tile" onClick={() => setOpenId(e.id)}>
                <ExerciseFigure pose={e.pose_end} label={e.name} />
                <span className="ex-tile-name">
                  {api.favorites.has(e.id) ? '♥ ' : ''}
                  {e.name}
                  {doneToday.has(e.id) ? ' ✓' : ''}
                </span>
                <span className="home-muted">{e.level} · {e.categories.slice(0, 2).join(', ')}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'treinos' && (
        <>
          <h3>Treinos rápidos</h3>
          <label className="ex-check">
            <input type="checkbox" checked={lowImpact} onChange={(e) => setLowImpact(e.target.checked)} /> Só exercícios de baixo impacto
          </label>
          <div className="ex-quick">
            {QUICK_MINUTES.map((m) => (
              <button key={m} type="button" className="ex-big" onClick={() => quick(m)}>
                {m} min
              </button>
            ))}
          </div>

          <h3>Monte o seu treino</h3>
          <div className="ex-pick">
            {published.map((e) => (
              <label key={e.id} className="ex-check">
                <input type="checkbox" checked={pick.has(e.id)} onChange={() => togglePick(e.id)} /> {e.name}
              </label>
            ))}
          </div>
          <div className="pn-form">
            <input placeholder="Nome do treino" value={workoutName} maxLength={80} onChange={(e) => setWorkoutName(e.target.value)} aria-label="Nome do treino" />
            <button type="button" className="water-primary" onClick={() => void saveCustom()}>
              Salvar treino ({pick.size})
            </button>
          </div>

          <h3>Meus treinos</h3>
          {api.workouts.length === 0 ? (
            <p className="home-muted">Você ainda não montou nenhum treino.</p>
          ) : (
            <ul className="pn-list">
              {api.workouts.map((w) => {
                const list = w.item_ids.map((id) => api.byId.get(id)).filter((x): x is ExerciseItem => !!x && x.status === 'published')
                const sec = list.reduce((s, e) => s + exerciseSeconds(e), 0)
                return (
                  <li key={w.id}>
                    <strong>{w.name}</strong> <span className="home-muted">{list.length} exercícios · ~{Math.max(1, Math.round(sec / 60))} min</span>
                    <div className="pn-actions">
                      <button type="button" onClick={() => list.length && setPlay({ title: w.name, list })}>
                        Iniciar
                      </button>
                      <button type="button" onClick={() => window.confirm('Apagar este treino?') && void api.deleteWorkout(w.id)}>
                        Apagar
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {tab === 'semana' && (
        <>
          <p className="home-muted">Escolha um treino para cada dia e acompanhe a semana. Dias de descanso também contam.</p>
          <ul className="pn-list">
            {WEEKDAYS.map((name, d) => {
              const entry = weekFor(d)
              const value = entry?.quick_minutes ? `q${entry.quick_minutes}` : (entry?.workout_id ?? '')
              return (
                <li key={d} className={d === today ? 'ex-today' : ''}>
                  <strong>{name}{d === today ? ' (hoje)' : ''}</strong>
                  <select
                    value={value}
                    aria-label={`Treino de ${name}`}
                    onChange={(e) => {
                      const v = e.target.value
                      if (!v) void api.setWeekDay(d, null)
                      else if (v.startsWith('q')) void api.setWeekDay(d, { workout_id: null, quick_minutes: Number(v.slice(1)) })
                      else void api.setWeekDay(d, { workout_id: v, quick_minutes: null })
                    }}
                  >
                    <option value="">Descanso</option>
                    {QUICK_MINUTES.map((m) => (
                      <option key={m} value={`q${m}`}>
                        Treino rápido de {m} min
                      </option>
                    ))}
                    {api.workouts.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  {entry && (
                    <button type="button" className="own-menu-btn" onClick={() => startWeekDay(d)}>
                      Iniciar
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {tab === 'historico' && (
        <>
          <h3>Treinos feitos</h3>
          {api.runs.length === 0 ? (
            <p className="home-muted">Nenhum treino finalizado ainda.</p>
          ) : (
            <ul className="pn-list">
              {api.runs.map((r) => (
                <li key={r.id}>
                  <strong>{r.name}</strong>{' '}
                  <span className="home-muted">
                    {new Date(r.finished_at).toLocaleDateString('pt-BR')} · {formatClock(r.duration_sec)} · {r.done_items}/{r.total_items} exercícios
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h3>Exercícios marcados como feitos</h3>
          {api.logs.length === 0 ? (
            <p className="home-muted">Nada por aqui ainda.</p>
          ) : (
            <ul className="pn-list">
              {api.logs.slice(0, 40).map((l) => (
                <li key={l.id}>
                  {api.byId.get(l.item_id)?.name ?? 'Exercício'} <span className="home-muted">{new Date(l.done_on + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
