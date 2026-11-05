import { useState } from 'react'
import { useMagazines } from '../hooks/useMagazines'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { MagazineReader } from './HomeMagazineStrip'
import type { MagazineIssue } from '../types/magazine'

// Avisos no topo do Feed: desafio do dia (Meu Jardim) e edição nova da revista.
const NEW_ISSUE_DAYS = 30

function IssueNotice({ issue }: { issue: MagazineIssue }) {
  const { url } = useSignedImageUrl(issue.cover_path)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="feed-notice feed-notice--magazine" onClick={() => setOpen(true)}>
        <span className="feed-notice-cover">{url && <img src={url} alt="" loading="lazy" />}</span>
        <span className="feed-notice-text">
          <strong>Saiu a nova edição da Revista Círcula.</strong>
          <span>{issue.title}</span>
        </span>
      </button>
      {open && <MagazineReader issue={issue} onClose={() => setOpen(false)} />}
    </>
  )
}

export function FeedNotices({
  communityId,
  gardenPending,
  onOpenGarden,
}: {
  communityId: string
  gardenPending: boolean
  onOpenGarden: () => void
}) {
  const { issues } = useMagazines(communityId)
  const today = new Date().toISOString().slice(0, 10)
  const limit = new Date(Date.now() - NEW_ISSUE_DAYS * 86400000).toISOString().slice(0, 10)
  const fresh = issues.find((i) => i.release_date <= today && i.release_date >= limit) ?? null

  if (!gardenPending && !fresh) return null
  return (
    <div className="feed-notices">
      {gardenPending && (
        <button type="button" className="feed-notice feed-notice--garden" onClick={onOpenGarden}>
          <span className="feed-notice-text">
            <strong>Você já fez o desafio do dia?</strong>
            <span>Toque para marcar o CHECK no Meu Jardim.</span>
          </span>
        </button>
      )}
      {fresh && <IssueNotice issue={fresh} />}
    </div>
  )
}
