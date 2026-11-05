import type { OnboardingAnswers } from '../types/profile'

// Mostra o que a participante respondeu no começo (onboarding).
const ROWS: { key: keyof OnboardingAnswers; label: string }[] = [
  { key: 'preferred_name', label: 'Como gosto de ser chamada' },
  { key: 'current_moment', label: 'Meu momento agora' },
  { key: 'participation_style', label: 'Como quero participar' },
  { key: 'why_joined', label: 'Por que entrei no Círcula' },
  { key: 'expectations', label: 'O que espero' },
]

export function OnboardingAnswersView({ answers }: { answers: OnboardingAnswers | null }) {
  if (!answers) return null
  const rows = ROWS.map(({ key, label }) => {
    const v = answers[key]
    const text = Array.isArray(v) ? v.join(', ') : (v ?? '')
    return text ? { label, text } : null
  }).filter((r): r is { label: string; text: string } => r !== null)
  if (rows.length === 0) return null
  return (
    <dl className="profile-answers">
      {rows.map((r) => (
        <div key={r.label}>
          <dt>{r.label}</dt>
          <dd>{r.text}</dd>
        </div>
      ))}
    </dl>
  )
}
