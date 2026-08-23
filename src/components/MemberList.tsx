import type { CommunityMember } from '../types/community'

interface MemberListProps {
  members: CommunityMember[]
  onSelectMember?: (profileId: string) => void
}

export function MemberList({ members, onSelectMember }: MemberListProps) {
  const activeMembers = members.filter((member) => member.status === 'active')

  return (
    <section className="member-list">
      <h3>Participantes</h3>

      {activeMembers.length === 0 ? (
        <p>Ainda não há participantes nesta comunidade.</p>
      ) : (
        <ul>
          {activeMembers.map((member) => (
            <li key={member.id}>
              {onSelectMember && member.profile ? (
                <button
                  type="button"
                  className="member-list-item"
                  onClick={() => onSelectMember(member.profile!.id)}
                >
                  {member.profile?.full_name ?? 'Participante'}
                </button>
              ) : (
                (member.profile?.full_name ?? 'Participante')
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
