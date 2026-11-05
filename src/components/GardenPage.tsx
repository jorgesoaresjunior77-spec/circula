import { useEffect, useState } from 'react'
import { daysInMonth, useGardenMonth } from '../hooks/useGardenMonth'
import { MonthFlower, YearTree } from './GardenArt'

export const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

interface GardenPageProps {
  communityId: string
  profileId: string
  isOwner: boolean
  /** Avisa o resto do app (bolinha do card) que o check do dia mudou. */
  onChecked?: () => void
}

// Página do Meu Jardim: flor do mês e árvore do ano, uma embaixo da outra.
export function GardenPage({ communityId, profileId, isOwner, onChecked }: GardenPageProps) {
  const g = useGardenMonth(communityId, profileId)
  const [busy, setBusy] = useState(false)
  const current = g.current
  const checkedNow = current ? g.checkedDays(current.id) : new Set<number>()
  const doneToday = checkedNow.has(g.today.day)
  const todayText = current?.texts[g.today.day]

  const monthsDone: boolean[] = Array.from({ length: 12 }, (_, i) => {
    const m = g.months.find((x) => x.month === i + 1)
    return !!m && g.monthDone(m)
  })

  async function handleCheck() {
    setBusy(true)
    await g.checkToday()
    setBusy(false)
    onChecked?.()
  }

  useEffect(() => {
    onChecked?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="garden-page">
      <h2>Meu Jardim</h2>

      <article className="garden-panel">
        <h3>
          {MONTH_NAMES[g.today.month - 1]}
          {current?.title ? ` · ${current.title}` : ''}
        </h3>
        {g.loading ? (
          <p className="home-muted">Carregando…</p>
        ) : current ? (
          <>
            <MonthFlower days={current.days} checked={checkedNow} />
            <div className="garden-today">
              <p className="garden-today-label">Desafio de hoje · dia {g.today.day}</p>
              <p className="garden-today-text">{todayText || 'Sem desafio escrito para hoje.'}</p>
              {doneToday ? (
                <p className="garden-done">Check feito hoje! Sua flor acendeu mais uma pétala. 🌸</p>
              ) : (
                <>
                  <button
                    type="button"
                    className="garden-check-btn"
                    onClick={() => void handleCheck()}
                    disabled={busy}
                  >
                    CHECK!
                  </button>
                  <p className="garden-check-sub">Você executou o desafio do dia? Parabéns!</p>
                </>
              )}
              {g.error && <p className="auth-error">{g.error}</p>}
            </div>
          </>
        ) : (
          <p className="home-muted">
            {isOwner
              ? 'Cadastre abaixo o desafio deste mês.'
              : 'O desafio deste mês ainda não foi publicado.'}
          </p>
        )}
      </article>

      <article className="garden-panel">
        <h3>Árvore de {g.today.year}</h3>
        <YearTree monthsDone={monthsDone} />
        <p className="garden-check-sub">
          Cada copa acende quando você completa todos os dias do mês.
        </p>
      </article>
    </section>
  )
}

export { daysInMonth }
