import { useState } from 'react'
import type { FormEvent } from 'react'
import { WaterBottleView } from './WaterBottleView'
import { useWater } from '../hooks/useWater'
import {
  MAX_LOG_ML,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
  dailyGoalMl,
  formatLiters,
  formatMl,
  parseWeight,
  waterProgress,
} from '../lib/water'
import { MONTH_LABELS, parseIso } from '../lib/weekCalendar'

// Calculadora de água: peso -> meta estimada, registros do dia, garrafa
// que se enche, histórico por dia. Tudo privado (RLS) e no fuso de São Paulo.

interface WaterPageProps {
  profileId: string
}

const QUICK_AMOUNTS = [200, 300, 500]

function dayLabel(iso: string): string {
  const { month, day } = parseIso(iso)
  return `${day} de ${MONTH_LABELS[month - 1].toLowerCase()}`
}

export function WaterPage({ profileId }: WaterPageProps) {
  const water = useWater(profileId)
  const { weightKg, todayLogs, todayTotalMl, history, loading } = water

  const goal = weightKg === null ? null : dailyGoalMl(weightKg)
  const progress = waterProgress(todayTotalMl, goal)
  const reached = goal !== null && todayTotalMl >= goal

  const [weightInput, setWeightInput] = useState('')
  const [editingWeight, setEditingWeight] = useState(false)
  const [customMl, setCustomMl] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMl, setEditMl] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<{ error: string | null }>): Promise<boolean> {
    setBusy(true)
    setMessage(null)
    const { error } = await action()
    setBusy(false)
    if (error) setMessage(error)
    return !error
  }

  async function handleWeight(e: FormEvent) {
    e.preventDefault()
    const kg = parseWeight(weightInput)
    if (kg === null || kg < WEIGHT_MIN_KG || kg > WEIGHT_MAX_KG) {
      setMessage(`Informe um peso entre ${WEIGHT_MIN_KG} e ${WEIGHT_MAX_KG} kg.`)
      return
    }
    if (await run(() => water.saveWeight(kg))) {
      setEditingWeight(false)
      setWeightInput('')
    }
  }

  async function quickAdd(ml: number) {
    await run(() => water.addLog(ml))
  }

  async function handleCustom(e: FormEvent) {
    e.preventDefault()
    const ml = Number(customMl)
    if (!Number.isInteger(ml) || ml < 1 || ml > MAX_LOG_ML) {
      setMessage(`Informe uma quantidade entre 1 e ${MAX_LOG_ML} ml.`)
      return
    }
    if (await run(() => water.addLog(ml))) setCustomMl('')
  }

  async function handleSaveEdit(id: string) {
    const ml = Number(editMl)
    if (!Number.isInteger(ml) || ml < 1 || ml > MAX_LOG_ML) {
      setMessage(`Informe uma quantidade entre 1 e ${MAX_LOG_ML} ml.`)
      return
    }
    if (await run(() => water.updateLog(id, ml))) setEditingId(null)
  }

  const showWeightForm = weightKg === null || editingWeight

  return (
    <section className="water-page">
      <h2>Calculadora de água</h2>

      {loading && <p className="home-muted">Carregando…</p>}
      {water.error && <p className="auth-error">{water.error}</p>}
      {message && (
        <p className="auth-error" role="alert">
          {message}
        </p>
      )}

      <article className="water-panel">
        <h3>Sua meta de hoje</h3>
        {showWeightForm ? (
          <form className="water-weight-form" onSubmit={(e) => void handleWeight(e)}>
            <label>
              Seu peso (kg)
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ex.: 62,5"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
              />
            </label>
            <div className="water-actions">
              <button type="submit" className="water-primary" disabled={busy}>
                Calcular minha meta
              </button>
              {editingWeight && (
                <button type="button" className="water-link" onClick={() => setEditingWeight(false)}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        ) : (
          goal !== null && (
            <>
              <p className="water-goal">
                {formatLiters(goal)} <span>({formatMl(goal)})</span>
              </p>
              <p className="water-muted">
                Estimativa para {weightKg?.toLocaleString('pt-BR')} kg.{' '}
                <button type="button" className="water-link" onClick={() => setEditingWeight(true)}>
                  Alterar peso
                </button>{' '}
                <button type="button" className="water-link" onClick={() => void run(water.clearWeight)}>
                  Apagar meu peso
                </button>
              </p>
            </>
          )
        )}
        <p className="water-note">
          Esta é uma estimativa educativa, não uma prescrição. A necessidade de água muda com o clima, a
          atividade física, a alimentação e a condição de cada pessoa. Quem tem restrição de líquidos deve
          seguir a orientação do profissional de saúde que a acompanha.
        </p>
      </article>

      {goal !== null && (
        <article className="water-panel">
          <h3>Hoje</h3>
          <div className="water-today">
            <WaterBottleView progress={progress} celebrating={reached} />
            <div className="water-today-info">
              <p className="water-total">{formatMl(todayTotalMl)}</p>
              <p className="water-muted">
                de {formatMl(goal)} · {Math.round(progress * 100)}%
              </p>
              {reached && (
                <p className="water-done" role="status">
                  Meta de hoje concluída. Parabéns por cuidar de você! 💧
                </p>
              )}
            </div>
          </div>

          <div className="water-quick" role="group" aria-label="Registrar água">
            {QUICK_AMOUNTS.map((ml) => (
              <button key={ml} type="button" className="water-chip" disabled={busy} onClick={() => void quickAdd(ml)}>
                +{ml} ml
              </button>
            ))}
          </div>
          <form className="water-custom" onSubmit={(e) => void handleCustom(e)}>
            <label>
              Outra quantidade (ml)
              <input
                type="text"
                inputMode="numeric"
                value={customMl}
                onChange={(e) => setCustomMl(e.target.value)}
              />
            </label>
            <button type="submit" className="water-primary" disabled={busy}>
              Registrar
            </button>
          </form>

          <h4>Registros de hoje</h4>
          {todayLogs.length === 0 ? (
            <p className="water-muted">Nenhum registro ainda. Comece com um copo.</p>
          ) : (
            <ul className="water-logs">
              {todayLogs.map((log) => (
                <li key={log.id}>
                  {editingId === log.id ? (
                    <span className="water-log-edit">
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label="Nova quantidade em ml"
                        value={editMl}
                        onChange={(e) => setEditMl(e.target.value)}
                      />
                      <button type="button" className="water-link" disabled={busy} onClick={() => void handleSaveEdit(log.id)}>
                        Salvar
                      </button>
                      <button type="button" className="water-link" onClick={() => setEditingId(null)}>
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <>
                      <span>{formatMl(log.amount_ml)}</span>
                      <span className="water-log-actions">
                        <button
                          type="button"
                          className="water-link"
                          onClick={() => {
                            setEditingId(log.id)
                            setEditMl(String(log.amount_ml))
                          }}
                        >
                          Corrigir
                        </button>
                        <button type="button" className="water-link" disabled={busy} onClick={() => void run(() => water.removeLog(log.id))}>
                          Remover
                        </button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>
      )}

      {goal !== null && history.length > 0 && (
        <article className="water-panel">
          <h3>Dias anteriores</h3>
          <ul className="water-history">
            {history.map((d) => (
              <li key={d.day}>
                <span>{dayLabel(d.day)}</span>
                <span>{formatMl(d.totalMl)}</span>
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  )
}
