import { useState } from 'react'
import { useRecipePages } from '../hooks/useRecipePages'
import type { MagazineIssue } from '../types/magazine'
import { MagazineReader } from './HomeMagazineStrip'

// Botão "Ler em formato revista" da receita. Reaproveita o leitor da
// revista (virada de página, zoom, download). Sem páginas cadastradas, não
// aparece.

interface Props {
  recipeId: string
  communityId: string
  title: string
  coverPath: string | null
}

export function RecipeMagazineView({ recipeId, communityId, title, coverPath }: Props) {
  const { pages } = useRecipePages(recipeId, communityId)
  const [open, setOpen] = useState(false)

  if (pages.length === 0) return null

  const issue: MagazineIssue = {
    id: recipeId,
    community_id: communityId,
    title,
    cover_path: coverPath,
    release_date: '',
    pages: pages.map((p) => ({
      id: p.id,
      issue_id: recipeId,
      position: p.position,
      image_path: p.image_path,
    })),
  }

  return (
    <>
      <button type="button" className="profile-edit-action" onClick={() => setOpen(true)}>
        Ler em formato revista
      </button>
      {open && <MagazineReader issue={issue} onClose={() => setOpen(false)} />}
    </>
  )
}
