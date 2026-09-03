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
    return <p className="home-muted">Carregando pontos da comunidade...</p>
  }

  if (error) {
    return <p className="auth-error">Não foi possível carregar os pontos agora.</p>
  }

  return (
    <div className="points-panel">
      <section className="community-card community-card--quiet">
        <h3>Resumo de pontos</h3>
        {summary ? (
          <>
            <div className="points-widget-figures">
              <div className="points-balance">
                <span className="points-balance-value">{summary.total_points_period}</span>
                <span className="points-balance-label">
                  concedidos em {summary.period_days} dias
                </span>
              </div>
              <div className="points-balance points-balance--muted">
                <span className="points-balance-value">{summary.total_points_all_time}</span>
                <span className="points-balance-label">total já concedido</span>
              </div>
              <div className="points-balance points-balance--muted">
                <span className="points-balance-value">{summary.earners_count}</span>
                <span className="points-balance-label">participantes com saldo</span>
              </div>
            </div>

            <ul className="points-reason-breakdown">
              {REASON_ORDER.map((reason) => (
                <li key={reason}>
                  <span>{POINT_REASON_LABEL[reason]}</span>
                  <span className="points-entry-amount">+{summary.by_reason[reason] ?? 0}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState message="Ainda não há pontos nesta comunidade." />
        )}
      </section>

      <section className="community-card community-card--quiet">
        <h3>Pontos de participação diária</h3>
        <p className="challenge-field-hint">
          Pontos concedidos quando a participante registra o humor do dia. 0 = desligado.
        </p>
        <form className="points-config-form" onSubmit={handleSaveConfig}>
          <label htmlFor="points-recurring">Pontos por dia</label>
          <input
            id="points-recurring"
            type="number"
            min={0}
            max={1000}
            step={1}
            value={recurringValue}
            onChange={(event) => setRecurringDraft(event.target.value)}
          />
          <button type="submit" disabled={savingConfig}>
            {savingConfig ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
        {configMsg && <p className="points-panel-msg">{configMsg}</p>}
      </section>

      <section className="community-card community-card--quiet">
        <h3>Conceder pontos</h3>
        <p className="challenge-field-hint">
          De 1 a 1000 pontos por vez. Você não pode conceder pontos para si mesma.
        </p>
        <form className="points-award-form" onSubmit={handleGrant}>
          <label htmlFor="points-grant-target">Participante</label>
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

          <label htmlFor="points-grant-amount">Quantidade</label>
          <input
            id="points-grant-amount"
            type="number"
            min={1}
            max={1000}
            step={1}
            value={grantAmount}
            onChange={(event) => setGrantAmount(event.target.value)}
          />

          <label htmlFor="points-grant-note">Motivo (opcional)</label>
          <input
            id="points-grant-note"
            type="text"
            value={grantNote}
            onChange={(event) => setGrantNote(event.target.value)}
            placeholder="Ex.: participação especial na roda de conversa."
          />

          {grantError && <p className="auth-error">{grantError}</p>}
          {grantOk && <p className="points-panel-msg">{grantOk}</p>}

          <button type="submit" disabled={granting}>
            {granting ? 'Concedendo...' : 'Conceder pontos'}
          </button>
        </form>
      </section>

      <section className="community-card community-card--quiet">
        <h3>Saldo dos participantes</h3>
        {memberBalances.length === 0 ? (
          <EmptyState message="Nenhum participante ativo ainda." />
        ) : (
          <ul className="points-member-list">
            {memberBalances.map((member) => (
              <li key={member.profile.id} className="points-member-row">
                <button
                  type="button"
                  className="points-member-toggle"
                  onClick={() =>
                    setOpenMemberId((current) =>
                      current === member.profile.id ? null : member.profile.id,
                    )
                  }
                >
                  <span>{member.profile.full_name ?? 'Participante'}</span>
                  <span className="points-entry-amount">{member.balance} pts</span>
                </button>
                {openMemberId === member.profile.id && (
                  <div className="points-member-ledger">
                    <PointsHistory
                      entries={openMemberLedger}
                      communityName={communityName}
                      emptyMessage="Sem movimentações recentes deste participante."
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="community-card community-card--quiet">
        <h3>Extrato da comunidade</h3>
        <PointsHistory
          entries={ledger}
          communityName={communityName}
          showWho
          emptyMessage="Nenhuma movimentação de pontos ainda."
        />
      </section>
    </div>
  )
}
