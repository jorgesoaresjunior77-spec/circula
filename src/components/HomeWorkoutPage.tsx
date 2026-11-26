import { useMemo, useState } from 'react'
import { ExerciseIllustration } from './ExerciseIllustration'
import { ExercisePlayer } from './ExercisePlayer'
import type { RunSummary } from './ExercisePlayer'
import { EXERCISES, EXERCISE_BY_SLUG, useHomeWorkouts } from '../hooks/useHomeWorkouts'
import type { WorkoutExercise } from '../hooks/useHomeWorkouts'
import { GENERAL_SAFETY, GOALS, MATERIALS, MATERIAL_LABEL, WORKOUT_MINUTES, buildWorkout, exerciseSeconds, formatClock, formatMinutes } from '../lib/exerciseCatalog'
import { PRODUCTS, formatBrl } from '../lib/plansCatalog'

// Se exercite em casa: você escolhe o tempo, as regiões do corpo, o objetivo, o
// nível e o que tem em casa; o app monta o treino do momento (e dá para salvar).
// Os exercícios e os desenhos vêm do próprio app.

const MAIN_CATEGORIES = ['Corpo inteiro', 'Pernas', 'Glúteos', 'Abdômen', 'Braços', 'Peito', 'Costas', 'Equilíbrio', 'Condicionamento físico'] as const

type View = 'form' | 'plan' | 'detail' | 'play'

// Ícones das opções (todas as opções que já existiam continuam; aqui só ganham um desenho).
const CATEGORY_ICON: Record<string, string> = {
  'Corpo inteiro': '🤸‍♀️',
  Pernas: '🦵',
  Glúteos: '🍑',
  Abdômen: '🎯',
  Braços: '💪',
  Peito: '🫁',
  Costas: '🧗‍♀️',
  Equilíbrio: '🦩',
  'Condicionamento físico': '⚡',
}
const GOAL_ICON: Record<string, string> = {
  Fortalecer: '🏋️‍♀️',
  Mobilidade: '🔄',
  Equilíbrio: '🦩',
  Alongar: '🧘‍♀️',
  Condicionamento: '❤️‍🔥',
  Postura: '🧍‍♀️',
}
const MATERIAL_ICON: Record<string, string> = {
  parede: '🧱',
  cadeira: '🪑',
  degrau: '🪜',
  garrafas: '💧',
  bola: '⚽',
  elastico: '🎗️',
  toalha: '🛁',
  cabo: '🧹',
}

