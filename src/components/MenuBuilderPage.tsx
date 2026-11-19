import { useMemo, useState } from 'react'
import { useMenuLibrary } from '../hooks/useMenuLibrary'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import {
  COURSES,
  CUISINES,
  DIETS,
  DIFFICULTIES,
  EMPTY_ANSWERS,
  OCCASIONS,
  TIME_OPTIONS,
  buildMenu,
  courseLabel,
  difficultyLabel,
  shoppingForMenu,
  totalMinutes,
} from '../lib/menuBuilder'
import type { Course, CuisineKey, DietKey, MenuAnswers, MenuPick } from '../lib/menuBuilder'
import { shoppingPdfHtml } from '../lib/menuPrint'
import { printDocument } from '../lib/nutriPrint'
import { formatQty } from '../lib/shopping'
import type { DraftItem } from '../lib/shopping'
import { isList, recipeItems } from '../lib/recipeText'

// CRIE SEU CARDÁPIO: fluxo em etapas (encontro, o que servir, estilo,
// restrições, personalização) e o cardápio pronto, tudo dentro do Círcula.
// As receitas vêm da biblioteca existente; nada é inventado pelo app.

const STEPS = ['Sobre o encontro', 'O que servir', 'Estilo', 'Restrições', 'Personalize'] as const

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

function line(d: DraftItem): string {
  if (d.notes === 'a gosto' || d.notes === 'quantidade não informada') return `${d.name} (${d.notes})`
  return `${formatQty(d.quantity, d.unit)} · ${d.name}${d.notes ? ` (${d.notes})` : ''}`
}

function PickCard({ pick, guests }: { pick: MenuPick; guests: number }) {
  const { url } = useSignedImageUrl(pick.recipe.cover_image_url)
  const r = pick.recipe
  const steps = recipeItems(r.body, { steps: true })
  const meta = [
    r.meta.prep_minutes ? `${r.meta.prep_minutes} min` : null,
    r.meta.difficulty ? difficultyLabel(r.meta.difficulty) : null,
    r.meta.servings ? `rende ${r.meta.servings}` : null,
  ].filter(Boolean)

  return (
    <article className="menu-pick">
      {url && <img className="menu-pick-photo" src={url} alt={r.title} loading="lazy" decoding="async" />}
      <div className="menu-pick-body">
        <h4>{r.title}</h4>
        {meta.length > 0 && <p className="menu-pick-meta">{meta.join(' · ')}</p>}
        {r.summary && <p className="menu-pick-summary">{r.summary}</p>}
        {pick.notes.map((n) => (
          <p key={n} className="menu-pick-note">
            {n}
          </p>
        ))}
        <details className="menu-pick-details" open>
          <summary>
            Ingredientes para {guests} {guests === 1 ? 'pessoa' : 'pessoas'}
          </summary>
          {pick.scaled.length > 0 ? (
            <ul>
              {pick.scaled.map((d, i) => (
                <li key={`${d.name}-${i}`}>{line(d)}</li>
              ))}
            </ul>
          ) : (
            <p className="home-muted">Esta receita ainda não tem a lista de ingredientes.</p>
          )}
        </details>
        <details className="menu-pick-details" open>
          <summary>Modo de preparo</summary>
          {steps.length === 0 ? (
            <p className="home-muted">O modo de preparo ainda não foi cadastrado.</p>
          ) : isList(steps) ? (
            <ol>
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          ) : (
            <p>{steps[0]}</p>
          )}
        </details>
      </div>
    </article>
  )
}

