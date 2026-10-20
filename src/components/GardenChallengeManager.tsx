import { useState } from 'react'
import type { FormEvent } from 'react'
import { useGardenChallenges } from '../hooks/useGardenChallenges'
import { CoverImageInput } from './CoverImageInput'
import { EmptyState } from './EmptyState'
import type {
  GardenChallenge,
  GardenChallengeDay,
  GardenChallengeDayInput,
  GardenChallengeInput,
} from '../types/garden'

interface GardenChallengeManagerProps {
  communityId: string
  profileId: string
  onPublished?: () => void
}

interface FormState {
  title: string
  description: string
  durationDays: string
  startsOn: string
  enrollmentOpensAt: string
  enrollmentClosesAt: string
  allowLateEnrollment: boolean
  coverImageUrl: string
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  durationDays: '10',
  startsOn: '',
  enrollmentOpensAt: '',
  enrollmentClosesAt: '',
  allowLateEnrollment: false,
  coverImageUrl: '',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  archived: 'Arquivado',
}

function toInput(form: FormState): GardenChallengeInput | { error: string } {
  if (!form.title.trim()) return { error: 'Informe o título do desafio.' }
  if (!form.startsOn) return { error: 'Informe a data de início.' }
  const duration = Number(form.durationDays)
  if (!Number.isFinite(duration) || duration < 1 || duration > 90) {
    return { error: 'A duração precisa ser entre 1 e 90 dias.' }
  }
  return {
    title: form.title,
    description: form.description.trim() || null,
    duration_days: duration,
    starts_on: form.startsOn,
    enrollment_opens_at: form.enrollmentOpensAt ? new Date(form.enrollmentOpensAt).toISOString() : null,
    enrollment_closes_at: form.enrollmentClosesAt
      ? new Date(form.enrollmentClosesAt).toISOString()
      : null,
    allow_late_enrollment: form.allowLateEnrollment,
    cover_image_url: form.coverImageUrl || null,
  }
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

function addUtcDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + amount)
  return next
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Replica, só para DETECÇÃO no cliente, o mesmo algoritmo de
 * `garden_generate_challenge_days` (migration): a partir de `starts_on`,
 * pula sábado/domingo, um dia útil por `day_number`, sequencialmente.
 * Resultado indexado por `day_number - 1`. Nunca usada para gerar ou
 * gravar nada — só para comparar contra `activity_date` já salvo e
 * descobrir se alguém editou a data de um dia manualmente via `DayRow`.
 */
function computeExpectedDates(startsOn: string, durationDays: number): string[] {
  let cursor = parseIsoDate(startsOn)
  while (isWeekend(cursor)) cursor = addUtcDays(cursor, 1)

  const dates: string[] = []
  for (let day = 1; day <= durationDays; day++) {
    dates.push(formatIsoDate(cursor))
    cursor = addUtcDays(cursor, 1)
    while (isWeekend(cursor)) cursor = addUtcDays(cursor, 1)
  }
  return dates
}

/**
 * Um dia "padrão" é exatamente o que `garden_generate_challenge_days`
 * produziria para ele: título `Dia N`, sem instruções/ícone/mensagem de
 * incentivo, e a data calculada por `computeExpectedDates`. Qualquer
 * desvio (inclusive de data) é uma personalização feita via `DayRow`.
 * Se `expectedDate` não puder ser determinada (índice fora do calculado),
 * o dia é tratado como NÃO padrão — erra para o lado de pedir confirmação.
 */
function isDefaultDay(day: GardenChallengeDay, expectedDate: string | undefined): boolean {
  return (
    day.title === `Dia ${day.day_number}` &&
    !day.instructions &&
    !day.icon &&
    !day.encouragement_message &&
    expectedDate !== undefined &&
    day.activity_date === expectedDate
  )
}

function formFromChallenge(challenge: GardenChallenge): FormState {
  return {
    title: challenge.title,
    description: challenge.description ?? '',
    durationDays: String(challenge.duration_days),
    startsOn: challenge.starts_on,
    enrollmentOpensAt: challenge.enrollment_opens_at
      ? challenge.enrollment_opens_at.slice(0, 16)
      : '',
    enrollmentClosesAt: challenge.enrollment_closes_at
      ? challenge.enrollment_closes_at.slice(0, 16)
      : '',
    allowLateEnrollment: challenge.allow_late_enrollment,
    coverImageUrl: challenge.cover_image_url ?? '',
  }
}

