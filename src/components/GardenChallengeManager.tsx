import { Fragment, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useGardenChallenges } from '../hooks/useGardenChallenges'
import { CoverImageInput } from './CoverImageInput'
import { EmptyState } from './EmptyState'
import { GardenIncentiveCard, GardenIncentiveMessageLibrary } from './GardenIncentiveTemplates'
import { GARDEN_INCENTIVE_TEMPLATES, GARDEN_INCENTIVE_TEMPLATES_BY_KEY } from '../types/garden'
import type {
  GardenChallenge,
  GardenChallengeDay,
  GardenChallengeDayInput,
  GardenChallengeInput,
  GardenIncentiveTemplateKey,
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

function formFromDay(day: GardenChallengeDay): GardenChallengeDayInput {
  return {
    title: day.title,
    instructions: day.instructions,
    icon: day.icon,
    encouragement_message: day.encouragement_message,
    activity_date: day.activity_date,
  }
}

/**
 * Etapa T — há texto digitado em `message` que ainda não corresponde ao que
 * seria carregado para `baseline` (a mensagem de incentivo padrão já salva
 * do dia, ou vazio)? Usado para decidir se trocar de dia, ou fechar o
 * desafio, descartaria silenciosamente algo que a profissional escreveu.
 */
function isDirtyIncentiveMessage(message: string, baseline: string | null | undefined): boolean {
  const trimmed = message.trim()
  return trimmed.length > 0 && trimmed !== (baseline ?? '').trim()
}

/**
 * Etapa U — compara o rascunho de edição de um dia (`form`) contra os dados
 * reais do dia (`day`, fonte da verdade) para saber se há algo digitado que
 * ainda não foi salvo via `onSave`. Usado só enquanto o dia está em edição
 * (ver `DayRowHandle.hasUnsavedChanges`) para decidir se fechar o desafio
 * expandido ou trocar para outro desafio perderia essa edição em silêncio.
 */
function isDirtyDayForm(form: GardenChallengeDayInput, day: GardenChallengeDay): boolean {
  const baseline = formFromDay(day)
  return (
    form.title !== baseline.title ||
    (form.instructions ?? '') !== (baseline.instructions ?? '') ||
    (form.icon ?? '') !== (baseline.icon ?? '') ||
    (form.encouragement_message ?? '') !== (baseline.encouragement_message ?? '') ||
    form.activity_date !== baseline.activity_date
  )
}

/** Handle exposto por `DayRow` (Etapa U) — permite ao `ChallengeDetail` perguntar,
 * antes de fechar/trocar de desafio, se este dia está em edição com algo não
 * salvo, sem precisar levantar `editing`/`form` para o ancestral. */
export interface DayRowHandle {
  hasUnsavedChanges: () => boolean
}

/** Uma linha de dia, com edição inline (título/instruções/ícone/incentivo/data). */
const DayRow = forwardRef<
  DayRowHandle,
  {
    day: GardenChallengeDay
    onSave: (input: GardenChallengeDayInput) => Promise<{ error: string | null }>
  }
>(function DayRow({ day, onSave }, ref) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<GardenChallengeDayInput>(() => formFromDay(day))
  /**
   * Etapa W — antes, um erro de `onSave` (ex.: falha de rede/RLS ao salvar o
   * dia) era descartado em silêncio: o botão só voltava de "Salvando..." para
   * "Salvar" sem nenhuma indicação do motivo, como se nada tivesse sido
   * tentado. Mesmo padrão de exibição (`auth-error`) já usado nos outros
   * erros deste arquivo (`formError`, `genMessage`/`daysError`,
   * `publishMessage`). Não precisa de try/catch: `onSave` (via
   * `api.updateDay`) segue o mesmo contrato `{ error }` de todo write deste
   * hook — nenhum outro handler deste arquivo trata exceção aqui, e inventar
   * esse tratamento só para `DayRow` fugiria do padrão já estabelecido.
   */
  const [saveError, setSaveError] = useState<string | null>(null)

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => editing && isDirtyDayForm(form, day),
  }))

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    const { error } = await onSave(form)
    setSaving(false)
    if (error) {
      setSaveError(error)
      return
    }
    setEditing(false)
  }

  /**
   * Etapa T — antes, "Cancelar" só escondia o formulário (`setEditing(false)`)
   * sem descartar o rascunho em `form`: reabrir "Editar" mostrava o texto
   * digitado-e-cancelado em vez dos dados reais do dia, como se o cancelamento
   * nunca tivesse acontecido. Agora o rascunho é reconstruído a partir de
   * `day` (fonte da verdade) ao cancelar, igual ao "Cancelar edição" do
   * formulário de desafio (`resetForm`, mais abaixo).
   */
  function handleCancel() {
    setForm(formFromDay(day))
    setEditing(false)
    setSaveError(null)
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
        {/*
         * Etapa Y — os 4 campos abaixo (título/instruções/ícone/mensagem de
         * incentivo) dependiam só do `placeholder` para dizer o que cada um
         * é; sem `<label htmlFor>`, tecnologia assistiva não tinha nome
         * programático nenhum para eles. Mesmo padrão (`panel-content-field`
         * + `panel-content-label` + `htmlFor`/`id` pareados) já usado no
         * formulário de desafio e no composer de incentivo deste arquivo —
         * aqui o `id` é sufixado com `day.id` (único e estável) porque várias
         * linhas de dia podem estar em edição ao mesmo tempo na mesma
         * página, uma por `DayRow`. O campo de data abaixo fica como estava:
         * não é um dos 4 campos cobertos por esta etapa.
         */}
        <div className="panel-content-field">
          <label className="panel-content-label" htmlFor={`garden-day-title-${day.id}`}>
            Título do dia
          </label>
          <input
            id={`garden-day-title-${day.id}`}
            type="text"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="Título da atividade"
            required
          />
        </div>
        <div className="panel-content-field">
          <label className="panel-content-label" htmlFor={`garden-day-instructions-${day.id}`}>
            Instruções
          </label>
          <textarea
            id={`garden-day-instructions-${day.id}`}
            value={form.instructions ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
            rows={2}
            placeholder="Instruções"
          />
        </div>
        <div className="panel-content-field">
          <label className="panel-content-label" htmlFor={`garden-day-icon-${day.id}`}>
            Ícone
          </label>
          <input
            id={`garden-day-icon-${day.id}`}
            type="text"
            value={form.icon ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
            placeholder="Ícone (ex.: 🌱)"
          />
        </div>
        <div className="panel-content-field">
          <label className="panel-content-label" htmlFor={`garden-day-message-${day.id}`}>
            Mensagem de incentivo
          </label>
          <textarea
            id={`garden-day-message-${day.id}`}
            value={form.encouragement_message ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, encouragement_message: e.target.value }))}
            rows={2}
            placeholder="Mensagem de incentivo padrão deste dia"
          />
        </div>
        <input
          type="date"
          value={form.activity_date}
          onChange={(e) => setForm((p) => ({ ...p, activity_date: e.target.value }))}
          required
        />
        {saveError && <p className="auth-error">{saveError}</p>}
        <div className="panel-content-row-actions">
          <button type="button" className="panel-content-action" onClick={handleCancel}>
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
})

