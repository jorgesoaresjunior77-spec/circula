import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CommunityMoodMessage, MoodLevel } from '../types/mood'
import { MOOD_DEFAULT_MESSAGE, MOOD_META, MOOD_ORDER } from '../types/mood'

// Fase 3 — a Nutri pode SUBSTITUIR a mensagem acolhedora de cada humor
// pela versão da própria comunidade (community_mood_messages, 1 por
// humor). Sem override ativo, a Home usa a mensagem padrão do sistema.
// Não expõe nenhum humor individual — só o texto das mensagens.
//
// Redesign editorial: blocos planos, sem border-top. Nenhuma lógica
// (fetchRows / save / resetToDefault / supabase / drafts / busyMood)
// mudou — só markup/classes.

interface MoodMessageManagerProps {
  communityId: string
  profileId: string
}

const MESSAGE_SELECT =
  'id,community_id,mood,message,is_active,created_by,created_at,updated_at'

export function MoodMessageManager({ communityId, profileId }: MoodMessageManagerProps) {
  const [rows, setRows] = useState<CommunityMoodMessage[]>([])
  const [drafts, setDrafts] = useState<Record<MoodLevel, string>>(() => ({
    very_sad: '',
    sad: '',
    neutral: '',
    happy: '',
    very_happy: '',
  }))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyMood, setBusyMood] = useState<MoodLevel | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('community_mood_messages')
      .select(MESSAGE_SELECT)
      .eq('community_id', communityId)

    if (fetchError) {
      setError(fetchError.message)
      setRows([])
      setLoading(false)
      return
    }

    const list = (data as CommunityMoodMessage[] | null) ?? []
    setRows(list)
    setDrafts((prev) => {
      const next = { ...prev }
      for (const mood of MOOD_ORDER) {
        const found = list.find((r) => r.mood === mood)
        next[mood] = found?.message ?? ''
      }
      return next
    })
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  function overrideFor(mood: MoodLevel): CommunityMoodMessage | undefined {
    return rows.find((r) => r.mood === mood)
  }

  async function save(mood: MoodLevel) {
    const text = drafts[mood].trim()
    if (!text) return
    setBusyMood(mood)
    setError(null)
    const { error: upsertError } = await supabase.from('community_mood_messages').upsert(
      {
        community_id: communityId,
        mood,
        message: text,
        is_active: true,
        created_by: profileId,
      },
      { onConflict: 'community_id,mood' },
    )
    setBusyMood(null)
    if (upsertError) {
      setError('Não foi possível salvar agora. Tente novamente.')
      return
    }
    await fetchRows()
  }

  async function resetToDefault(mood: MoodLevel) {
    const existing = overrideFor(mood)
    if (!existing) return
    setBusyMood(mood)
    setError(null)
    const { error: delError } = await supabase
      .from('community_mood_messages')
      .delete()
      .eq('id', existing.id)
    setBusyMood(null)
    if (delError) {
      setError('Não foi possível voltar ao padrão agora. Tente novamente.')
      return
    }
    setDrafts((prev) => ({ ...prev, [mood]: '' }))
    await fetchRows()
  }

  return (
    <section className="panel-content-block panel-content-mood">
      <div className="panel-content-block-head">
        <h3 className="panel-content-eyebrow">Mensagens de "Como você está hoje?"</h3>
      </div>
      <p className="panel-content-section-lede">
        Estas mensagens aparecem para a mulher depois que ela escolhe um rosto na Home. Deixe em
        branco para usar a mensagem padrão do Círcula.
      </p>

      {loading && <p className="panel-content-muted">Carregando mensagens…</p>}
      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && (
        <div className="panel-content-mood-list">
          {MOOD_ORDER.map((mood) => {
            const has = !!overrideFor(mood)
            return (
              <div key={mood} className="panel-content-mood-item">
                <label className="panel-content-mood-head" htmlFor={`mood-msg-${mood}`}>
                  <span className="panel-content-mood-emoji" aria-hidden="true">
                    {MOOD_META[mood].emoji}
                  </span>
                  <span className="panel-content-mood-label">{MOOD_META[mood].label}</span>
                  <span className="panel-content-mood-flag">
                    {has ? 'mensagem da comunidade' : 'mensagem padrão do sistema'}
                  </span>
                </label>
                <textarea
                  id={`mood-msg-${mood}`}
                  rows={3}
                  value={drafts[mood]}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [mood]: e.target.value }))}
                  placeholder={MOOD_DEFAULT_MESSAGE[mood]}
                />
                <div className="panel-content-row-actions">
                  {has && (
                    <button
                      type="button"
                      className="panel-content-action"
                      onClick={() => resetToDefault(mood)}
                      disabled={busyMood === mood}
                    >
                      Voltar ao padrão
                    </button>
                  )}
                  <button
                    type="button"
                    className="panel-content-action panel-content-action--primary"
                    onClick={() => save(mood)}
                    disabled={busyMood === mood || !drafts[mood].trim()}
                  >
                    {busyMood === mood ? 'Salvando…' : 'Salvar mensagem'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