/** Uma linha de dia, com edição inline (título/instruções/ícone/incentivo/data). */
function DayRow({
  day,
  onSave,
}: {
  day: GardenChallengeDay
  onSave: (input: GardenChallengeDayInput) => Promise<{ error: string | null }>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<GardenChallengeDayInput>({
    title: day.title,
    instructions: day.instructions,
    icon: day.icon,
    encouragement_message: day.encouragement_message,
    activity_date: day.activity_date,
  })

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await onSave(form)
    setSaving(false)
    if (!error) setEditing(false)
  }

  if (!editing) {
    return (
      <li className="panel-content-row">
        <div>
          <p className="panel-content-row-text">
            <strong>
              Dia {day.day_number} · {day.activity_date}
            </strong>{' '}
            {day.icon ? `${day.icon} ` : ''}
            {day.title}
          </p>
          {day.instructions && <p className="panel-content-muted">{day.instructions}</p>}
          {day.encouragement_message && (
            <p className="panel-content-muted">💬 {day.encouragement_message}</p>
          )}
        </div>
        <div className="panel-content-row-actions">
          <button type="button" className="panel-content-action" onClick={() => setEditing(true)}>
            Editar
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="panel-content-row">
      <form className="panel-content-edit" onSubmit={handleSave}>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          placeholder="Título da atividade"
          required
        />
        <textarea
          value={form.instructions ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
          rows={2}
          placeholder="Instruções"
        />
        <input
          type="text"
          value={form.icon ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
          placeholder="Ícone (ex.: 🌱)"
        />
        <textarea
          value={form.encouragement_message ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, encouragement_message: e.target.value }))}
          rows={2}
          placeholder="Mensagem de incentivo padrão deste dia"
        />
        <input
          type="date"
          value={form.activity_date}
          onChange={(e) => setForm((p) => ({ ...p, activity_date: e.target.value }))}
          required
        />
        <div className="panel-content-row-actions">
          <button type="button" className="panel-content-action" onClick={() => setEditing(false)}>
            Cancelar
          </button>
          <button
            type="submit"
            className="panel-content-action panel-content-action--primary"
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </li>
  )
}