/** Handle exposto por `ChallengeDetail` (Etapa T, estendido na Etapa U) —
 * permite ao ancestral perguntar, antes de recolher/trocar de desafio, se há
 * algo digitado que seria descartado (mensagem de incentivo ou edição de um
 * dia em andamento), sem precisar levantar esse estado local inteiro. */
export interface ChallengeDetailHandle {
  hasUnsavedIncentive: () => boolean
  /** Etapa U — algum `DayRow` deste desafio está em edição com valores não salvos? */
  hasUnsavedDayEdit: () => boolean
}

/** Painel expandido de um desafio: dias, participantes/progresso, publicar incentivo. */
const ChallengeDetail = forwardRef<
  ChallengeDetailHandle,
  {
    challenge: GardenChallenge
    api: ReturnType<typeof useGardenChallenges>
    onPublished?: () => void
  }
>(function ChallengeDetail({ challenge, api, onPublished }, ref) {
  const [tab, setTab] = useState<'dias' | 'progresso' | 'incentivo'>('dias')
  const [generating, setGenerating] = useState(false)
  const [genMessage, setGenMessage] = useState<string | null>(null)
  const [selectedDayId, setSelectedDayId] = useState('')
  const [incentiveMessage, setIncentiveMessage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<GardenIncentiveTemplateKey | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishMessage, setPublishMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  )
  /** Etapa U — handles de `DayRow` por dia (só os dias em edição têm algo a reportar),
   * usados por `hasUnsavedDayEdit` para perguntar antes de descartar uma edição de dia
   * em andamento. Ref (não state): não deve causar re-render. */
  const dayHandles = useRef<Record<string, DayRowHandle | null>>({})

  const days = api.daysByChallenge[challenge.id] ?? []
  const participants = api.participantsByChallenge[challenge.id] ?? []
  const completions = api.completionsByChallenge[challenge.id] ?? []
  /** Etapa X — erro de participantes tem prioridade (lista principal da
   * aba "Progresso"); se só conclusões falharem, usamos essa mensagem —
   * nunca as duas ao mesmo tempo (ver uso em `tab === 'progresso'`). */
  const progressError = api.participantsError[challenge.id] ?? api.completionsError[challenge.id] ?? null

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
    setSelectedTemplate(null)
    onPublished?.()
  }

  /**
   * Etapa T — trocar de dia reescreve `incentiveMessage` para o padrão do
   * novo dia (ou vazio) sem perguntar nada, então um texto digitado para o
   * dia atual, ainda não publicado, seria descartado em silêncio. Mesmo
   * mecanismo de confirmação (`window.confirm`) já usado em `handleGenerate`
   * e `applySuggestion`; cancelar mantém o dia e a mensagem atuais (o
   * `<select>` é controlado por `selectedDayId`, então volta a mostrar o
   * dia anterior sozinho).
   */
  function selectDay(id: string) {
    if (id === selectedDayId) return
    if (isDirtyIncentiveMessage(incentiveMessage, selectedDay?.encouragement_message)) {
      const confirmed = window.confirm(
        'Trocar de dia vai substituir o texto atual da mensagem de incentivo. Deseja continuar?',
      )
      if (!confirmed) return
    }
    setSelectedDayId(id)
    const day = days.find((d) => d.id === id)
    setIncentiveMessage(day?.encouragement_message ?? '')
  }

  /**
   * Os 6 templates (GARDEN_INCENTIVE_TEMPLATES) são só uma escolha de
   * ESTILO/tom de pré-visualização — nunca têm texto-modelo próprio
   * (ver GardenIncentiveTemplates.tsx), então trocar de template nunca
   * apaga o que a profissional já escreveu em `incentiveMessage`, e a
   * pré-visualização (abaixo) continua visível mesmo sem nenhum
   * template escolhido. Clicar no template já ativo o desmarca
   * (seleção única) — a pré-visualização só perde a cor da categoria.
   */
  function toggleTemplate(key: GardenIncentiveTemplateKey) {
    setSelectedTemplate((prev) => (prev === key ? null : key))
  }

  /**
   * Aplica uma sugestão da biblioteca (Etapa Q) ao campo de mensagem.
   * Escolher/consultar uma sugestão nunca publica nem troca o estilo —
   * só preenche `incentiveMessage`, que continua 100% editável. Se já
   * houver texto digitado (diferente da sugestão), pede confirmação
   * antes de substituir — mesmo mecanismo (`window.confirm`) já usado em
   * `handleGenerate` para a regeneração de dias; cancelar preserva o
   * texto original.
   */
  function applySuggestion(message: string) {
    if (incentiveMessage.trim() && incentiveMessage.trim() !== message.trim()) {
      const confirmed = window.confirm(
        'Isto vai substituir o texto atual da mensagem de incentivo por esta sugestão. Deseja continuar?',
      )
      if (!confirmed) return
    }
    setIncentiveMessage(message)
  }

  const selectedDay = days.find((d) => d.id === selectedDayId)

  useImperativeHandle(ref, () => ({
    hasUnsavedIncentive: () => isDirtyIncentiveMessage(incentiveMessage, selectedDay?.encouragement_message),
    hasUnsavedDayEdit: () => days.some((day) => dayHandles.current[day.id]?.hasUnsavedChanges()),
  }))

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
                  ref={(handle) => {
                    dayHandles.current[day.id] = handle
                  }}
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
          {api.progressLoading[challenge.id] ? (
            <p className="panel-content-muted">Carregando...</p>
          ) : progressError ? (
            // Etapa X — antes, uma falha ao carregar participantes/conclusões
            // renderizava a mesma coisa que "ninguém se inscreveu" (nenhum dos
            // dois tinha estado de erro próprio): a profissional não tinha
            // como distinguir "não há inscritos" de "não consegui verificar".
            // `progressError` prioriza o erro de participantes (lista
            // principal da aba); se só conclusões falharem, as contagens "X/Y
            // dias" de cada participante dependem diretamente dela, então
            // tratamos como falha da aba inteira — nunca duas mensagens.
            <>
              <p className="auth-error">
                Não foi possível carregar participantes e progresso deste desafio: {progressError}
              </p>
              <div className="panel-content-form-actions">
                <button
                  type="button"
                  className="panel-content-action"
                  onClick={() => api.fetchProgress(challenge.id)}
                >
                  Tentar novamente
                </button>
              </div>
            </>
          ) : participants.length === 0 ? (
            <p className="panel-content-roster-empty">Ninguém se inscreveu ainda.</p>
          ) : (
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
        <>
          {challenge.status !== 'published' && (
            <p className="panel-content-notice">Publique o desafio antes de enviar incentivos.</p>
          )}
          {api.daysLoading[challenge.id] ? (
            <p className="panel-content-muted">Carregando dias...</p>
          ) : api.daysError[challenge.id] ? (
            <p className="auth-error">
              Não foi possível carregar os dias deste desafio: {api.daysError[challenge.id]}
            </p>
          ) : days.length === 0 ? (
            <>
              <p className="panel-content-muted">
                Nenhum dia gerado ainda — gere os dias do desafio antes de publicar um incentivo.
              </p>
              <div className="panel-content-form-actions">
                <button type="button" className="panel-content-action" onClick={() => openTab('dias')}>
                  Ir para "Dias"
                </button>
              </div>
            </>
          ) : (
            <form className="panel-content-form" onSubmit={handlePublishIncentive}>
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
              <fieldset className="panel-content-field garden-incentive-fieldset">
                <legend className="panel-content-label">Estilo da mensagem (opcional)</legend>
                <div className="garden-incentive-picker">
                  {GARDEN_INCENTIVE_TEMPLATES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className={`garden-incentive-picker-option garden-incentive-template--${t.key}${
                        selectedTemplate === t.key ? ' garden-incentive-picker-option--active' : ''
                      }`}
                      onClick={() => toggleTemplate(t.key)}
                      aria-pressed={selectedTemplate === t.key}
                      title={t.hint}
                    >
                      <span aria-hidden="true">{t.emoji}</span> {t.eyebrow}
                      {selectedTemplate === t.key && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
                {selectedTemplate && (
                  <p className="panel-content-muted">{GARDEN_INCENTIVE_TEMPLATES_BY_KEY[selectedTemplate].hint}</p>
                )}
              </fieldset>
              {selectedTemplate ? (
                <GardenIncentiveMessageLibrary template={selectedTemplate} onApply={applySuggestion} />
              ) : (
                <p className="panel-content-muted">
                  Escolha um estilo acima para ver sugestões de mensagem dessa categoria.
                </p>
              )}
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
              {selectedDay && incentiveMessage.trim() && (
                <div className="panel-content-field">
                  <span className="panel-content-label">Pré-visualização</span>
                  <GardenIncentiveCard
                    template={selectedTemplate}
                    title={selectedDay.title}
                    message={incentiveMessage}
                  />
                </div>
              )}
              {publishMessage && (
                <p className={publishMessage.type === 'success' ? 'auth-success' : 'auth-error'}>
                  {publishMessage.text}
                </p>
              )}
              <div className="panel-content-form-actions">
                <button
                  type="submit"
                  className="panel-content-submit"
                  disabled={
                    publishing || challenge.status !== 'published' || !selectedDayId || !incentiveMessage.trim()
                  }
                >
                  {publishing ? 'Publicando...' : 'Publicar no feed'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  )
})

/**
 * Uma linha da lista de desafios (card recolhido + ChallengeDetail
 * expandido) — extraída para ser reaproveitada pelas duas seções
 * (Ativos/Arquivados, Etapa R) sem duplicar o JSX das ações.
 */
function ChallengeRow({
  challenge,
  expanded,
  busyAction,
  actionError,
  onToggleExpand,
  onStartEdit,
  onAction,
  onDetailRef,
  api,
  onPublished,
}: {
  challenge: GardenChallenge
  expanded: boolean
  busyAction: 'publish' | 'archive' | 'delete' | null
  /** Etapa AD — erro da última ação (publish/archive/delete) deste desafio especificamente, não do painel inteiro (ver `actionErrorByChallenge` no ancestral). `null` = sem erro para este desafio. */
  actionError: string | null
  onToggleExpand: (challenge: GardenChallenge) => void
  onStartEdit: (challenge: GardenChallenge) => void
  onAction: (action: 'publish' | 'archive' | 'delete', challenge: GardenChallenge) => void
  /** Etapa T — registra/desregistra o handle do ChallengeDetail desta linha no mapa do ancestral (ver `toggleExpand`). */
  onDetailRef: (handle: ChallengeDetailHandle | null) => void
  api: ReturnType<typeof useGardenChallenges>
  onPublished?: () => void
}) {
  return (
    <div className="panel-events-item panel-garden-item">
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
          <button type="button" className="panel-content-action" onClick={() => onToggleExpand(challenge)}>
            {expanded ? 'Fechar' : 'Gerenciar'}
          </button>
          {challenge.status === 'draft' && (
            <>
              <button
                type="button"
                className="panel-content-action"
                onClick={() => onStartEdit(challenge)}
                disabled={busyAction !== null}
              >
                Editar
              </button>
              <button
                type="button"
                className="panel-content-action"
                onClick={() => onAction('publish', challenge)}
                disabled={busyAction !== null}
              >
                {busyAction === 'publish' ? 'Publicando...' : 'Publicar'}
              </button>
              <button
                type="button"
                className="panel-content-action panel-content-action--delete"
                onClick={() => onAction('delete', challenge)}
                disabled={busyAction !== null}
              >
                {busyAction === 'delete' ? 'Excluindo...' : 'Excluir'}
              </button>
            </>
          )}
          {challenge.status !== 'archived' && (
            <button
              type="button"
              className="panel-content-action"
              onClick={() => onAction('archive', challenge)}
              disabled={busyAction !== null}
            >
              {busyAction === 'archive' ? 'Arquivando...' : 'Arquivar'}
            </button>
          )}
        </div>
      </div>

      {/* Etapa AD — associada visualmente a ESTE desafio (dentro da sua própria
       * linha), não mais a uma mensagem única no topo da lista inteira: com
       * vários desafios na tela, a profissional não tinha como saber a qual
       * deles um erro de publicar/arquivar/excluir se referia. `role="alert"`
       * garante que leitores de tela anunciem o erro no momento em que ele
       * aparece, mesmo sem o foco estar nesta linha. */}
      {actionError && (
        <p className="auth-error" role="alert">
          {actionError}
        </p>
      )}

      {expanded && (
        <ChallengeDetail ref={onDetailRef} challenge={challenge} api={api} onPublished={onPublished} />
      )}
    </div>
  )
}

export function GardenChallengeManager({ communityId, profileId, onPublished }: GardenChallengeManagerProps) {
  const api = useGardenChallenges(communityId)
  const { challenges, loading, error } = api
  // Organização dos desafios (Etapa R): arquivados saem do meio da lista
  // ativa e ganham sua própria seção (divisor "Arquivados"), sempre em
  // `created_at DESC` (ordem já vinda de useGardenChallenges) dentro de
  // cada grupo. IMPORTANTE (Etapa S — corrige regressão da Etapa R):
  // `orderedChallenges` é usado para renderizar TODAS as linhas num único
  // `.map()`/container — nunca dois `.map()`s em blocos JSX separados
  // para ativos x arquivados. Se fossem dois `.map()`s/containers
  // diferentes, arquivar um desafio que está expandido (ChallengeDetail
  // aberto, com mensagem de incentivo/estilo em composição) faria o
  // React desmontar a linha de um container e remontá-la do zero no
  // outro — perdendo silenciosamente tudo que a profissional estava
  // digitando. Com um único `.map()`, a linha só muda de posição dentro
  // do MESMO container e o React preserva o estado pela `key`.
  const activeChallenges = challenges.filter((c) => c.status !== 'archived')
  const archivedChallenges = challenges.filter((c) => c.status === 'archived')
  const orderedChallenges = [...activeChallenges, ...archivedChallenges]

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  /**
   * Etapa AD — erro da última ação (publish/archive/delete) POR DESAFIO
   * (`Record<challengeId, mensagem | null>`), não um valor único para o
   * painel inteiro. Antes, um erro ao publicar/arquivar/excluir QUALQUER
   * desafio aparecia numa única mensagem no topo de "Desafios da
   * comunidade" — com vários desafios na lista, nada a associava
   * visualmente a qual deles o erro pertencia, e ela permanecia visível
   * mesmo depois de outra ação (bem-sucedida ou não) em OUTRO desafio.
   * Mesmo padrão de `actionBusyByChallenge` abaixo: cada desafio só lê/
   * limpa a própria entrada, então a ação de um nunca afeta o erro
   * (nem o estado de "em andamento") mostrado para outro.
   */
  const [actionErrorByChallenge, setActionErrorByChallenge] = useState<Record<string, string | null>>(
    {},
  )
  /**
   * Etapa AC (Finding 4) — qual ação (publish/archive/delete) está em
   * andamento, POR DESAFIO (`Record<challengeId, ação | null>`), não um
   * valor único para todo o painel. Antes, um `{ id, type }` único
   * significava que iniciar uma ação no desafio B enquanto A ainda estava
   * em voo SOBRESCREVIA o rastreamento de A — quando QUALQUER uma das duas
   * terminasse primeiro, `setActionBusy(null)` liberava as DUAS linhas de
   * uma vez, mesmo que a outra ainda estivesse em andamento. Com uma
   * entrada por `challenge.id`, cada ação só lê/limpa a SUA própria chave —
   * a conclusão de uma nunca libera a de outra. Mesmo papel de
   * `daysError`/`participantsError` (Record por id, `null` = sem ação em
   * andamento), evita duplicar estilo de estado dentro do mesmo arquivo.
   */
  const [actionBusyByChallenge, setActionBusyByChallenge] = useState<
    Record<string, 'publish' | 'archive' | 'delete' | null>
  >({})
  /** Etapa T — handles de ChallengeDetail por desafio (só o expandido tem um não-nulo), usados por `toggleExpand` para perguntar antes de descartar uma mensagem de incentivo em composição. Ref (não state): não deve causar re-render. */
  const detailHandles = useRef<Record<string, ChallengeDetailHandle | null>>({})
  /**
   * Etapa AB (Finding 3) — espelho "ao vivo" de `editingId`, sincronizado a
   * cada render via o efeito abaixo. `handleAction('delete', ...)` só pode
   * decidir se deve encerrar o formulário de edição DEPOIS de um `await`
   * (quando `deleteChallenge` resolve) — nesse ponto, ler `editingId`
   * diretamente leria o valor CAPTURADO no fechamento de quando a exclusão
   * foi disparada, não o valor atual (ex.: se a profissional trocasse para
   * editar outro desafio enquanto a exclusão ainda estivesse em voo, o
   * fechamento antigo encerraria por engano a edição nova). `editingIdRef`
   * sempre reflete o estado mais recente no momento em que é lido.
   */
  const editingIdRef = useRef<string | null>(null)
  useEffect(() => {
    editingIdRef.current = editingId
  }, [editingId])

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

  /**
   * Etapa T — antes, clicar em "Editar" em QUALQUER desafio sobrescrevia
   * `form`/`editingId` sem perguntar nada, descartando em silêncio tanto um
   * rascunho de "Criar desafio" em andamento (`editingId` nulo) quanto
   * edições não salvas de outro desafio (`editingId` de outro id). Mesmo
   * mecanismo de confirmação já usado nas outras proteções desta etapa.
   */
  function startEdit(challenge: GardenChallenge) {
    const editingChallenge = editingId ? challenges.find((c) => c.id === editingId) : undefined
    const baseline = editingChallenge ? formFromChallenge(editingChallenge) : EMPTY_FORM

    if (JSON.stringify(form) !== JSON.stringify(baseline)) {
      const confirmed = window.confirm(
        'Há dados não salvos no formulário de desafio. Trocar agora vai descartá-los. Deseja continuar?',
      )
      if (!confirmed) return
    }

    setEditingId(challenge.id)
    setForm(formFromChallenge(challenge))
    setFormError(null)
  }

  function toggleExpand(challenge: GardenChallenge) {
    const next = expandedId === challenge.id ? null : challenge.id
    const currentHandle = expandedId ? detailHandles.current[expandedId] : null

    // Etapa T — isto cobre TANTO fechar o desafio expandido (clicar em
    // "Fechar") QUANTO trocar para um desafio diferente (clicar em
    // "Gerenciar" em outra linha): nos dois casos o `ChallengeDetail` hoje
    // expandido (se houver) vai desmontar. Sem isto, uma mensagem de
    // incentivo digitada e ainda não publicada seria descartada em
    // silêncio — mesmo mecanismo de confirmação já usado em
    // `handleGenerate`/`applySuggestion`/`selectDay`.
    if (currentHandle?.hasUnsavedIncentive()) {
      const confirmed = window.confirm(
        'Há uma mensagem de incentivo digitada e não publicada neste desafio. Fechar agora vai descartá-la. Deseja continuar?',
      )
      if (!confirmed) return
    }

    // Etapa U — proteção independente da de cima: um `DayRow` em edição com
    // valores não salvos também seria descartado em silêncio ao desmontar o
    // `ChallengeDetail`. Checada sempre, mesmo se a confirmação da mensagem
    // de incentivo já foi aceita acima — nenhuma das duas proteções pode ser
    // pulada só porque a outra já foi respondida.
    if (currentHandle?.hasUnsavedDayEdit()) {
      const confirmed = window.confirm(
        'Há uma edição de dia não salva neste desafio. Fechar agora vai descartá-la. Deseja continuar?',
      )
      if (!confirmed) return
    }

    setExpandedId(next)
    if (next) {
      api.fetchDays(challenge.id)
    }
  }

  async function handleAction(action: 'publish' | 'archive' | 'delete', challenge: GardenChallenge) {
    // Excluir é irreversível (e remove o desafio da lista de uma vez) — diferente
    // de arquivar/publicar, que não perdem dados. Mesmo mecanismo de confirmação
    // (`window.confirm`) já usado em `handleGenerate` para a regeneração de dias.
    if (action === 'delete') {
      const confirmed = window.confirm(`Excluir o desafio "${challenge.title}"? Essa ação não pode ser desfeita.`)
      if (!confirmed) return
    }

    // Etapa AC (Cenário D) — backstop contra uma segunda ação concorrente
    // sobre o MESMO desafio: os botões da própria linha já ficam
    // desabilitados enquanto uma ação está em andamento (ver `busyAction`
    // em ChallengeRow), mas essa checagem cobre a janela estreita entre um
    // clique e o re-render que desabilita o botão — nunca dispara a mesma
    // RPC (ou outra, sobre o mesmo desafio) duas vezes em paralelo.
    if (actionBusyByChallenge[challenge.id]) return

    // Etapa AD — limpa só o erro DESTE desafio ao iniciar uma nova ação
    // sobre ele (nunca o de outro desafio, que `actionErrorByChallenge`
    // mantém numa chave separada).
    setActionErrorByChallenge((prev) => ({ ...prev, [challenge.id]: null }))
    setActionBusyByChallenge((prev) => ({ ...prev, [challenge.id]: action }))
    const result =
      action === 'publish'
        ? await api.publishChallenge(challenge.id)
        : action === 'archive'
          ? await api.archiveChallenge(challenge.id)
          : await api.deleteChallenge(challenge.id)

    // Etapa AC (Finding 4) — libera só a entrada DESTE desafio (nunca um
    // valor único para o painel inteiro): se uma ação em outro desafio
    // começou enquanto esta estava em voo, ela continua intacta depois
    // desta terminar. Roda incondicionalmente aqui (equivalente a um
    // `finally`) — tanto em sucesso quanto no `{error}` abaixo — porque
    // `publishChallenge`/`archiveChallenge`/`deleteChallenge` seguem o
    // mesmo contrato `{ error }` de todo write deste hook e nunca lançam
    // (mesmo raciocínio já usado nos demais handlers deste arquivo).
    setActionBusyByChallenge((prev) => ({ ...prev, [challenge.id]: null }))

    if (result.error) {
      setActionErrorByChallenge((prev) => ({ ...prev, [challenge.id]: result.error }))
      return
    }

    /**
     * Etapa AB (Finding 3) — excluir com sucesso o desafio que está aberto
     * no formulário "Editar desafio" deixava `editingId`/`form` apontando
     * para um registro que não existe mais: "Salvar desafio" chamaria
     * `updateChallenge` contra um id inexistente — um `.update().eq('id', ...)`
     * sem linha correspondente não é um `{error}` no Supabase/PostgREST, então
     * a profissional veria "sucesso" sem nada ter sido realmente salvo.
     *
     * A checagem usa `editingIdRef` (o espelho ao vivo, não o `editingId`
     * capturado no fechamento desta chamada) porque, enquanto
     * `deleteChallenge` estava em voo, a profissional pode ter começado a
     * editar OUTRO desafio — só encerra o formulário se o editingId ATUAL
     * (não um antigo, de antes do await) ainda for o do desafio que acabou
     * de ser excluído. Isso evita encerrar por engano a edição de um
     * desafio diferente iniciada nesse intervalo (Cenário B), sem precisar
     * presumir nada sobre o Supabase.
     */
    if (action === 'delete' && editingIdRef.current === challenge.id) {
      resetForm()
    }
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
        {!loading && error && (
          // Etapa AA (Finding 1) — faltava uma forma de tentar de novo depois
          // de uma falha ao carregar os desafios: antes a tela ficava presa
          // nessa mensagem para sempre, sem nenhum botão. Mesmo padrão já
          // usado em GardenMemberView.tsx para o erro equivalente do lado da
          // participante (`api.refresh` é o mesmo `fetchChallenges`).
          <>
            <p className="auth-error">{error}</p>
            <button type="button" className="panel-content-action" onClick={() => api.refresh()}>
              Tentar novamente
            </button>
          </>
        )}
        {!loading && !error && challenges.length === 0 && (
          <EmptyState message="Nenhum desafio criado ainda." />
        )}

        {!loading && !error && challenges.length > 0 && (
          <div className="panel-events-list">
            {orderedChallenges.map((challenge, index) => (
              <Fragment key={challenge.id}>
                {index === activeChallenges.length && archivedChallenges.length > 0 && (
                  <h3 className="panel-events-eyebrow">Arquivados</h3>
                )}
                <ChallengeRow
                  challenge={challenge}
                  expanded={expandedId === challenge.id}
                  busyAction={actionBusyByChallenge[challenge.id] ?? null}
                  actionError={actionErrorByChallenge[challenge.id] ?? null}
                  onToggleExpand={toggleExpand}
                  onStartEdit={startEdit}
                  onAction={handleAction}
                  onDetailRef={(handle) => {
                    detailHandles.current[challenge.id] = handle
                  }}
                  api={api}
                  onPublished={onPublished}
                />
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
