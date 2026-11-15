import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ProfileOverview } from '../types/profile'
import { ProfileGallery } from './ProfileGallery'
import { GardenProfileSummary } from './GardenProfileSummary'
import { ProfileBanner } from './ProfileBanner'
import { ProfileTestimonials } from './ProfileTestimonials'

interface ViewedProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  banner_url: string | null
  interests: string[]
  bio: string | null
  city: string | null
  birth_city: string | null
  gallery_photos: string[]
}

interface ProfileCardProps {
  profileId: string
  onClose: () => void
  /** Quando definido, mostra "Enviar mensagem" (abre/inicia a conversa). */
  onStartConversation?: (profileId: string) => void
  /** Comunidade em comum: mostra o Meu Jardim da pessoa visitada. */
  communityId?: string | null
  /** Quem está visitando (para escrever um depoimento). */
  viewerId?: string | null
}

const OVERVIEW_LABELS: { key: keyof ProfileOverview; label: string }[] = [
  { key: 'posts', label: 'publicações' },
  { key: 'comments', label: 'comentários' },
  { key: 'circles', label: 'círculos' },
  { key: 'content', label: 'conteúdos' },
  { key: 'events', label: 'eventos' },
]

export function ProfileCard({
  profileId,
  onClose,
  onStartConversation,
  communityId = null,
  viewerId = null,
}: ProfileCardProps) {
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
      .select('id, full_name, avatar_url, banner_url, interests, bio, city, birth_city, gallery_photos')
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
    <section className="community-card community-card--profile profile-page">
      <button type="button" className="auth-link" onClick={onClose}>
        Fechar
      </button>

      <p className="profile-eyebrow">Perfil</p>

      {loading && <p>Carregando perfil...</p>}

      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && profile && (
        <>
          <ProfileBanner
            bannerUrl={profile.banner_url}
            avatarUrl={profile.avatar_url}
            name={profile.full_name}
            city={profile.city}
            birthCity={profile.birth_city}
            bio={profile.bio}
            interests={profile.interests}
          />

          <ProfileTestimonials profileId={profileId} communityId={communityId} viewerId={viewerId} />

          {/* Item 10 — galeria (só leitura): visível se houver fotos,
              mesma RLS de `profiles` de sempre — nada novo de permissão. */}
          {profile.gallery_photos.length > 0 && (
            <div className="profile-gallery-section">
              <p className="profile-section-label">Fotos</p>
              <ProfileGallery
                photos={profile.gallery_photos}
                social={viewerId ? { ownerId: profileId, viewerId } : undefined}
              />
            </div>
          )}

          {communityId && (
            <div className="profile-garden-section">
              <p className="profile-section-label">Meu Jardim</p>
              <GardenProfileSummary communityId={communityId} profileId={profileId} />
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
