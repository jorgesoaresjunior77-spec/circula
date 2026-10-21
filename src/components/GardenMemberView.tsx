import { useState } from 'react'
import type { FormEvent } from 'react'
import { useGardenMember } from '../hooks/useGardenMember'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { GardenColorPicker } from './GardenColorPicker'
import { GardenProgressWheel } from './GardenProgressWheel'
import { EmptyState } from './EmptyState'
import { SproutIcon, CheckIcon } from './icons'
import { GARDEN_COLOR_HEX } from '../types/garden'
import type { GardenChallenge } from '../types/garden'
import type { GardenColor, Profile, ProfileUpdateInput } from '../types/profile'

interface GardenMemberViewProps {
  communityId: string
  profileId: string
  profile: Profile | null
  onUpdateProfile: (input: ProfileUpdateInput) => Promise<{ error: string | null }>
  /** Chamado após publicar um compartilhamento — para o Feed recarregar. */
  onShared?: () => void
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function ChallengeCard({
  challenge,
  enrolled,
  onSelect,
}: {
  challenge: GardenChallenge
  enrolled: boolean
  onSelect: () => void
}) {
  const { url: coverUrl } = useSignedImageUrl(challenge.cover_image_url)

  return (
    <button type="button" className="garden-challenge-card" onClick={onSelect}>
      <div className="garden-challenge-card-cover" aria-hidden="true">
        {coverUrl ? <img src={coverUrl} alt="" loading="lazy" /> : <SproutIcon size={28} />}
      </div>
      <div className="garden-challenge-card-body">
        <p className="garden-challenge-card-title">{challenge.title}</p>
        {challenge.description && <p className="garden-challenge-card-desc">{challenge.description}</p>}
        <p className="garden-challenge-card-meta">
          {challenge.duration_days} dias · início {challenge.starts_on}
        </p>
        {enrolled && <span className="garden-status-badge garden-status-badge--enrolled">Participando</span>}
      </div>
    </button>
  )
}

function ShareComposer({
  onShare,
}: {
  onShare: (content: string) => Promise<{ error: string | null }>
}) {
  const [content, setContent] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await onShare(content)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setOpen(false)
    setContent('')
  }

  if (!open) {
    return (
      <button type="button" className="garden-day-share-toggle" onClick={() => setOpen(true)}>
        Compartilhar no feed
      </button>
    )
  }

  return (
    <form className="garden-share-composer" onSubmit={handleSubmit}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        placeholder="Conte como foi (opcional)"
      />
      {error && <p className="auth-error">{error}</p>}
      <div className="panel-content-row-actions">
        <button type="button" className="panel-content-action" onClick={() => setOpen(false)}>
          Cancelar
        </button>
        <button type="submit" className="panel-content-action panel-content-action--primary" disabled={busy}>
          {busy ? 'Publicando...' : 'Publicar'}
        </button>
      </div>
    </form>
  )
}

