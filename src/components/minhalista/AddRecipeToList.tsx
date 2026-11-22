import { useState } from 'react'
import type { Recipe } from '../../hooks/useRecipes'
import { useShopping } from '../../hooks/useShopping'
import { MinhaListaCommercial } from './MinhaListaCommercial'
import { RecipeToList } from './RecipeToList'

// Botão dentro da receita: ADICIONAR INGREDIENTES À MINHA LISTA. Quem não tem
// o serviço vê a página comercial em vez da lista de ingredientes.

function Opened({ recipe, communityId, profileId, onClose, onGoToLists }: { recipe: Recipe; communityId: string; profileId: string; onClose: (added: boolean) => void; onGoToLists?: () => void }) {
  const api = useShopping(communityId, profileId)
  if (api.loading) return null
  return <RecipeToList recipes={[recipe]} fixed={recipe} api={api} onClose={() => onClose(false)} onDone={() => onClose(true)} onGoToLists={onGoToLists} />
}

export function AddRecipeToList({
  recipe,
  communityId,
  profileId,
  canUse,
  onOpenPlans,
  onGoToLists,
}: {
  recipe: Recipe
  communityId: string
  profileId: string
  canUse: boolean
  onOpenPlans: () => void
  onGoToLists?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)

  return (
    <div className="rec-add-list">
      <button type="button" className="water-primary" onClick={() => setOpen(true)}>
        ADICIONAR INGREDIENTES À MINHA LISTA
      </button>
      {done && (
        <p className="auth-success" role="status">
          Ingredientes adicionados à sua lista.
        </p>
      )}
      {open && !canUse && (
        <div className="ml-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Minha Lista">
          <div className="ml-sheet">
            <button type="button" className="plans-sheet-close" onClick={() => setOpen(false)} aria-label="Fechar">
              ×
            </button>
            <MinhaListaCommercial onOpenPlans={onOpenPlans} />
          </div>
        </div>
      )}
      {open && canUse && (
        <Opened
          recipe={recipe}
          communityId={communityId}
          profileId={profileId}
          onGoToLists={onGoToLists}
          onClose={(added) => {
            setOpen(false)
            if (added) setDone(true)
          }}
        />
      )}
    </div>
  )
}
