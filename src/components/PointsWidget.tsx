import { useState } from 'react'
import { usePoints } from '../hooks/usePoints'
import { POINT_REASON_LABEL } from '../types/points'
import { PointsHistory } from './PointsHistory'
import { SparkleIcon } from './icons'

interface PointsWidgetProps {
  communityId: string
  communityName: string
  profileId: string
}

/**
 * Card de pontos da própria usuária, SEMPRE no contexto de uma comunidade
 * (pontos nunca se misturam entre comunidades). Mostra saldo atual, o
 * total ganho e as últimas movimentações; abre o histórico completo.
 * Fundo branco, borda fina, sombra suave — tokens do Círcula.
 */
export function PointsWidget({ communityId, communityName, profileId }: PointsWidgetProps) {
  const { balance, ledger, loading, error } = usePoints(communityId, profileId)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Sem estorno nesta fase: tudo o que entra no ledger é positivo, então
  // "pontos ganhos" acumulados == saldo atual.
  const earned = balance
  const recent = ledger.slice(0, 3)

  return (
    <section className="points-widget">
      <header className="points-widget-head">
        <span className="points-widget-icon" aria-hidden="true">
          <SparkleIcon />
        </span>
        <div>
          <h3 className="points-widget-title">Seus pontos</h3>
          <p className="points-widget-sub">em {communityName}</p>
        </div>
      </header>

      {loading ? (
        <p className="home-muted">Carregando pontos...</p>
      ) : error ? (
        <p className="auth-error">Não foi possível carregar seus pontos agora.</p>
      ) : (
        <>
          <div className="points-widget-figures">
            <div className="points-balance">
              <span className="points-balance-value">{balance}</span>
              <span className="points-balance-label">saldo atual</span>
            </div>
            <div className="points-balance points-balance--muted">
              <span className="points-balance-value">{earned}</span>
              <span className="points-balance-label">pontos ganhos</span>
            </div>
          </div>

          {recent.length > 0 ? (
            <ul className="points-widget-recent">
              {recent.map((entry) => (
                <li key={entry.id}>
                  <span>{POINT_REASON_LABEL[entry.reason]}</span>
                  <span className="points-entry-amount">+{entry.amount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="points-widget-empty">
              Você ainda não ganhou pontos nesta comunidade. Conclua dias de desafio,
              termine desafios e registre seu humor do dia para começar.
            </p>
          )}

          {ledger.length > 0 && (
            <>
              <button
                type="button"
                className="points-widget-toggle"
                onClick={() => setHistoryOpen((open) => !open)}
              >
                {historyOpen ? 'Ocultar histórico' : 'Ver histórico completo'}
              </button>
              {historyOpen && (
                <PointsHistory entries={ledger} communityName={communityName} />
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
