import {
  POINT_REASON_DESCRIPTION,
  POINT_REASON_LABEL,
  type PointLedgerEntry,
  type PointsProfileRef,
} from '../types/points'
import { EmptyState } from './EmptyState'

type HistoryEntry = PointLedgerEntry & { profile?: PointsProfileRef | null }

interface PointsHistoryProps {
  entries: HistoryEntry[]
  /** Nome da comunidade a que este extrato pertence (pontos são por comunidade). */
  communityName: string
  /** Quando `true`, mostra quem ganhou (visão da Nutri no extrato da comunidade). */
  showWho?: boolean
  emptyMessage?: string
}

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return DATE_FMT.format(date).replace(/\.$/, '')
}

/**
 * Histórico de pontos: por linha mostra origem, descrição, valor, data e
 * a comunidade relacionada (e quem ganhou, no extrato da Nutri).
 * Reaproveitado pela usuária (o próprio extrato) e pela Nutri.
 * Append-only — sem editar/apagar.
 */
export function PointsHistory({
  entries,
  communityName,
  showWho = false,
  emptyMessage = 'Nenhum ponto registrado ainda.',
}: PointsHistoryProps) {
  if (entries.length === 0) {
    return <EmptyState message={emptyMessage} />
  }

  return (
    <ul className="points-history">
      {entries.map((entry) => {
        const who = showWho ? entry.profile?.full_name?.trim() || 'Participante' : null
        return (
          <li key={entry.id} className="points-entry">
            <div className="points-entry-main">
              <p className="points-entry-reason">
                {who ? `${who} · ` : ''}
                {POINT_REASON_LABEL[entry.reason]}
              </p>
              <p className="points-entry-desc">
                {entry.note?.trim() || POINT_REASON_DESCRIPTION[entry.reason]}
              </p>
              <p className="points-entry-meta">
                {formatDate(entry.created_at)} · {communityName}
              </p>
            </div>
            <span className="points-entry-amount">+{entry.amount}</span>
          </li>
        )
      })}
    </ul>
  )
}
