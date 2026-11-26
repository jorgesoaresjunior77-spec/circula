import { useEffect, useMemo, useRef, useState } from 'react'
import { ExerciseIllustration } from './ExerciseIllustration'
import { formatClock } from '../lib/exerciseCatalog'
import { beep, closeBeep, unlockBeep } from '../lib/beep'
import type { WorkoutExercise } from '../hooks/useHomeWorkouts'

// Treino guiado: exercício por exercício, série por série, com descanso entre
// elas. Iniciar, pausar, continuar, pular e finalizar a qualquer momento; no
// fim, um resumo. Exercícios por repetição pedem um toque em "Fiz"; os por
// tempo têm cronômetro regressivo.

export interface RunSummary {
  seconds: number
  total: number
  done: number
  doneIds: string[]
}

type Phase = 'ready' | 'work' | 'rest' | 'end'

const SOUND_KEY = 'circula:treino-som'

export function ExercisePlayer({
  title,
  exercises,
  onFinish,
  onExit,
}: {
  title: string
  exercises: WorkoutExercise[]
  onFinish: (s: RunSummary) => void
  onExit: () => void
}) {
  const [idx, setIdx] = useState(0)
  const [setNo, setSetNo] = useState(1)
  const [phase, setPhase] = useState<Phase>('ready')
  const [remaining, setRemaining] = useState(0)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [doneIds, setDoneIds] = useState<string[]>([])
  const [skipped, setSkipped] = useState(0)
  const [endedEarly, setEndedEarly] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off'
    } catch {
      return true
    }
  })
  const finished = useRef(false)
  /** Último fim de tempo que já bipou (exercício-série-fase): nunca bipa duas vezes o mesmo. */
  const lastBeep = useRef('')

  const ex = exercises[idx]
  const running = phase === 'work' || phase === 'rest'

  // Saiu da tela (ou o treino acabou): o áudio é fechado, nada continua tocando em segundo plano.
  useEffect(() => () => closeBeep(), [])
  useEffect(() => {
    if (phase === 'end') closeBeep()
  }, [phase])

  function toggleSound() {
    setSoundOn((on) => {
      const next = !on
      try {
        localStorage.setItem(SOUND_KEY, next ? 'on' : 'off')
      } catch {
        /* só nesta sessão */
      }
      if (next) unlockBeep()
      return next
    })
  }

  // relógio do treino (conta enquanto não estiver pausado nem com a confirmação de finalizar aberta)
  useEffect(() => {
    if (!running || paused || confirmEnd) return
    const t = window.setInterval(() => {
      setElapsed((s) => s + 1)
      setRemaining((r) => (r > 0 ? r - 1 : 0))
    }, 1000)
    return () => window.clearInterval(t)
  }, [running, paused, confirmEnd])

  function advanceExercise(markDone: boolean) {
    if (markDone && ex && !doneIds.includes(ex.id)) setDoneIds((d) => [...d, ex.id])
    if (idx + 1 >= exercises.length) {
      setPhase('end')
    } else {
      setIdx(idx + 1)
      setSetNo(1)
      setPhase('ready')
    }
  }

  function finishSet() {
    if (!ex) return
    if (setNo >= ex.sets) {
      // acabou o exercício: marca e segue (descanso curto antes do próximo)
      if (!doneIds.includes(ex.id)) setDoneIds((d) => [...d, ex.id])
      if (idx + 1 >= exercises.length) return setPhase('end')
      setPhase('rest')
      setRemaining(Math.max(10, ex.rest_sec))
      return
    }
    setPhase('rest')
    setRemaining(ex.rest_sec)
  }

  function startWork() {
    if (!ex) return
    // o toque em "Começar" libera o áudio no celular
    if (soundOn) unlockBeep()
    setPhase('work')
    setPaused(false)
    setRemaining(ex.mode === 'time' ? ex.target : 0)
  }

  function endRest() {
    if (!ex) return
    if (setNo >= ex.sets) {
      advanceExercise(false)
    } else {
      setSetNo(setNo + 1)
      startWork()
    }
  }

  // quando o tempo zera: série por tempo termina; descanso termina
  // (bipe: um no fim do exercício, dois no fim do descanso; nunca pausado, nunca depois de encerrar)
  useEffect(() => {
    if (!running || paused || remaining > 0 || !ex || confirmEnd) return
    const timed = (phase === 'work' && ex.mode === 'time') || phase === 'rest'
    const key = `${idx}-${setNo}-${phase}`
    if (timed && soundOn && lastBeep.current !== key) {
      lastBeep.current = key
      beep(phase === 'rest' ? 2 : 1, phase === 'rest' ? 1040 : 880)
    }
    if (phase === 'work' && ex.mode === 'time') finishSet()
    else if (phase === 'rest') endRest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase, paused, confirmEnd])

  const summary = useMemo<RunSummary>(() => ({ seconds: elapsed, total: exercises.length, done: doneIds.length, doneIds }), [elapsed, exercises.length, doneIds])

  useEffect(() => {
    if (phase === 'end' && !finished.current) {
      finished.current = true
      onFinish(summary)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const progress = Math.round(((doneIds.length + skipped) / Math.max(1, exercises.length)) * 100)

  if (phase === 'end') {
    return (
      <section className="ex-player ex-summary" aria-live="polite">
        <h3>{endedEarly ? 'Treino finalizado' : 'Treino concluído! 🎉'}</h3>
        <p>
          <strong>{title}</strong>
        </p>
        <ul className="ex-summary-list">
          <li>Tempo: {formatClock(elapsed)}</li>
          <li>
            Exercícios feitos: {doneIds.length} de {exercises.length}
          </li>
        </ul>
        <p className="home-muted">Bom trabalho! Beba água e descanse um pouco. O treino foi salvo no seu histórico.</p>
        <button type="button" className="water-primary" onClick={onExit}>
          Voltar
        </button>
      </section>
    )
  }

  if (!ex) return null

  return (
    <section className="ex-player" aria-label={`Treino ${title}`}>
      <div className="ex-player-top">
        <strong>{title}</strong>
        <span className="home-muted">
          Exercício {idx + 1} de {exercises.length} · tempo {formatClock(elapsed)}
        </span>
      </div>
      <div className="ex-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do treino">
        <span style={{ width: `${progress}%` }} />
      </div>

      <h3>{ex.name}</h3>
      <ExerciseIllustration slug={ex.slug} name={ex.name} />

      {phase === 'ready' && (
        <>
          <p>
            {ex.sets} séries de {ex.mode === 'time' ? `${ex.target} segundos` : `${ex.target} repetições`}. Descanso de {ex.rest_sec}s entre as séries.
          </p>
          <ol className="ex-steps">
            {ex.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <button type="button" className="ex-big" onClick={startWork}>
            Começar
          </button>
        </>
      )}

      {phase === 'work' && (
        <>
          <p className="ex-set">
            Série {setNo} de {ex.sets}
          </p>
          {ex.mode === 'time' ? <p className="ex-clock">{formatClock(remaining)}</p> : <p className="ex-clock">{ex.target} repetições</p>}
          {ex.mode === 'reps' && (
            <button type="button" className="ex-big" onClick={finishSet} disabled={paused}>
              Fiz a série
            </button>
          )}
        </>
      )}

      {phase === 'rest' && (
        <>
          <p className="ex-set">Descanso</p>
          <p className="ex-clock">{formatClock(remaining)}</p>
          <button type="button" className="ex-big" onClick={endRest}>
            Pular descanso
          </button>
        </>
      )}

      <div className="ex-controls">
        {running && (
          <button type="button" className="ex-ctl ex-ctl--pause" onClick={() => setPaused((p) => !p)}>
            {paused ? 'Continuar' : 'Pausar'}
          </button>
        )}
        <button
          type="button"
          className="ex-ctl ex-ctl--sound"
          onClick={toggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Desligar os bipes' : 'Ligar os bipes'}
          title={soundOn ? 'Bipes ligados' : 'Bipes desligados'}
        >
          {soundOn ? '🔔' : '🔕'}
        </button>
      </div>

      <div className="ex-main-actions">
        <button
          type="button"
          className="ex-action ex-action--skip"
          onClick={() => {
            // pular NÃO conta como feito: só avança para o próximo exercício
            if (ex && !doneIds.includes(ex.id)) setSkipped((n) => n + 1)
            advanceExercise(false)
          }}
        >
          <span aria-hidden="true">⏭</span> PULAR EXERCÍCIO
        </button>
        <button type="button" className="ex-action ex-action--end" onClick={() => setConfirmEnd(true)}>
          <span aria-hidden="true">■</span> FINALIZAR TREINO
        </button>
      </div>

      {confirmEnd && (
        <div className="ex-confirm" role="alertdialog" aria-modal="true" aria-labelledby="ex-confirm-title">
          <div className="ex-confirm-card">
            <h4 id="ex-confirm-title">Finalizar o treino agora?</h4>
            <p className="home-muted">
              {doneIds.length} de {exercises.length} exercícios feitos até aqui. Eles ficam salvos no seu histórico.
            </p>
            <div className="ex-confirm-actions">
              <button type="button" className="ex-action ex-action--skip" onClick={() => setConfirmEnd(false)} autoFocus>
                Continuar treino
              </button>
              <button
                type="button"
                className="ex-action ex-action--end"
                onClick={() => {
                  setConfirmEnd(false)
                  setEndedEarly(true)
                  setPhase('end')
                }}
              >
                Finalizar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
