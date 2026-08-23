import { useState } from 'react'
import circulaIcon from '../assets/circula-icon.png'
import type { Profile } from '../types/profile'
import { useCommunity } from '../hooks/useCommunity'
import { CreateCommunityForm } from './CreateCommunityForm'
import { CommunityView } from './CommunityView'
import { MemberList } from './MemberList'
import { AddMemberForm } from './AddMemberForm'
import { MyProfile } from './MyProfile'
import { ProfileCard } from './ProfileCard'
import { Feed } from './Feed'

interface DashboardProps {
  profile: Profile | null
  onSignOut: () => void
  onUpdateProfile: (input: { full_name?: string | null; interests?: string[] }) => Promise<{
    error: string | null
  }>
  onUploadAvatar: (file: File) => Promise<{ error: string | null }>
}

export function Dashboard({
  profile,
  onSignOut,
  onUpdateProfile,
  onUploadAvatar,
}: DashboardProps) {
  const { communities, memberCounts, loading, error, createCommunity, addMember, joinCommunity } =
    useCommunity(profile)
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null)

  const myCommunities = communities.filter((community) =>
    community.community_members.some((member) => member.profile?.id === profile?.id),
  )
  const discoverableCommunities = communities.filter(
    (community) =>
      !community.community_members.some((member) => member.profile?.id === profile?.id),
  )

  return (
    <section className="dashboard">
      <header className="dashboard-header">
        <div>
          <div className="brand">
            <img src={circulaIcon} alt="" className="brand-icon" />
            <h1>Círcula</h1>
          </div>
          <p>
            Olá, <strong>{profile?.full_name ?? 'usuária'}</strong>
          </p>
        </div>
        <button type="button" onClick={onSignOut}>
          Sair
        </button>
      </header>

      {viewingProfileId ? (
        <ProfileCard profileId={viewingProfileId} onClose={() => setViewingProfileId(null)} />
      ) : (
        <>
          {profile && (
            <MyProfile profile={profile} onUpdate={onUpdateProfile} onUploadAvatar={onUploadAvatar} />
          )}

          <div className="community-area">
            {loading && <p>Carregando comunidade...</p>}

            {!loading && error && <p className="auth-error">{error}</p>}

            {!loading && !error && profile && profile.role === 'professional' && (
              <>
                <p className="section-label">Minha comunidade</p>
                {communities.length === 0 ? (
                  <CreateCommunityForm onCreate={createCommunity} />
                ) : (
                  <>
                    <CommunityView
                      community={communities[0]}
                      memberCount={memberCounts[communities[0].id]}
                      badge="Você é a anfitriã desta comunidade"
                    />
                    <Feed communityId={communities[0].id} authorId={profile.id} canPost />
                    <AddMemberForm onAdd={(email) => addMember(communities[0].id, email)} />
                    <MemberList
                      members={communities[0].community_members}
                      onSelectMember={setViewingProfileId}
                    />
                  </>
                )}
              </>
            )}

            {!loading && !error && profile && profile.role === 'master' && (
              <>
                <p className="section-label">Comunidades</p>
                {communities.length === 0 ? (
                  <p>Nenhuma comunidade criada ainda.</p>
                ) : (
                  <div className="community-grid">
                    {communities.map((community) => (
                      <div key={community.id} className="community-block">
                        <CommunityView
                          community={community}
                          memberCount={memberCounts[community.id]}
                        />
                        <Feed communityId={community.id} authorId={profile.id} canPost={false} />
                        <MemberList
                          members={community.community_members}
                          onSelectMember={setViewingProfileId}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {!loading && !error && profile && profile.role === 'member' && (
              <>
                <p className="section-label">Minha comunidade</p>
                {myCommunities.length === 0 ? (
                  <p>Você ainda não faz parte de nenhuma comunidade.</p>
                ) : (
                  <div className="community-grid">
                    {myCommunities.map((community) => (
                      <div key={community.id} className="community-block">
                        <CommunityView
                          community={community}
                          memberCount={memberCounts[community.id]}
                          badge="Você participa desta comunidade"
                        />
                        <Feed communityId={community.id} authorId={profile.id} canPost />
                      </div>
                    ))}
                  </div>
                )}

                {discoverableCommunities.length > 0 && (
                  <>
                    <p className="section-label">Descobrir comunidades</p>
                    <div className="community-grid">
                      {discoverableCommunities.map((community) => (
                        <CommunityView
                          key={community.id}
                          community={community}
                          memberCount={memberCounts[community.id]}
                          onJoin={() => joinCommunity(community.id)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}
