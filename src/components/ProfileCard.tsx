import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ProfileOverview } from '../types/profile'
import { ABOUT_ME_OPTIONS } from '../lib/aboutMeOptions'
import { ProfileGallery } from './ProfileGallery'

interface ViewedProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  interests: string[]
  bio: string | null
  city: string | null
  gallery_photos: string[]
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
      .select('id, full_name, avatar_url, interests, bio, city, gallery_photos')
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
    <section className="community-card community-card--profile">
      <button type="button" className="auth-link" onClick={onClose}>
        Fechar
      </button>

      <p className="profile-eyebrow">Perfil</p>

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
            <div className="profile-identity">
              <h2>{profile.full_name ?? 'Participante'}</h2>
              {profile.city && <p className="profile-city">{profile.city}</p>}
            </div>
          </div>

          {profile.bio && <p className="profile-bio">{profile.bio}</p>}

          {/* Item 9 — "Um pouco sobre mim": mesma regra de visibilidade
              de sempre (RLS de `profiles`, já aplicada na query acima) —
              aqui só separa visualmente os itens da lista sugerida dos
              interesses em texto livre. */}
          {(() => {
            const aboutMe = ABOUT_ME_OPTIONS.filter((option) =>
              profile.interests.includes(option),
            )
            return (
              aboutMe.length > 0 && (
                <div className="profile-about-me">
                  <p className="profile-section-label">Um pouco sobre ela</p>
                  <div className="interest-tags interest-tags--view">
                    {aboutMe.map((item) => (
                      <span key={item} className="interest-tag">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )
            )
          })()}

          {(() => {
            const freeform = profile.interests.filter(
              (interest) => !(ABOUT_ME_OPTIONS as readonly string[]).includes(interest),
            )
            return (
              freeform.length > 0 && (
                <div className="interest-tags interest-tags--view">
                  {freeform.map((interest) => (
                    <span key={interest} className="interest-tag">
                      {interest}
                    </span>
                  ))}
                </div>
              )
            )
          })()}

          {/* Item 10 — galeria (só leitura): visível se houver fotos,
              mesma RLS de `profiles` de sempre — nada novo de permissão. */}
          {profile.gallery_photos.length > 0 && (
            <div className="profile-gallery-section">
              <p className="profile-section-label">Fotos</p>
              <ProfileGallery photos={profile.gallery_photos} />
            </div>
          )}

          {overview && (
            <>
              <p className="profile-overview-heading">Atividade no Círcula</p>
              <div className="profile-overview">
                {OVERVIEW_LABELS.filter(({ key }) => overview[key] > 0).map(({ key, label }) => (
                  <div key={key} className="profile-overview-item">
                    <span className="profile-overview-value">{overview[key]}</span>
                    <span className="profile-overview-label">{label}</span>
                  </div>
                ))}
              </div>
            </>
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
