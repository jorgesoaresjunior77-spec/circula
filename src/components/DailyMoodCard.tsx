import { useEffect, useState } from 'react'
import type { MoodLevel } from '../types/mood'
import { MOOD_META, MOOD_ORDER } from '../types/mood'
import { useDailyMood } from '../hooks/useDailyMood'

// Fase 3 — "Como você está hoje?"
//
// Card fixo no topo da Home. 5 rostos, do triste ao super feliz. Ao
// escolher, aparece uma mensagem acolhedora e positiva (padrão do
// sistema ou a versão da comunidade, se a Nutri tiver cadastrado).
// Pode trocar o humor durante o dia. Enquadramento de bem-estar, NUNCA
// clínico. O registro é PRIVADO: só a própria usuária vê.

interface DailyMoodCardProps {
  profileId: string
  communityId: string
}

export function DailyMoodCard({ profileId, communityId }: DailyMoodCardProps) {
  const { todayMood, hasAnswered, loading, saving, error, messageFor, setMood } = useDailyMood(
    profileId,
    communityId,
  )

  // Seleção local: reflete o humor salvo assim que ele chega, e permite
  // mostrar a mensagem na hora do clique mesmo antes da persistência.
  const [selected, setSelected] = useState<MoodLevel | null>(null)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    if (todayMood) setSelected(todayMood)
  }, [todayMood])

  async function choose(mood: MoodLevel) {
    setSelected(mood)
    setSaveError(false)
    const { error: opError } = await setMood(mood)
    if (opError) setSaveError(true)
  }

  const shown = selected ?? todayMood

  return (
    <section className="mood-card" aria-labelledby="mood-card-title">
      <h3 id="mood-card-title" className="mood-card-title">
        Como você está hoje?
      </h3>
      <p className="mood-card-hint">É só um carinho com você. Fica entre você e o Círcula 🤍</p>

      <div className="mood-options" role="group" aria-label="Escolha como você está hoje">
        {MOOD_ORDER.map((mood) => {
          const meta = MOOD_META[mood]
          const isOn = shown === mood
          return (
            <button
              key={mood}
              type="button"
              className={`mood-option${isOn ? ' mood-option--on' : ''}`}
              aria-pressed={isOn}
              disabled={saving}
              onClick={() => choose(mood)}
            >
              <span className="mood-option-face" aria-hidden="true">
                {meta.emoji}
              </span>
              <span className="mood-option-label">{meta.label}</span>
            </button>
          )
        })}
      </div>

      {loading && !shown && <p className="mood-card-status">Carregando…</p>}

      {shown && (
        <div className="mood-message" role="status">
          {hasAnswered && !saveError && (
            <p className="mood-message-tag">
              Você registrou hoje: {MOOD_META[shown].emoji} {MOOD_META[shown].label}
            </p>
          )}
          <p className="mood-message-text">{messageFor(shown)}</p>
          {saveError && (
            <p className="mood-card-softnote">
              Não foi possível guardar agora — mas fica aqui o recado para você. Tente de novo mais
              tarde.
            </p>
          )}
        </div>
      )}

      {error && !shown && (
        <p className="mood-card-softnote">Não foi possível carregar agora. Tente recarregar.</p>
      )}
    </section>
  )
}