export function MenuBuilderPage({ communityId, onBack }: { communityId: string | null; onBack?: () => void }) {
  const { recipes, loading, error } = useMenuLibrary(communityId)
  const [answers, setAnswers] = useState<MenuAnswers>(EMPTY_ANSWERS)
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [variant, setVariant] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [printError, setPrintError] = useState<string | null>(null)

  const patch = (p: Partial<MenuAnswers>) => setAnswers((a) => ({ ...a, ...p }))

  const result = useMemo(() => (done ? buildMenu(answers, recipes, variant) : null), [done, answers, recipes, variant])

  function next() {
    setFormError(null)
    if (step === 0 && (!Number.isInteger(answers.guests) || answers.guests < 1)) {
      setFormError('Informe quantas pessoas estarão presentes.')
      return
    }
    if (step === 1 && answers.courses.length === 0) {
      setFormError('Escolha pelo menos uma etapa do cardápio.')
      return
    }
    if (step < STEPS.length - 1) setStep(step + 1)
    else {
      setVariant(0)
      setDone(true)
    }
  }

  function back() {
    setFormError(null)
    if (done) setDone(false)
    else if (step > 0) setStep(step - 1)
    else onBack?.()
  }

  function savePdf() {
    if (!result) return
    setPrintError(null)
    const ok = printDocument(shoppingPdfHtml(answers, result, shoppingForMenu(result)))
    if (!ok) setPrintError('O navegador bloqueou a janela do PDF. Permita pop-ups e tente de novo.')
  }

  const intro = (
    <header className="menu-head">
      <p className="menu-eyebrow">Crie seu Cardápio</p>
      <h2>Vamos preparar algo especial?</h2>
      <p>
        Conte um pouco sobre o seu encontro. Nós vamos ajudar você a montar um cardápio completo, com receitas
        selecionadas e tudo organizado para receber bem.
      </p>
    </header>
  )

  if (loading) return <section className="menu-page"><p className="home-muted">Carregando…</p></section>
  if (error) return <section className="menu-page"><p className="auth-error">{error}</p></section>

  // ------------------------------------------------------------ resultado
  if (done && result) {
    const mins = totalMinutes(result)
    const when = [
      answers.date ? new Date(`${answers.date}T12:00:00`).toLocaleDateString('pt-BR') : null,
      answers.time || null,
    ].filter(Boolean)
    return (
      <section className="menu-page">
        <button type="button" className="back-button" onClick={back}>
          ← Ajustar respostas
        </button>
        <header className="menu-head menu-head--result">
          {result.sections.length > 0 ? (
            <>
              <h2>Seu cardápio está pronto!</h2>
              <p>Preparamos uma combinação especial para o seu encontro.</p>
            </>
          ) : (
            <>
              <h2>Ainda não deu para montar</h2>
              <p>Não encontramos receitas suficientes para as suas escolhas. Veja abaixo o que falta e o que você pode ajustar.</p>
            </>
          )}
          <div className="menu-summary">
            <strong>{answers.name.trim() || answers.occasion || 'Seu encontro'}</strong>
            <span>
              {answers.guests} {answers.guests === 1 ? 'pessoa' : 'pessoas'}
              {when.length > 0 ? ` · ${when.join(' às ')}` : ''}
              {answers.occasion && answers.name.trim() ? ` · ${answers.occasion}` : ''}
            </span>
            {mins > 0 && <span>Preparo somado das receitas: cerca de {mins >= 60 ? `${Math.floor(mins / 60)} h ` : ''}{mins % 60 ? `${mins % 60} min` : ''}</span>}
          </div>
        </header>

        {result.warnings.map((w) => (
          <p key={w} className="menu-warning" role="note">
            {w}
          </p>
        ))}

        {result.sections.map((s) => (
          <section key={s.course} className="menu-block">
            <h3>{courseLabel(s.course)}</h3>
            {s.picks.map((p) => (
              <PickCard key={p.recipe.id} pick={p} guests={answers.guests} />
            ))}
          </section>
        ))}

        {result.gaps.length > 0 && (
          <section className="menu-block menu-gaps">
            <h3>Não encontramos tudo</h3>
            {result.gaps.map((g) => (
              <div key={g.course} className="menu-gap">
                <strong>{courseLabel(g.course)}</strong>
                <p>{g.reason}</p>
                <p className="home-muted">{g.suggestion}</p>
              </div>
            ))}
          </section>
        )}

        {result.sections.length === 0 && (
          <p className="home-muted">
            Ainda não há receitas suficientes para montar este cardápio. Volte, ajuste as respostas ou tente de novo mais tarde.
          </p>
        )}

        <div className="menu-actions">
          {result.sections.length > 0 && (
            <>
              <button type="button" className="btn btn-primary menu-pdf" onClick={savePdf}>
                Salve sua lista de compras
              </button>
              <p className="home-muted">
                Abre a lista em PDF. Escolha "Salvar como PDF" para baixar no celular e depois compartilhe pelo WhatsApp.
              </p>
              {printError && <p className="auth-error">{printError}</p>}
              <button type="button" className="auth-link" onClick={() => setVariant((v) => v + 1)}>
                Ver outra sugestão
              </button>
            </>
          )}
        </div>
      </section>
    )
  }

  // ---------------------------------------------------------------- etapas
  return (
    <section className="menu-page">
      {step === 0 && intro}

      <div className="menu-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Progresso">
        <span>
          Etapa {step + 1} de {STEPS.length} · {STEPS[step]}
        </span>
        <div className="menu-progress-bar">
          <i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <div className="menu-step">
        {step === 0 && (
          <>
            <label>
              Nome do encontro (opcional)
              <input type="text" value={answers.name} maxLength={80} placeholder="Ex.: Jantar de sábado" onChange={(e) => patch({ name: e.target.value })} />
            </label>
            <label>
              Quantidade de pessoas
              <input
                type="number"
                min={1}
                max={200}
                inputMode="numeric"
                value={Number.isFinite(answers.guests) ? answers.guests : ''}
                onChange={(e) => patch({ guests: e.target.value === '' ? NaN : Number(e.target.value) })}
                required
              />
            </label>
            <div className="menu-two">
              <label>
                Data do encontro (opcional)
                <input type="date" value={answers.date} onChange={(e) => patch({ date: e.target.value })} />
              </label>
              <label>
                Horário aproximado (opcional)
                <input type="time" value={answers.time} onChange={(e) => patch({ time: e.target.value })} />
              </label>
            </div>
            <fieldset className="menu-chips">
              <legend>Qual é a ocasião?</legend>
              {OCCASIONS.map((o) => (
                <button key={o} type="button" className={`menu-chip${answers.occasion === o ? ' menu-chip--on' : ''}`} aria-pressed={answers.occasion === o} onClick={() => patch({ occasion: answers.occasion === o ? '' : o })}>
                  {o}
                </button>
              ))}
            </fieldset>
          </>
        )}

        {step === 1 && (
          <fieldset className="menu-cards">
            <legend>O que você deseja servir?</legend>
            <p className="home-muted">Escolha livremente. Você não precisa selecionar todas as etapas.</p>
            {COURSES.map((c) => {
              const on = answers.courses.includes(c.key)
              return (
                <button key={c.key} type="button" className={`menu-card${on ? ' menu-card--on' : ''}`} aria-pressed={on} onClick={() => patch({ courses: toggle<Course>(answers.courses, c.key) })}>
                  <strong>{c.label}</strong>
                  <span>{c.hint}</span>
                </button>
              )
            })}
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className="menu-chips">
            <legend>Qual estilo de comida você prefere?</legend>
            <p className="home-muted">Pode escolher mais de um. Sem preferência, o Círcula combina o que houver de melhor.</p>
            {CUISINES.map((c) => (
              <button key={c.key} type="button" className={`menu-chip${answers.cuisines.includes(c.key) ? ' menu-chip--on' : ''}`} aria-pressed={answers.cuisines.includes(c.key)} onClick={() => patch({ cuisines: toggle<CuisineKey>(answers.cuisines, c.key) })}>
                {c.label}
              </button>
            ))}
            <button type="button" className={`menu-chip${answers.cuisines.length === 0 ? ' menu-chip--on' : ''}`} aria-pressed={answers.cuisines.length === 0} onClick={() => patch({ cuisines: [] })}>
              Sem preferência
            </button>
          </fieldset>
        )}

        {step === 3 && (
          <>
            <fieldset className="menu-chips">
              <legend>Restrições e preferências alimentares</legend>
              {DIETS.map((d) => (
                <button key={d.key} type="button" className={`menu-chip${answers.diets.includes(d.key) ? ' menu-chip--on' : ''}`} aria-pressed={answers.diets.includes(d.key)} onClick={() => patch({ diets: toggle<DietKey>(answers.diets, d.key) })}>
                  {d.label}
                </button>
              ))}
            </fieldset>
            <label>
              Existe algum ingrediente que você prefere não utilizar?
              <input type="text" value={answers.avoid} placeholder="Ex.: cebola, alho, pimentão" onChange={(e) => patch({ avoid: e.target.value })} />
            </label>
            <label>
              Alergias alimentares
              <input type="text" value={answers.allergies} placeholder="Ex.: amendoim, camarão" onChange={(e) => patch({ allergies: e.target.value })} />
            </label>
            <p className="menu-warning" role="note">
              Alergias são tratadas como restrição obrigatória: só entram receitas com ficha verificada pela nutricionista.
              Mesmo assim, confira rótulos e o risco de contaminação cruzada antes de servir. Esta ferramenta não certifica
              ausência de alergênicos.
            </p>
          </>
        )}

        {step === 4 && (
          <>
            <p className="home-muted">Tudo opcional. Usamos essas informações quando as receitas têm os dados.</p>
            <fieldset className="menu-chips">
              <legend>Tempo disponível para cozinhar</legend>
              {TIME_OPTIONS.map((t) => (
                <button key={t.key} type="button" className={`menu-chip${answers.timeLimit === t.key ? ' menu-chip--on' : ''}`} aria-pressed={answers.timeLimit === t.key} onClick={() => patch({ timeLimit: t.key })}>
                  {t.label}
                </button>
              ))}
            </fieldset>
            <fieldset className="menu-chips">
              <legend>Nível de dificuldade</legend>
              {DIFFICULTIES.map((d) => (
                <button key={d.key} type="button" className={`menu-chip${answers.maxDifficulty === d.key ? ' menu-chip--on' : ''}`} aria-pressed={answers.maxDifficulty === d.key} onClick={() => patch({ maxDifficulty: answers.maxDifficulty === d.key ? null : d.key })}>
                  {d.label}
                </button>
              ))}
            </fieldset>
            <label>
              Orçamento aproximado (R$)
              <input
                type="number"
                min={0}
                inputMode="decimal"
                disabled={answers.noBudgetLimit}
                value={answers.budgetReais ?? ''}
                onChange={(e) => patch({ budgetReais: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </label>
            <label className="menu-check">
              <input type="checkbox" checked={answers.noBudgetLimit} onChange={(e) => patch({ noBudgetLimit: e.target.checked })} />
              Sem limite de orçamento
            </label>
          </>
        )}
      </div>

      {formError && <p className="auth-error" role="alert">{formError}</p>}

      <div className="menu-nav">
        {step > 0 && (
          <button type="button" className="auth-link" onClick={back}>
            Voltar
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={next}>
          {step === STEPS.length - 1 ? 'Montar meu cardápio' : 'Continuar'}
        </button>
      </div>
    </section>
  )
}