/** Painel expandido de um desafio: dias, participantes/progresso, publicar incentivo. */
function ChallengeDetail({
  challenge,
  api,
  onPublished,
}: {
  challenge: GardenChallenge
  api: ReturnType<typeof useGardenChallenges>
  onPublished?: () => void
}) {
  const [tab, setTab] = useState<'dias' | 'progresso' | 'incentivo'>('dias')
  const [generating, setGenerating] = useState(false)
  const [genMessage, setGenMessage] = useState<string | null>(null)
  const [selectedDayId, setSelectedDayId] = useState('')
  const [incentiveMessage, setIncentiveMessage] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishMessage, setPublishMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  )

  const days = api.daysByChallenge[challenge.id] ?? []
  const participants = api.participantsByChallenge[challenge.id] ?? []
  const completions = api.completionsByChallenge[challenge.id] ?? []

  function openTab(next: typeof tab) {
    setTab(next)
    if (next === 'dias' && days.length === 0) api.fetchDays(challenge.id)
    if (next === 'progresso') api.fetchProgress(challenge.id)
    if (next === 'incentivo' && days.length === 0) api.fetchDays(challenge.id)
  }

  async function handleGenerate() {
    // Regenerar apaga e recria os dias do zero (garden_generate_challenge_days) —
    // qualquer título/instrução/ícone/mensagem de incentivo/data personalizados via
    // DayRow seriam perdidos. Antes de qualquer outra verificação: se a última
    // busca dos dias ainda está em andamento OU falhou, `days` não é uma fonte
    // confiável do que existe de verdade no banco (pode estar vazio só por falta
    // de fetch bem-sucedido, não por não existir dia/personalização nenhuma) —
    // nesses dois casos a confirmação NÃO é oferecida como forma de prosseguir;
    // a geração é bloqueada até o carregamento ser concluído com sucesso.
    const stillLoading = !!api.daysLoading[challenge.id]
    const loadError = api.daysError[challenge.id]

    if (stillLoading || loadError) {
      setGenMessage(
        stillLoading
          ? 'Os dias deste desafio ainda estão carregando — aguarde terminar antes de gerar novamente.'
          : 'Não foi possível verificar os dias atuais deste desafio (falha ao carregar). Feche e reabra o desafio (ou troque de aba e volte para "Dias") para tentar carregar novamente antes de gerar dias.',
      )
      return
    }

    if (days.length > 0) {
      const expectedDates = computeExpectedDates(challenge.starts_on, challenge.duration_days)
      const hasCustomizations = days.some(
        (day) => !isDefaultDay(day, expectedDates[day.day_number - 1]),
      )

      if (hasCustomizations) {
        const message =
          'Isto vai apagar os títulos, instruções, ícones, mensagens de incentivo e datas personalizados dos dias atuais e substituí-los pelos dias padrão. Essa ação não pode ser desfeita. Deseja continuar?'
        if (!window.confirm(message)) return
      }
    }

    setGenerating(true)
    setGenMessage(null)
    const { error } = await api.generateDays(challenge.id)
    setGenerating(false)
    setGenMessage(error ?? `${challenge.duration_days} dias gerados (fins de semana pulados).`)
  }

  async function handlePublishIncentive(e: FormEvent) {
    e.preventDefault()
    if (!selectedDayId || !incentiveMessage.trim()) return
    setPublishing(true)
    setPublishMessage(null)
    const { error } = await api.publishDailyPost(selectedDayId, incentiveMessage)
    setPublishing(false)
    if (error) {
      setPublishMessage({ type: 'error', text: error })
      return
    }
    setPublishMessage({ type: 'success', text: 'Mensagem de incentivo publicada no feed.' })
    setIncentiveMessage('')
    onPublished?.()
  }

  function selectDay(id: string) {
    setSelectedDayId(id)
    const day = days.find((d) => d.id === id)
    setIncentiveMessage(day?.encouragement_message ?? '')
  }

  const completionsByDay: Record<string, number> = {}
  for (const c of completions) completionsByDay[c.challenge_day_id] = (completionsByDay[c.challenge_day_id] ?? 0) + 1

  return (
    <div className="panel-content-instance">
      <div className="panel-subtabs">
        {(['dias', 'progresso', 'incentivo'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={`panel-subtab${tab === key ? ' panel-subtab--active' : ''}`}
            onClick={() => openTab(key)}
          >
            {key === 'dias' ? 'Dias' : key === 'progresso' ? 'Participantes & progresso' : 'Publicar incentivo'}
          </button>
        ))}
      </div>

      {tab === 'dias' && (
        <>
          {challenge.status === 'draft' && (
            <div className="panel-content-form-actions">
              <button
                type="button"
                className="panel-content-submit"
                onClick={handleGenerate}
                disabled={generating || !!api.daysLoading[challenge.id]}
              >
                {generating ? 'Gerando...' : days.length > 0 ? 'Gerar dias novamente' : 'Gerar dias'}
              </button>
            </div>
          )}
          {genMessage && <p className="panel-content-notice">{genMessage}</p>}

          {api.daysLoading[challenge.id] ? (
            <p className="panel-content-muted">Carregando dias...</p>
          ) : api.daysError[challenge.id] ? (
            <p className="auth-error">
              Não foi possível carregar os dias deste desafio: {api.daysError[challenge.id]}
            </p>
          ) : days.length === 0 ? (
            <p className="panel-content-muted">Nenhum dia gerado ainda.</p>
          ) : (
            <ul className="panel-content-list">
              {days.map((day) => (
                <DayRow
                  key={day.id}
                  day={day}
                  onSave={(input) => api.updateDay(challenge.id, day.id, input)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'progresso' && (
        <>
          {api.progressLoading[challenge.id] && <p className="panel-content-muted">Carregando...</p>}
          {!api.progressLoading[challenge.id] && participants.length === 0 && (
            <p className="panel-content-roster-empty">Ninguém se inscreveu ainda.</p>
          )}
          {participants.length > 0 && (
            <ul className="panel-content-roster">
              {participants.map((p) => {
                const done = completions.filter((c) => c.enrollment_id === p.id).length
                return (
                  <li key={p.id}>
                    {p.profile?.full_name ?? 'Participante'} — {done}/{challenge.duration_days} dias
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {tab === 'incentivo' && (
        <form className="panel-content-form" onSubmit={handlePublishIncentive}>
          {challenge.status !== 'published' && (
            <p className="panel-content-notice">Publique o desafio antes de enviar incentivos.</p>
          )}
          <div className="panel-content-field">
            <label className="panel-content-label" htmlFor={`garden-day-${challenge.id}`}>
              Atividade do dia
            </label>
            <select
              id={`garden-day-${challenge.id}`}
              value={selectedDayId}
              onChange={(e) => selectDay(e.target.value)}
            >
              <option value="">Selecione um dia</option>
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  Dia {d.day_number} · {d.title} ({completionsByDay[d.id] ?? 0} concluíram)
                </option>
              ))}
            </select>
          </div>
          <div className="panel-content-field">
            <label className="panel-content-label" htmlFor={`garden-msg-${challenge.id}`}>
              Mensagem de incentivo
            </label>
            <textarea
              id={`garden-msg-${challenge.id}`}
              value={incentiveMessage}
              onChange={(e) => setIncentiveMessage(e.target.value)}
              rows={3}
              placeholder="Ex.: Hoje é dia de respirar fundo e continuar 🌱"
            />
          </div>
          {publishMessage && (
            <p className={publishMessage.type === 'success' ? 'auth-success' : 'auth-error'}>
              {publishMessage.text}
            </p>
          )}
          <div className="panel-content-form-actions">
            <button
              type="submit"
              className="panel-content-submit"
              disabled={publishing || challenge.status !== 'published' || !selectedDayId || !incentiveMessage.trim()}
            >
              {publishing ? 'Publicando...' : 'Publicar no feed'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export function GardenChallengeManager({ communityId, profileId, onPublished }: GardenChallengeManagerProps) {
  const api = useGardenChallenges(communityId)
  const { challenges, loading, error } = api

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = toInput(form)
    if ('error' in parsed) {
      setFormError(parsed.error)
      return
    }
    setBusy(true)
    setFormError(null)
    const { error: opError } = editingId
      ? await api.updateChallenge(editingId, parsed)
      : await api.createChallenge(profileId, parsed)
    setBusy(false)
    if (opError) {
      setFormError('Não foi possível salvar o desafio agora. Tente novamente.')
      return
    }
    resetForm()
  }

  function startEdit(challenge: GardenChallenge) {
    setEditingId(challenge.id)
    setForm(formFromChallenge(challenge))
    setFormError(null)
  }

  function toggleExpand(challenge: GardenChallenge) {
    const next = expandedId === challenge.id ? null : challenge.id
    setExpandedId(next)
    if (next) {
      api.fetchDays(challenge.id)
    }
  }

  async function handleAction(action: 'publish' | 'archive' | 'delete', challenge: GardenChallenge) {
    setActionError(null)
    const result =
      action === 'publish'
        ? await api.publishChallenge(challenge.id)
        : action === 'archive'
          ? await api.archiveChallenge(challenge.id)
          : await api.deleteChallenge(challenge.id)
    if (result.error) setActionError(result.error)
  }

  return (
    <section className="panel-events panel-garden">
      <header className="panel-events-head">
        <p className="panel-events-title">Painel · Meu Jardim</p>
        <p className="panel-events-intro">
          Desafios de atividades diárias — crie, acompanhe a participação e publique incentivos no
          feed.
        </p>
      </header>

      <div className="panel-events-block">
        <h3 className="panel-events-eyebrow">{editingId ? 'Editar desafio' : 'Criar desafio'}</h3>

        <form onSubmit={handleSubmit} className="panel-content-form">
          <div className="panel-content-field">
            <label className="panel-content-label" htmlFor="garden-title">
              Título
            </label>
            <input
              id="garden-title"
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ex.: 10 dias de respiração consciente"
              required
            />
          </div>

          <div className="panel-content-field">
            <label className="panel-content-label" htmlFor="garden-desc">
              Descrição (opcional)
            </label>
            <textarea
              id="garden-desc"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
            />
          </div>

          <CoverImageInput
            id="garden-cover"
            communityId={communityId}
            uid={profileId}
            value={form.coverImageUrl}
            onChange={(url) => set('coverImageUrl', url)}
            recommendedSize="1200 × 630 px"
          />

          <div className="panel-events-form-row">
            <div className="panel-content-field">
              <label className="panel-content-label" htmlFor="garden-duration">
                Duração (dias)
              </label>
              <input
                id="garden-duration"
                type="number"
                min={1}
                max={90}
                value={form.durationDays}
                onChange={(e) => set('durationDays', e.target.value)}
                required
              />
            </div>
            <div className="panel-content-field">
              <label className="panel-content-label" htmlFor="garden-start">
                Início
              </label>
              <input
                id="garden-start"
                type="date"
                value={form.startsOn}
                onChange={(e) => set('startsOn', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="panel-events-form-row">
            <div className="panel-content-field">
              <label className="panel-content-label" htmlFor="garden-enroll-open">
                Inscrição abre em (opcional)
              </label>
              <input
                id="garden-enroll-open"
                type="datetime-local"
                value={form.enrollmentOpensAt}
                onChange={(e) => set('enrollmentOpensAt', e.target.value)}
              />
            </div>
            <div className="panel-content-field">
              <label className="panel-content-label" htmlFor="garden-enroll-close">
                Inscrição fecha em (opcional)
              </label>
              <input
                id="garden-enroll-close"
                type="datetime-local"
                value={form.enrollmentClosesAt}
                onChange={(e) => set('enrollmentClosesAt', e.target.value)}
              />
            </div>
          </div>

          <label className="panel-events-check">
            <input
              type="checkbox"
              checked={form.allowLateEnrollment}
              onChange={(e) => set('allowLateEnrollment', e.target.checked)}
            />
            Permitir inscrição tardia (depois do fechamento)
          </label>

          {formError && <p className="auth-error">{formError}</p>}

          <div className="panel-content-form-actions">
            {editingId && (
              <button type="button" className="panel-content-action" onClick={resetForm}>
                Cancelar edição
              </button>
            )}
            <button type="submit" className="panel-content-submit" disabled={busy}>
              {busy ? 'Salvando...' : editingId ? 'Salvar desafio' : 'Criar desafio'}
            </button>
          </div>
        </form>
      </div>

      <div className="panel-events-block">
        <h3 className="panel-events-eyebrow">Desafios da comunidade</h3>

        {loading && <p className="panel-events-muted">Carregando desafios...</p>}
        {!loading && error && <p className="auth-error">{error}</p>}
        {!loading && !error && challenges.length === 0 && (
          <EmptyState message="Nenhum desafio criado ainda." />
        )}

        {actionError && <p className="auth-error">{actionError}</p>}

        {!loading && !error && challenges.length > 0 && (
          <div className="panel-events-list">
            {challenges.map((challenge) => (
              <div key={challenge.id} className="panel-events-item panel-garden-item">
                <div className="panel-content-row">
                  <div>
                    <p className="panel-content-row-text">
                      <strong>{challenge.title}</strong>{' '}
                      <span className={`garden-status-badge garden-status-badge--${challenge.status}`}>
                        {STATUS_LABEL[challenge.status]}
                      </span>
                    </p>
                    <p className="panel-content-muted">
                      {challenge.duration_days} dias · início {challenge.starts_on}
                      {challenge.allow_late_enrollment ? ' · inscrição tardia permitida' : ''}
                    </p>
                  </div>
                  <div className="panel-content-row-actions">
                    <button type="button" className="panel-content-action" onClick={() => toggleExpand(challenge)}>
                      {expandedId === challenge.id ? 'Fechar' : 'Gerenciar'}
                    </button>
                    {challenge.status === 'draft' && (
                      <>
                        <button type="button" className="panel-content-action" onClick={() => startEdit(challenge)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="panel-content-action"
                          onClick={() => handleAction('publish', challenge)}
                        >
                          Publicar
                        </button>
                        <button
                          type="button"
                          className="panel-content-action panel-content-action--delete"
                          onClick={() => handleAction('delete', challenge)}
                        >
                          Excluir
                        </button>
                      </>
                    )}
                    {challenge.status !== 'archived' && (
                      <button
                        type="button"
                        className="panel-content-action"
                        onClick={() => handleAction('archive', challenge)}
                      >
                        Arquivar
                      </button>
                    )}
                  </div>
                </div>

                {expandedId === challenge.id && (
                  <ChallengeDetail challenge={challenge} api={api} onPublished={onPublished} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
