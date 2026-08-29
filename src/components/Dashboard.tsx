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
import { QuestionBankManager } from './QuestionBankManager'
import { ChallengeManager } from './ChallengeManager'
import { CircleManager } from './CircleManager'
import { CheckinManager } from './CheckinManager'
import { EngagementCommandManager } from './EngagementCommandManager'
import { ProductManager } from './ProductManager'
import { ProfessionalPanel } from './ProfessionalPanel'
import { MemberCommunityCard } from './MemberCommunityCard'

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
  const [feedRefreshToken, setFeedRefreshToken] = useState(0)

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
        <div className="dashboard-main-solo">
          <ProfileCard profileId={viewingProfileId} onClose={() => setViewingProfileId(null)} />
        </div>
      ) : (
        <>
          <div className="dashboard-rail">
            {profile && (
              <MyProfile profile={profile} onUpdate={onUpdateProfile} onUploadAvatar={onUploadAvatar} />
            )}
          </div>

          <div className="dashboard-main">
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
                    <Feed
                      communityId={communities[0].id}
                      authorId={profile.id}
                      canPost
                      refreshToken={feedRefreshToken}
                    />
                    <ProfessionalPanel
                      communityId={communities[0].id}
                      profileId={profile.id}
                      onFeedRefresh={() => setFeedRefreshToken((token) => token + 1)}
                    />
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
                        <QuestionBankManager
                          communityId={community.id}
                          authorId={profile.id}
                          canManage={false}
                        />
                        <ChallengeManager
                          communityId={community.id}
                          profileId={profile.id}
                          canManage={false}
                          canParticipate={false}
                        />
                        <CircleManager
                          communityId={community.id}
                          profileId={profile.id}
                          canManage={false}
                          canParticipate={false}
                        />
                        <CheckinManager
                          communityId={community.id}
                          profileId={profile.id}
                          canManage={false}
                          canParticipate={false}
                        />
                        <EngagementCommandManager
                          communityId={community.id}
                          authorId={profile.id}
                          canManage={false}
                        />
                        <ProductManager
                          communityId={community.id}
                          profileId={profile.id}
                          canManage={false}
                        />
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
                      <MemberCommunityCard
                        key={community.id}
                        community={community}
                        profile={profile}
                        memberCount={memberCounts[community.id]}
                        feedRefreshToken={feedRefreshToken}
                        onFeedRefresh={() => setFeedRefreshToken((token) => token + 1)}
                      />
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
          </div>
        </>
      )}
    </section>
  )
}
