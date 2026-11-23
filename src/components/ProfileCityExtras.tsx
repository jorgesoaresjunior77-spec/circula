import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCityCatalog, useCityListings, useMyCity } from '../hooks/useCity'
import { CityListingCard } from './CityListingCard'

// Perfil: o desconto de quem convida amigas, a cidade escolhida e "Meus salvos".

/** Quem convida amigas ganha 10% de desconto no próximo ciclo da assinatura. */
export function InviteDiscountNote() {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    void supabase.rpc('my_invite_count').then(({ data, error }) => {
      if (!cancelled && !error && typeof data === 'number') setCount(data)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return (
    <p className="cty-profile-discount">
      <strong>10% de desconto no seu próximo ciclo.</strong> A participante que convida amigas para o Círculo ganha 10% de desconto no próximo ciclo da assinatura.
      {count !== null && count > 0 && (
        <>
          {' '}
          Já entraram {count} {count === 1 ? 'amiga' : 'amigas'} pelo seu convite.
        </>
      )}
    </p>
  )
}

/** Cidade onde a participante mora no Círcula (a mesma do card "Na minha cidade"). */
export function ProfileCityLine({ onOpen }: { onOpen: () => void }) {
  const { city, loading } = useMyCity()
  if (loading) return null
  return (
    <p className="cty-profile-discount">
      {city ? (
        <>
          <strong>Na minha cidade:</strong> {city.nome}/{city.estado}.{' '}
        </>
      ) : (
        <>Você ainda não escolheu a sua cidade. </>
      )}
      <button type="button" className="cty-link" onClick={onOpen}>
        {city ? 'Abrir' : 'Escolher a minha cidade'}
      </button>
    </p>
  )
}

/** "Meus salvos": os cadastros de "Na minha cidade" que a participante guardou. */
export function CitySaved({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false)
  const { listings, loading, toggleVote, toggleSave, toggleGo, report } = useCityListings(null, true)
  const { categories, tags } = useCityCatalog()
  return (
    <div className="cty-section">
      <button type="button" className="cty-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? 'Esconder meus salvos' : `Meus salvos${listings.length ? ` (${listings.length})` : ''}`}
      </button>
      {open && loading && <p className="home-muted">Carregando…</p>}
      {open && !loading && listings.length === 0 && (
        <p className="home-muted">Você ainda não salvou nada. Toque em “Salvar” em um cadastro da sua cidade.</p>
      )}
      {open && (
        <div className="cty-list">
          {listings.map((l) => (
            <CityListingCard
              key={l.id}
              listing={l}
              category={categories.find((c) => c.id === l.categoria_id) ?? null}
              tags={tags}
              uid={uid}
              isAdmin={false}
              readOnly
              onVote={(x) => toggleVote(x, uid)}
              onSave={(x) => toggleSave(x, uid)}
              onGo={(x) => toggleGo(x)}
              onEdit={() => undefined}
              onDelete={async () => ({ error: null })}
              onHide={async () => ({ error: null })}
              onReport={(x, motivo) => report(x, uid, motivo)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
