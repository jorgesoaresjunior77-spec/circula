import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ProfileOverview } from '../types/profile'

interface ViewedProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  interests: string[]
  bio: string | null
  city: string | null
}

interface ProfileCardProps {
  profileId: string
  onClose: () => void
  /** Quando definido, mostra "Enviar mensagem" (abre/inicia a conversa). */
  onStartConversation?: (profileId: string) => void
}

const OVERVIEW_LABELS: { key: keyof ProfileOverview; label: string }[] = [
  { key: 'posts', label: 'publicações' },
  { key: 'comments', label: 'comentários' },
  { key: 'circles', label: 'círculos' },
  { key: 'challenges', label: 'desafios' },
  { key: 'content', label: 'conteúdos' },
  { key: 'events', label: 'eventos' },
]

export function ProfileCard({ profileId, onClose, onStartConversation }: ProfileCardProps) {
  const [profile, setProfile] = useState<ViewedProfile | null>(null)
  const [overview, setOverview] = useState<ProfileOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setOverview(null)

    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, interests, bio, city')
      .eq('id', profileId)
      .single()
      .then(({ data, error: fetchError }) => {
        if (!active) return
        if (fetchError) {
          setError('Não foi possível carregar esse perfil.')
          setProfile(null)
        } else {
          setProfile(data)
        }
        setLoading(false)
      })

    supabase
      .rpc('profile_overview', { p_profile_id: profileId })
      .then(({ data }) => {
        if (!active) return
        if (data && typeof data === 'object') setOverview(data as ProfileOverview)
      })

    return () => {
      active = false
    }
  }, [profileId])

  return (
    <section className="community-card">
      <button type="button" className="auth-link" onClick={onClose}>
        Fechar
      </button>

      {loading && <p>Carregando perfil...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && profile && (
        <>
          <div className="profile-header">
            <div className="profile-avatar">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                <span>{(profile.full_name ?? 'U').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h2>{profile.full_name ?? 'Participante'}</h2>
              {profile.city && <p className="profile-city">{profile.city}</p>}
            </div>
          </div>

          {profile.bio && <p className="profile-bio">{profile.bio}</p>}

          {profile.interests.length > 0 && (
            <div className="interest-tags">
              {profile.interests.map((interest) => (
                <span key={interest} className="interest-tag">
                  {interest}
                </span>
              ))}
            </div>
          )}

          {overview && (
            <div className="profile-overview">
              {OVERVIEW_LABELS.filter(({ key }) => overview[key] > 0).map(({ key, label }) => (
                <span key={key} className="profile-overview-item">
                  <strong>{overview[key]}</strong> {label}
                </span>
              ))}
            </div>
          )}

          {onStartConversation && (
            <button
              type="button"
              className="btn btn-primary profile-message-button"
              onClick={() => onStartConversation(profileId)}
            >
              Enviar mensagem
            </button>
          )}
        </>
      )}
    </section>
  )
}