/** Card de opção: o mesmo desenho em todas as etapas (tempo, região, objetivo, nível e o que tem em casa). */
function OptionCard({ on, onClick, icon, title, hint, multi = false }: { on: boolean; onClick: () => void; icon: React.ReactNode; title: string; hint?: string; multi?: boolean }) {
  return (
    <button type="button" className={`hw-opt${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onClick} data-multi={multi ? 'true' : undefined}>
      <span className="hw-opt-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="hw-opt-title">{title}</span>
      {hint && <span className="hw-opt-hint">{hint}</span>}
      <span className="hw-opt-check" aria-hidden="true">
        ✓
      </span>
    </button>
  )
}

function ClockGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

function sets(e: { mode: 'reps' | 'time'; target: number; sets: number }): string {
  return `${e.sets} × ${e.mode === 'time' ? `${e.target} s` : `${e.target} repetições`}`
}

function ExerciseCard({ e, onOpen, onRemove }: { e: WorkoutExercise; onOpen: () => void; onRemove?: () => void }) {
  return (
    <li className="hw-card card-lift">
      <button type="button" className="hw-card-main" onClick={onOpen}>
        <span className="hw-card-thumb">
          <ExerciseIllustration slug={e.slug} name={e.name} view="end" />
        </span>
        <span className="hw-card-body">
          <strong>{e.name}</strong>
          <span className="hw-card-meta">
            {sets(e)} · descanso {e.rest_sec}s
          </span>
          <span className="hw-card-tags">
            <em>{e.level}</em>
            {(e.props ?? []).map((p) => (
              <em key={p} className="hw-prop">
                {MATERIAL_LABEL[p] ?? p}
              </em>
            ))}
          </span>
        </span>
      </button>
      {onRemove && (
        <button type="button" className="hw-card-x" onClick={onRemove} aria-label={`Tirar ${e.name} do treino`}>
          ×
        </button>
      )}
    </li>
  )
}

function Detail({ e, onBack }: { e: WorkoutExercise; onBack: () => void }) {
  return (
    <article className="hw-detail card-lift">
      <button type="button" className="water-link" onClick={onBack}>
        ‹ Voltar
      </button>
      <h3>{e.name}</h3>
      <p className="home-muted">
        {e.level} · {sets(e)} · descanso {e.rest_sec} s
      </p>
      <ExerciseIllustration slug={e.slug} name={e.name} />
      {e.description && <p>{e.description}</p>}
      {(e.props ?? []).length > 0 && (
        <p>
          <strong>Você vai precisar de:</strong> {(e.props ?? []).map((p) => MATERIAL_LABEL[p] ?? p).join(', ')}
        </p>
      )}
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
    </article>
  )
}

export function HomeWorkoutPage({ profileId, canUse, onOpenPlans }: { profileId: string; canUse: boolean; onOpenPlans: () => void }) {
  const hw = useHomeWorkouts(profileId)
  const [view, setView] = useState<View>('form')
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [minutes, setMinutes] = useState<number>(20)
  const [categories, setCategories] = useState<string[]>([])
  const [goals, setGoals] = useState<string[]>([])
  const [level, setLevel] = useState<'Iniciante' | 'Intermediário'>('Iniciante')
  const [lowImpact, setLowImpact] = useState(false)
  const [materials, setMaterials] = useState<string[]>([])
  const [seed, setSeed] = useState(1)
  const [plan, setPlan] = useState<WorkoutExercise[]>([])
  const [saveName, setSaveName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [planTitle, setPlanTitle] = useState('Treino de hoje')

  const price = PRODUCTS.find((p) => p.key === 'exercicios')?.monthlyCents ?? 590
  const total = useMemo(() => plan.reduce((t, e) => t + exerciseSeconds(e) + 15, 0), [plan])
  const open = openSlug ? (EXERCISE_BY_SLUG.get(openSlug) ?? null) : null

  function build(nextSeed: number) {
    const res = buildWorkout(EXERCISES, { minutes, categories, goals, level, lowImpactOnly: lowImpact, materials, seed: nextSeed })
    setSeed(nextSeed)
    if (res.items.length === 0) {
      setMessage('Não achei exercícios com essas escolhas. Tire algum filtro ou marque mais coisas que você tem em casa.')
      return
    }
    setMessage(null)
    setPlanTitle('Treino de hoje')
    setPlan(res.items)
    setSaveName('')
    setView('plan')
  }

  if (!canUse) {
    return (
      <section className="hw-page">
        <header className="hw-hero card-lift">
          <h2>Se exercite em casa</h2>
          <p>Treinos montados para você, no seu tempo, só com o peso do corpo e coisas que você já tem em casa.</p>
        </header>
        <article className="hw-panel card-lift">
          <h3>Conheça antes de assinar</h3>
          <ul className="ex-offer-list">
            <li>{EXERCISES.length} exercícios com desenho da posição inicial e da execução</li>
            <li>Você escolhe o tempo (de 10 a 60 minutos), as regiões do corpo, o objetivo e o nível</li>
            <li>O treino é montado na hora, e você pode salvar os que mais gostar</li>
            <li>Usa só o peso do corpo e coisas simples: parede, cadeira, degrau, garrafas de água, bola, faixa elástica, toalha e cabo de vassoura</li>
          </ul>
          <div className="hw-samples">
            {EXERCISES.slice(0, 3).map((e) => (
              <ExerciseIllustration key={e.slug} slug={e.slug} name={e.name} view="end" />
            ))}
          </div>
          <p className="home-muted">Acesso completo por {formatBrl(price)} por mês, liberado depois que o pagamento é confirmado.</p>
          <button type="button" className="water-primary water-primary--big" onClick={onOpenPlans}>
            Assinar por {formatBrl(price)}/mês
          </button>
          <p className="water-note">{GENERAL_SAFETY}</p>
        </article>
      </section>
    )
  }

  if (view === 'play') {
    return (
      <ExercisePlayer
        title={planTitle}
        exercises={plan}
        onFinish={(s: RunSummary) => void hw.finishRun({ name: planTitle, total: s.total, done: s.done, seconds: s.seconds })}
        onExit={() => setView('plan')}
      />
    )
  }

  if (view === 'detail' && open) return <Detail e={open} onBack={() => setView(plan.length ? 'plan' : 'form')} />

  if (view === 'plan') {
    return (
      <section className="hw-page">
        <button type="button" className="water-link" onClick={() => setView('form')}>
          ‹ Mudar escolhas
        </button>
        <header className="hw-hero card-lift">
          <h2>{planTitle === 'Treino de hoje' ? 'Seu treino de hoje' : planTitle}</h2>
          <p className="hw-summary">
            <strong>{formatMinutes(total)}</strong> · {plan.length} exercícios
          </p>
          <div className="hw-actions">
            <button
              type="button"
              className="ex-big"
              onClick={() => setView('play')}
            >
              Iniciar treino
            </button>
            <button type="button" className="hw-ghost" onClick={() => build(seed + 1)}>
              Montar outro
            </button>
          </div>
        </header>

        <ul className="hw-list">
          {plan.map((e, i) => (
            <ExerciseCard
              key={`${e.id}-${i}`}
              e={e}
              onOpen={() => {
                setOpenSlug(e.slug)
                setView('detail')
              }}
              onRemove={plan.length > 1 ? () => setPlan((p) => p.filter((_, j) => j !== i)) : undefined}
            />
          ))}
        </ul>

        <article className="hw-panel card-lift">
          <h3>Salvar este treino</h3>
          <div className="hw-save">
            <input value={saveName} maxLength={80} onChange={(e) => setSaveName(e.target.value)} placeholder="Nome do treino (ex.: Pernas e glúteos)" aria-label="Nome do treino" />
            <button
              type="button"
              className="water-primary"
              onClick={async () => {
                if (!saveName.trim()) return setMessage('Dê um nome ao treino para salvar.')
                const r = await hw.saveWorkout(saveName, plan.map((e) => e.slug), Math.max(1, Math.round(total / 60)))
                setMessage(r.error ?? 'Treino salvo em “Meus treinos”.')
                if (!r.error) setSaveName('')
              }}
            >
              Salvar
            </button>
          </div>
          {message && <p className="home-muted" role="status">{message}</p>}
        </article>
        <p className="water-note">{GENERAL_SAFETY}</p>
      </section>
    )
  }

  return (
    <section className="hw-page">
      <header className="hw-hero card-lift">
        <h2>Se exercite em casa</h2>
        <p>Escolha como quer treinar hoje e o app monta o treino para você.</p>
      </header>

      <article className="hw-panel card-lift">
        <h3>Quanto tempo você tem?</h3>
        <div className="hw-opts hw-opts--time" role="group" aria-label="Duração do treino">
          {WORKOUT_MINUTES.map((m) => (
            <OptionCard key={m} on={minutes === m} onClick={() => setMinutes(m)} icon={<ClockGlyph />} title={`${m} min`} />
          ))}
        </div>

        <h3>O que quer trabalhar?</h3>
        <p className="home-muted">Marque uma ou mais regiões (ou nenhuma, para um treino variado).</p>
        <div className="hw-opts" role="group" aria-label="Partes do corpo">
          {MAIN_CATEGORIES.map((c) => (
            <OptionCard key={c} multi on={categories.includes(c)} onClick={() => setCategories((l) => toggle(l, c))} icon={CATEGORY_ICON[c] ?? '•'} title={c} />
          ))}
        </div>

        <h3>Objetivo</h3>
        <div className="hw-opts" role="group" aria-label="Objetivo">
          {GOALS.map((g) => (
            <OptionCard key={g} multi on={goals.includes(g)} onClick={() => setGoals((l) => toggle(l, g))} icon={GOAL_ICON[g] ?? '•'} title={g} />
          ))}
        </div>

        <h3>Nível</h3>
        <div className="hw-opts" role="group" aria-label="Nível">
          <OptionCard on={level === 'Iniciante'} onClick={() => setLevel('Iniciante')} icon="🌱" title="Iniciante" />
          <OptionCard on={level === 'Intermediário'} onClick={() => setLevel('Intermediário')} icon="🌿" title="Intermediário" />
          <OptionCard multi on={lowImpact} onClick={() => setLowImpact((v) => !v)} icon="🪶" title="Só baixo impacto" />
        </div>

        <h3>O que você tem em casa?</h3>
        <p className="home-muted">Marque tudo o que tiver. Sem equipamentos, o treino usa só o peso do corpo.</p>
        <div className="hw-opts" role="group" aria-label="Equipamentos disponíveis">
          <OptionCard on={materials.length === 0} onClick={() => setMaterials([])} icon="🙌" title="Sem equipamentos" />
          {MATERIALS.map((m) => (
            <OptionCard key={m.key} multi on={materials.includes(m.key)} onClick={() => setMaterials((l) => toggle(l, m.key))} icon={MATERIAL_ICON[m.key] ?? '•'} title={m.label} />
          ))}
        </div>

        {message && (
          <p className="auth-error" role="alert">
            {message}
          </p>
        )}
        <button type="button" className="ex-cta" onClick={() => build(Date.now() % 100000)}>
          MONTAR MEU TREINO
        </button>
      </article>

      {hw.saved.length > 0 && (
        <article className="hw-panel card-lift">
          <h3>Meus treinos</h3>
          <ul className="hw-saved">
            {hw.saved.map((w) => {
              const list = w.item_slugs.map((s) => EXERCISE_BY_SLUG.get(s)).filter((x): x is WorkoutExercise => !!x)
              return (
                <li key={w.id}>
                  <div>
                    <strong>{w.name}</strong> <span className="home-muted">{list.length} exercícios{w.minutes ? ` · ~${w.minutes} min` : ''}</span>
                  </div>
                  <div className="hw-actions">
                    <button
                      type="button"
                      className="hw-ghost"
                      onClick={() => {
                        if (list.length === 0) return
                        setPlan(list)
                        setPlanTitle(w.name)
                        setView('plan')
                      }}
                    >
                      Abrir
                    </button>
                    <button type="button" className="hw-ghost" onClick={() => window.confirm('Apagar este treino?') && void hw.deleteWorkout(w.id)}>
                      Apagar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </article>
      )}

      {hw.runs.length > 0 && (
        <article className="hw-panel card-lift">
          <h3>Treinos feitos</h3>
          <ul className="hw-saved">
            {hw.runs.slice(0, 8).map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <span className="home-muted">
                    {' '}
                    {new Date(r.finished_at).toLocaleDateString('pt-BR')} · {formatClock(r.duration_sec)} · {r.done_items}/{r.total_items} exercícios
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </article>
      )}
      <p className="water-note">{GENERAL_SAFETY}</p>
    </section>
  )
}
