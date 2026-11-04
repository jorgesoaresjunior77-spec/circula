import { useEffect, useRef, useState } from 'react'
import type { OnboardingAnswers, Profile, ProfileUpdateInput } from '../types/profile'
import {
  ONBOARDING_CURRENT_MOMENT_OPTIONS,
  ONBOARDING_INTEREST_TOPICS,
  ONBOARDING_PARTICIPATION_OPTIONS,
} from '../lib/onboardingOptions'

// Etapa 8 (evolução/experiência/gamificação) — onboarding de boas-vindas,
// mostrado uma vez (Dashboard.tsx gateia por
// `profile.onboarding_completed_at === null` — nunca quando é
// `undefined`, ver nota em types/profile.ts). Perguntas de resposta
// rápida (clicáveis), nada obrigatório — "Pular" sempre disponível, em
// cada passo e no rodapé. As respostas podem ser editadas depois no
// Perfil (texto livre/interesses já são editáveis lá; as demais, por
// ora, só aqui — ver limitação no relatório da sessão).
//
// "Sobre seus interesses" grava em `profiles.interests` (reaproveita a
// MESMA coluna de "Um pouco sobre mim", ABOUT_ME_OPTIONS) — nunca
// duplica estrutura. As demais respostas vão em `onboarding_answers`
// (jsonb), só para a Profissional consultar (Etapa 8.2) — nunca
// exibidas publicamente a outras participantes.

interface OnboardingProps {
  profile: Profile
  onUpdateProfile: (input: ProfileUpdateInput) => Promise<{ error: string | null }>
  /** `completed` = false quando a pessoa pulou o onboarding (não haverá tour). */
  onDone: (completed: boolean) => void
  /** Etapa 9 — ao concluir (nunca ao pular), oferece iniciar o tour. */
  onStartTour: () => void
}

function toggleInArray(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export function Onboarding({ profile, onUpdateProfile, onDone, onStartTour }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const [preferredName, setPreferredName] = useState('')
  const [currentMoment, setCurrentMoment] = useState('')
  const [interestTopics, setInterestTopics] = useState<string[]>([])
  const [participation, setParticipation] = useState<string[]>([])
  const [whyJoined, setWhyJoined] = useState('')
  const [expectations, setExpectations] = useState('')
  const [saving, setSaving] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  const totalSteps = 6 // 0 boas-vindas · 1 nome · 2 momento · 3 interesses · 4 participação · 5 Círcula+final

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [step])

  async function persist(completed: boolean) {
    setSaving(true)
    const answers: OnboardingAnswers = {
      ...(preferredName.trim() && { preferred_name: preferredName.trim() }),
      ...(currentMoment && { current_moment: currentMoment }),
      ...(participation.length > 0 && { participation_style: participation }),
      ...(whyJoined.trim() && { why_joined: whyJoined.trim() }),
      ...(expectations.trim() && { expectations: expectations.trim() }),
    }

    const patch: ProfileUpdateInput = {
      onboarding_answers: answers,
      onboarding_completed_at: new Date().toISOString(),
    }
    if (interestTopics.length > 0) {
      const merged = new Set([...profile.interests, ...interestTopics])
      patch.interests = [...merged]
    }

    await onUpdateProfile(patch)
    setSaving(false)
    onDone(completed)
    if (completed) onStartTour()
  }

  function handleSkipAll() {
    void persist(false)
  }

  function goNext() {
    if (step < totalSteps - 1) setStep(step + 1)
    else void persist(true)
  }

  function goBack() {
    if (step > 0) setStep(step - 1)
  }

  return (
    <div className="ig-modal-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Boas-vindas ao Círcula"
      >
        <div className="onboarding-modal-progress" aria-hidden="true">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span key={i} className={`onboarding-dot${i <= step ? ' onboarding-dot--active' : ''}`} />
          ))}
        </div>

        <div className="onboarding-modal-body">
          {step === 0 && (
            <>
              <h2 className="onboarding-title">Que bom ter você aqui! 🌱</h2>
              <p className="onboarding-text">
                Antes de começar, queremos te conhecer um pouco melhor — leva menos de um
                minuto, e cada pergunta é opcional. Vamos?
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="onboarding-title">Como prefere ser chamada?</h2>
              <input
                data-autofocus
                type="text"
                className="onboarding-input"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="Ex.: Ju, Bia, Dona Marta..."
              />
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="onboarding-title">Como descreveria seu momento atual?</h2>
              <div className="onboarding-options">
                {ONBOARDING_CURRENT_MOMENT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    data-autofocus={option === ONBOARDING_CURRENT_MOMENT_OPTIONS[0] ? true : undefined}
                    className={`onboarding-chip${currentMoment === option ? ' onboarding-chip--active' : ''}`}
                    onClick={() => setCurrentMoment(currentMoment === option ? '' : option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="onboarding-title">Quais assuntos despertam seu interesse?</h2>
              <p className="onboarding-text">Pode marcar quantos quiser.</p>
              <div className="onboarding-options">
                {ONBOARDING_INTEREST_TOPICS.map((option, i) => (
                  <button
                    key={option}
                    type="button"
                    data-autofocus={i === 0 ? true : undefined}
                    className={`onboarding-chip${interestTopics.includes(option) ? ' onboarding-chip--active' : ''}`}
                    onClick={() => setInterestTopics((prev) => toggleInArray(prev, option))}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="onboarding-title">Como você gosta de participar?</h2>
              <div className="onboarding-options">
                {ONBOARDING_PARTICIPATION_OPTIONS.map((option, i) => (
                  <button
                    key={option}
                    type="button"
                    data-autofocus={i === 0 ? true : undefined}
                    className={`onboarding-chip${participation.includes(option) ? ' onboarding-chip--active' : ''}`}
                    onClick={() => setParticipation((prev) => toggleInArray(prev, option))}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="onboarding-title">Por último…</h2>
              <label htmlFor="onboarding-why" className="onboarding-label">
                O que fez você entrar na comunidade?
              </label>
              <textarea
                data-autofocus
                id="onboarding-why"
                className="onboarding-textarea"
                value={whyJoined}
                onChange={(e) => setWhyJoined(e.target.value)}
                rows={2}
              />
              <label htmlFor="onboarding-expect" className="onboarding-label">
                O que espera encontrar aqui?
              </label>
              <textarea
                id="onboarding-expect"
                className="onboarding-textarea"
                value={expectations}
                onChange={(e) => setExpectations(e.target.value)}
                rows={2}
              />
            </>
          )}
        </div>

        <div className="onboarding-modal-actions">
          <button type="button" className="auth-link" onClick={handleSkipAll} disabled={saving}>
            Pular
          </button>
          <div className="onboarding-modal-actions-nav">
            {step > 0 && (
              <button type="button" className="panel-content-action" onClick={goBack} disabled={saving}>
                Voltar
              </button>
            )}
            <button type="button" className="onboarding-next" onClick={goNext} disabled={saving}>
              {saving ? 'Salvando…' : step === totalSteps - 1 ? 'Concluir' : 'Avançar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
