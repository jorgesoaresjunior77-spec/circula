import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ProfileOverview } from '../types/profile'
import { ProfileGallery } from './ProfileGallery'
import { GardenProfileSummary } from './GardenProfileSummary'
import { ProfileBanner } from './ProfileBanner'
import { ProfileTestimonials } from './ProfileTestimonials'
import { recordProfileVisit, useFollow } from '../hooks/useFollow'

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
  const follow = useFollow(viewerId, profileId)

  useEffect(() => {
    recordProfileVisit(viewerId, profileId)
  }, [viewerId, profileId])

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

          {/* Logo abaixo do banner: seguir e a atividade da pessoa no Círcula. */}
          <div className="profile-visit-stats profile-visit-stats--visitor" aria-label="Atividade no Círcula">
            {viewerId && viewerId !== profileId ? (
              <button
                type="button"
                className={`profile-visit-stat profile-follow-card${follow.following ? ' profile-follow-card--on' : ''}`}
                onClick={() => void follow.toggle()}
                disabled={follow.busy}
                aria-pressed={follow.following}
              >
                <strong>{follow.following ? 'Seguindo' : 'Seguir'}</strong>
                <span>{follow.followers} {follow.followers === 1 ? 'seguidora' : 'seguidoras'}</span>
              </button>
            ) : (
              <div className="profile-visit-stat">
                <strong>{follow.followers}</strong>
                <span>{follow.followers === 1 ? 'seguidora' : 'seguidoras'}</span>
              </div>
            )}
            <div className="profile-visit-stat">
              <strong>{overview?.posts ?? '–'}</strong>
              <span>publicações</span>
            </div>
            <div className="profile-visit-stat">
              <strong>{overview?.content ?? '–'}</strong>
              <span>conteúdos</span>
            </div>
          </div>
          {follow.error && <p className="auth-error">{follow.error}</p>}

          <ProfileTestimonials
            profileId={profileId}
            communityId={communityId}
            viewerId={viewerId}
            between={
              <>
                  {/* Item 10 — galeria (só leitura): visível se houver fotos,
                      mesma RLS de `profiles` de sempre — nada novo de permissão. */}
                  {profile.gallery_photos.length > 0 && (
                    <div className="profile-gallery-section">
                      <p className="profile-section-label">Galeria da vida</p>
                      <ProfileGallery
                        photos={profile.gallery_photos}
                        social={viewerId ? { ownerId: profileId, viewerId } : undefined}
                      />
                    </div>
                  )}

              </>
            }
          />

          {communityId && (
            <div className="profile-garden-section">
              <p className="profile-section-label profile-section-label--garden">Meu Jardim</p>
              <GardenProfileSummary communityId={communityId} profileId={profileId} />
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