export function GardenMemberView({
  communityId,
  profileId,
  profile,
  onUpdateProfile,
  onShared,
}: GardenMemberViewProps) {
  const api = useGardenMember(communityId, profileId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [completingDayId, setCompletingDayId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const selected = api.challenges.find((c) => c.id === selectedId) ?? null
  const myEnrollment = selected ? api.myEnrollments.find((e) => e.challenge_id === selected.id) : null
  const days = selected ? (api.daysByChallenge[selected.id] ?? []) : []
  const myCompletionsByDay = new Map(
    api.myCompletions.filter((c) => c.challenge_id === selected?.id).map((c) => [c.challenge_day_id, c]),
  )

  // Progresso (roda + resumo "X de Y dias"): total é a contagem REAL de
  // dias já gerados para este desafio (`days.length`), não
  // `duration_days` — a RLS/funções de negócio não garantem que os dois
  // sempre coincidam (duration_days pode ter sido editado no rascunho
  // sem regenerar os dias antes de publicar), e `days` é o que o Member
  // de fato vê e pode concluir. `completed` é a interseção com os dias
  // REALMENTE existentes deste desafio — nunca pode passar de
  // days.length, então o percentual (calculado dentro de
  // GardenProgressWheel) já nasce travado em 0-100% sem precisar de
  // clamp aqui.
  const completedDaysCount = days.filter((d) => myCompletionsByDay.has(d.id)).length
  const totalDaysCount = days.length
  const myColorOneHex = profile?.garden_color_one ? GARDEN_COLOR_HEX[profile.garden_color_one] : null
  const myColorTwoHex = profile?.garden_color_two ? GARDEN_COLOR_HEX[profile.garden_color_two] : null

  function selectChallenge(challenge: GardenChallenge) {
    setSelectedId(challenge.id)
    setActionError(null)
    api.fetchDays(challenge.id)
  }

  async function handleEnroll(challengeId: string) {
    setEnrolling(true)
    setActionError(null)
    const { error } = await api.enroll(challengeId)
    setEnrolling(false)
    if (error) setActionError(error)
  }

  async function handleComplete(dayId: string) {
    setCompletingDayId(dayId)
    setActionError(null)
    const { error } = await api.completeDay(dayId)
    setCompletingDayId(null)
    if (error) setActionError(error)
  }

  function handleSaveColors(colorOne: GardenColor | null, colorTwo: GardenColor | null) {
    return onUpdateProfile({ garden_color_one: colorOne, garden_color_two: colorTwo })
  }

  async function handleShare(completionId: string, content: string) {
    const result = await api.shareCompletion(completionId, content)
    if (!result.error) onShared?.()
    return result
  }

  if (api.loading) return <p className="panel-content-muted">Carregando Meu Jardim...</p>
  if (api.error) return <p className="auth-error">{api.error}</p>

  return (
    <div className="garden-member-view">
      {/* Item 1 da auditoria — título próprio da seção: Dashboard.tsx não
          passa nenhum heading para este componente (diferente de Eventos/
          Receitas, que recebem o deles via prop) — sem isto a tela não
          tinha NENHUM texto identificando em que seção a pessoa está. */}
      <p className="section-label">Meu Jardim</p>

      {profile && (
        <GardenColorPicker
          colorOne={profile.garden_color_one}
          colorTwo={profile.garden_color_two}
          onSave={handleSaveColors}
        />
      )}

      {selected ? (
        <section className="garden-detail">
          <button type="button" className="panel-content-action" onClick={() => setSelectedId(null)}>
            ← Todos os desafios
          </button>

          <h3 className="garden-detail-title">{selected.title}</h3>
          {selected.description && <p className="garden-detail-desc">{selected.description}</p>}

          {actionError && <p className="auth-error">{actionError}</p>}

          {/* Itens 4 e 5.1 da auditoria — roda + resumo "X de Y dias",
              só quando há algo real para mostrar (inscrita, dias
              carregados com sucesso e pelo menos 1 dia existente) —
              nunca durante carregamento/erro, e nunca com total=0. */}
          {myEnrollment && !api.daysLoading[selected.id] && !api.daysError[selected.id] && days.length > 0 && (
            <div className="garden-progress-row">
              <GardenProgressWheel
                completed={completedDaysCount}
                total={totalDaysCount}
                colorOne={myColorOneHex}
                colorTwo={myColorTwoHex}
              />
              <p className="garden-progress-summary">
                {completedDaysCount} de {totalDaysCount} dias concluídos
              </p>
            </div>
          )}

          {!myEnrollment ? (
            <button
              type="button"
              className="panel-content-submit"
              onClick={() => handleEnroll(selected.id)}
              disabled={enrolling}
            >
              {enrolling ? 'Entrando...' : 'Participar deste desafio'}
            </button>
          ) : api.daysLoading[selected.id] ? (
            <p className="panel-content-muted">Carregando atividades...</p>
          ) : api.daysError[selected.id] ? (
            <p className="auth-error">
              Não foi possível carregar as atividades deste desafio: {api.daysError[selected.id]}
            </p>
          ) : days.length === 0 ? (
            <p className="panel-content-muted">Nenhuma atividade cadastrada ainda.</p>
          ) : (
            <ul className="garden-day-timeline">
              {days.map((day) => {
                const released = day.activity_date <= todayIso()
                const isToday = day.activity_date === todayIso()
                const completion = myCompletionsByDay.get(day.id)
                return (
                  <li
                    key={day.id}
                    className={`garden-day${released ? '' : ' garden-day--future'}${
                      isToday ? ' garden-day--today' : ''
                    }${completion ? ' garden-day--done' : ''}`}
                  >
                    <div className="garden-day-head">
                      <span className="garden-day-number">Dia {day.day_number}</span>
                      {isToday && <span className="garden-status-badge">Hoje</span>}
                      {!released && <span className="garden-status-badge garden-status-badge--draft">Em breve</span>}
                    </div>
                    <p className="garden-day-title">
                      {day.icon ? `${day.icon} ` : ''}
                      {day.title}
                    </p>
                    {day.instructions && <p className="garden-day-instructions">{day.instructions}</p>}

                    {released &&
                      (completion ? (
                        <div className="garden-day-done-row">
                          <span className="garden-day-done-mark">
                            <CheckIcon size={14} /> Concluído
                          </span>
                          {/* Item 3 da auditoria — api.mySharedCompletionIds
                              já existia no hook mas nunca era lido aqui: o
                              composer continuava aparecendo depois de já
                              ter compartilhado, e um segundo envio só
                              falharia no backend (already_shared) em vez
                              de simplesmente não existir como opção. */}
                          {api.mySharedCompletionIds.has(completion.id) ? (
                            <span className="garden-day-shared-mark">
                              <CheckIcon size={14} /> Já compartilhado no feed
                            </span>
                          ) : (
                            <ShareComposer onShare={(content) => handleShare(completion.id, content)} />
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="garden-day-complete"
                          onClick={() => handleComplete(day.id)}
                          disabled={completingDayId === day.id}
                        >
                          {completingDayId === day.id ? 'Marcando...' : 'Marcar como concluído'}
                        </button>
                      ))}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : api.challenges.length === 0 ? (
        <EmptyState message="Nenhum desafio disponível nesta comunidade ainda." />
      ) : (
        <div className="garden-challenge-grid">
          {api.challenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              enrolled={api.myEnrollments.some((e) => e.challenge_id === challenge.id)}
              onSelect={() => selectChallenge(challenge)}
            />
          ))}
        </div>
      )}

      {/* Item 5.2 da auditoria — só na tela principal (não dentro de um
          desafio aberto), pra não competir com os desafios atuais. */}
      {!selected && <GardenHistorySection api={api} />}
    </div>
  )
}

/**
 * "Meu histórico" (item 5.2) — recolhida por padrão, busca sob demanda
 * (api.fetchHistory) só na primeira expansão. Mostra só desafios já
 * ARQUIVADOS com algum compartilhamento meu — ver a doc de
 * useGardenMember.fetchHistory para a regra exata e por que conclusões
 * nunca compartilhadas num desafio arquivado não aparecem aqui (a RLS
 * não deixa um Member comum reler um `garden_challenges`/
 * `garden_challenge_days` que já não está mais `published`, então não
 * há título/duração pra mostrar sem inventar).
 */
function GardenHistorySection({ api }: { api: ReturnType<typeof useGardenMember> }) {
  const [open, setOpen] = useState(false)

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && api.history === null) api.fetchHistory()
  }

  return (
    <section className="garden-history">
      <button
        type="button"
        className="panel-content-action garden-history-toggle"
        onClick={toggle}
        aria-expanded={open}
      >
        {open ? '▾' : '▸'} Meu histórico
      </button>

      {open && (
        <div className="garden-history-body">
          {api.historyLoading && <p className="panel-content-muted">Carregando histórico...</p>}

          {!api.historyLoading && api.historyError && (
            <p className="auth-error">Não foi possível carregar seu histórico: {api.historyError}</p>
          )}

          {!api.historyLoading && !api.historyError && api.history !== null && api.history.length === 0 && (
            <p className="panel-content-muted">Nenhum desafio arquivado no seu histórico ainda.</p>
          )}

          {!api.historyLoading && !api.historyError && api.history && api.history.length > 0 && (
            <ul className="garden-history-list">
              {api.history.map((entry) => (
                <li key={entry.challengeId} className="garden-history-item">
                  <GardenProgressWheel
                    completed={entry.daysCompleted}
                    total={entry.totalDays}
                    colorOne={entry.colorOne ? GARDEN_COLOR_HEX[entry.colorOne] : null}
                    colorTwo={entry.colorTwo ? GARDEN_COLOR_HEX[entry.colorTwo] : null}
                    size={56}
                  />
                  <div>
                    <p className="garden-history-item-title">{entry.challengeTitle}</p>
                    <p className="panel-content-muted">
                      {entry.daysCompleted} de {entry.totalDays} dias concluídos
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
