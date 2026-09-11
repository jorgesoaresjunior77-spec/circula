import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { usePointsAdmin } from '../hooks/usePoints'
import { POINT_REASON_LABEL, type PointReason } from '../types/points'
import { PointsHistory } from './PointsHistory'
import { EmptyState } from './EmptyState'

interface PointsPanelProps {
  communityId: string
  profileId: string
}

const REASON_ORDER: PointReason[] = [
  'challenge_day',
  'challenge_completion',
  'recurring_participation',
  'manual',
]

/**
 * Aba "Pontos" do painel da Nutri. Resumo agregado da comunidade,
 * configuração dos pontos de participação diária, saldo e extrato por
 * participante, e concessão manual (1–1000, nunca para si). A Nutri NUNCA
 * altera/apaga lançamentos — não há UI para isso e a RLS não permite.
 *
 * Redesign editorial: blocos planos com classes .panel-points-*, sem
 * .community-card. Nenhuma lógica (usePointsAdmin, handleSaveConfig,
 * handleGrant, toggle de saldo) mudou — só markup/classes. `top_earners`
 * (já presente no summary) continua sem uso visual, por decisão explícita.
 */
export function PointsPanel({ communityId, profileId }: PointsPanelProps) {
  const {
    summary,
    memberBalances,
    ledger,
    recurringPerDay,
    communityName,
    loading,
    error,
    awardManual,
    setRecurringConfig,
  } = usePointsAdmin(communityId)

  const [recurringDraft, setRecurringDraft] = useState<string>('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [configMsg, setConfigMsg] = useState<string | null>(null)

  const [grantTarget, setGrantTarget] = useState('')
  const [grantAmount, setGrantAmount] = useState('')
  const [grantNote, setGrantNote] = useState('')
  const [granting, setGranting] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)
  const [grantOk, setGrantOk] = useState<string | null>(null)

  const [openMemberId, setOpenMemberId] = useState<string | null>(null)

  const recurringValue = recurringDraft === '' ? String(recurringPerDay) : recurringDraft

  const grantableMembers = useMemo(
    () => memberBalances.filter((m) => m.profile.id !== profileId),
    [memberBalances, profileId],
  )

  const openMemberLedger = useMemo(
    () => (openMemberId ? ledger.filter((entry) => entry.profile_id === openMemberId) : []),
    [ledger, openMemberId],
  )

  async function handleSaveConfig(event: FormEvent) {
    event.preventDefault()
    setSavingConfig(true)
    setConfigMsg(null)
    const { error: configError } = await setRecurringConfig(Number(recurringValue) || 0)
    setSavingConfig(false)
    setConfigMsg(configError ?? 'Configuração salva.')
    if (!configError) setRecurringDraft('')
  }

  async function handleGrant(event: FormEvent) {
    event.preventDefault()
    setGrantError(null)
    setGrantOk(null)

    const amount = Number(grantAmount)
    if (!grantTarget) {
      setGrantError('Escolha a participante.')
      return
    }
    if (!Number.isFinite(amount) || amount < 1 || amount > 1000) {
      setGrantError('A quantidade precisa estar entre 1 e 1000.')
      return
    }

    setGranting(true)
    const { error: awardError } = await awardManual(grantTarget, Math.trunc(amount), grantNote)
    setGranting(false)

    if (awardError) {
      setGrantError(awardError)
      return
    }
    setGrantOk('Pontos concedidos.')
    setGrantAmount('')
    setGrantNote('')
    setGrantTarget('')
  }

  if (loading) {
    return <p className="panel-points-muted">Carregando pontos da comunidade...</p>
  }

  if (error) {
    return <p className="auth-error">Não foi possível carregar os pontos agora.</p>
  }

  return (
    <section className="panel-points">
      <header className="panel-points-head">
        <p className="panel-points-title">Painel · Pontos</p>
        <p className="panel-points-intro">
          Acompanhe a pontuação da comunidade e conceda pontos manualmente.
        </p>
      </header>

      <div className="panel-points-block">
        <h3 className="panel-points-eyebrow">Resumo</h3>
        {summary ? (
          <>
            <div className="panel-points-kpis">
              <div className="panel-points-kpi">
                <span className="panel-points-kpi-value">{summary.total_points_period}</span>
                <span className="panel-points-kpi-label">
                  concedidos em {summary.period_days} dias
                </span>
              </div>
              <div className="panel-points-kpi">
                <span className="panel-points-kpi-value">{summary.total_points_all_time}</span>
                <span className="panel-points-kpi-label">total já concedido</span>
              </div>
              <div className="panel-points-kpi">
                <span className="panel-points-kpi-value">{summary.earners_count}</span>
                <span className="panel-points-kpi-label">participantes com saldo</span>
              </div>
            </div>

            <ul className="panel-points-breakdown">
              {REASON_ORDER.map((reason) => (
                <li key={reason}>
                  <span>{POINT_REASON_LABEL[reason]}</span>
                  <span className="panel-points-breakdown-amount">
                    +{summary.by_reason[reason] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState message="Ainda não há pontos nesta comunidade." />
        )}
      </div>

      <div className="panel-points-block">
        <h3 className="panel-points-eyebrow">Pontos de participação diária</h3>
        <p className="panel-points-hint">
          Pontos concedidos quando a participante registra o humor do dia. 0 = desligado.
        </p>
        <form className="panel-points-config-form" onSubmit={handleSaveConfig}>
          <div className="panel-points-field">
            <label className="panel-points-label" htmlFor="points-recurring">
              Pontos por dia
            </label>
            <input
              id="points-recurring"
              type="number"
              min={0}
              max={1000}
              step={1}
              value={recurringValue}
              onChange={(event) => setRecurringDraft(event.target.value)}
            />
          </div>
          <div className="panel-points-form-actions">
            <button type="submit" className="panel-points-submit" disabled={savingConfig}>
              {savingConfig ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
        {configMsg && <p className="panel-points-msg">{configMsg}</p>}
      </div>

      <div className="panel-points-block">
        <h3 className="panel-points-eyebrow">Conceder pontos</h3>
        <p className="panel-points-hint">
          De 1 a 1000 pontos por vez. Você não pode conceder pontos para si mesma.
        </p>
        <form className="panel-points-form" onSubmit={handleGrant}>
          <div className="panel-points-field">
            <label className="panel-points-label" htmlFor="points-grant-target">
              Participante
            </label>
            <select
              id="points-grant-target"
              value={grantTarget}
              onChange={(event) => setGrantTarget(event.target.value)}
            >
              <option value="">Selecione...</option>
              {grantableMembers.map((member) => (
                <option key={member.profile.id} value={member.profile.id}>
                  {member.profile.full_name ?? 'Participante'} · {member.balance} pts
                </option>
              ))}
            </select>
          </div>

          <div className="panel-points-field">
            <label className="panel-points-label" htmlFor="points-grant-amount">
              Quantidade
            </label>
            <input
              id="points-grant-amount"
              type="number"
              min={1}
              max={1000}
              step={1}
              value={grantAmount}
              onChange={(event) => setGrantAmount(event.target.value)}
            />
          </div>

          <div className="panel-points-field">
            <label className="panel-points-label" htmlFor="points-grant-note">
              Motivo (opcional)
            </label>
            <input
              id="points-grant-note"
              type="text"
              value={grantNote}
              onChange={(event) => setGrantNote(event.target.value)}
              placeholder="Ex.: participação especial na roda de conversa."
            />
          </div>

          {grantError && <p className="auth-error">{grantError}</p>}
          {grantOk && <p className="panel-points-msg">{grantOk}</p>}

          <div className="panel-points-form-actions">
            <button type="submit" className="panel-points-submit" disabled={granting}>
              {granting ? 'Concedendo...' : 'Conceder pontos'}
            </button>
          </div>
        </form>
      </div>

      <div className="panel-points-block">
        <h3 className="panel-points-eyebrow">Saldo dos participantes</h3>
        {memberBalances.length === 0 ? (
          <EmptyState message="Nenhum participante ativo ainda." />
        ) : (
          <div className="panel-points-member-list">
            {memberBalances.map((member) => (
              <div key={member.profile.id} className="panel-points-member">
                <button
                  type="button"
                  className="panel-points-member-toggle"
                  onClick={() =>
                    setOpenMemberId((current) =>
                      current === member.profile.id ? null : member.profile.id,
                    )
                  }
                >
                  <span className="panel-points-member-name">
                    {member.profile.full_name ?? 'Participante'}
                  </span>
                  <span className="panel-points-member-balance">{member.balance} pts</span>
                </button>
                {openMemberId === member.profile.id && (
                  <div className="panel-points-member-ledger">
                    <PointsHistory
                      entries={openMemberLedger}
                      communityName={communityName}
                      emptyMessage="Sem movimentações recentes deste participante."
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel-points-block">
        <h3 className="panel-points-eyebrow">Extrato da comunidade</h3>
        <PointsHistory
          entries={ledger}
          communityName={communityName}
          showWho
          emptyMessage="Nenhuma movimentação de pontos ainda."
        />
      </div>
    </section>
  )
}
