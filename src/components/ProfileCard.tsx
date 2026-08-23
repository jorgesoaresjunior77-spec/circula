import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface ViewedProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  interests: string[]
}

interface ProfileCardProps {
  profileId: string
  onClose: () => void
}

export function ProfileCard({ profileId, onClose }: ProfileCardProps) {
  const [profile, setProfile] = useState<ViewedProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, interests')
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
            <h2>{profile.full_name ?? 'Participante'}</h2>
          </div>

          {profile.interests.length > 0 && (
            <div className="interest-tags">
              {profile.interests.map((interest) => (
                <span key={interest} className="interest-tag">
                  {interest}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
