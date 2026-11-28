import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCityCatalog, useCityListings, useMyCity } from '../hooks/useCity'
import { CityListingCard } from './CityListingCard'

// Perfil: o desconto de quem convida amigas, a cidade escolhida e "Meus salvos".

/** Indicação: quem tem o Premium convida; quando a amiga entra pelo convite e PAGA o
 *  Premium, quem convidou ganha 10% no próximo ciclo de pagamento, automaticamente
 *  (o webhook do Asaas aplica). Aqui fica registrado cada convite e em que pé está. */
type InviteRow = { nome: string; entrou_em: string; premium_pago_em: string | null; desconto_aplicado_em: string | null }

function inviteStatus(r: InviteRow): string {
  if (r.desconto_aplicado_em) {
    return `desconto de 10% aplicado na cobrança de ${new Date(r.desconto_aplicado_em).toLocaleDateString('pt-BR')}`
  }
  if (r.premium_pago_em) return 'assinou o Premium: o seu próximo ciclo vem com 10%'
  return 'entrou; o desconto vale quando ela assinar o Premium'
}

export function InviteDiscountNote() {
  const [rows, setRows] = useState<InviteRow[] | null>(null)
  useEffect(() => {
    let cancelled = false
    void supabase.rpc('my_invite_list').then(({ data, error }) => {
      if (!cancelled && !error && Array.isArray(data)) setRows(data as InviteRow[])
    })
    return () => {
      cancelled = true
    }
  }, [])
  return (
    <div className="cty-profile-discount">
      <p>
        <strong>Convide e ganhe 10%.</strong> Quem tem o Premium convida uma amiga pelo link do círculo. Ela ganha 10% de
        desconto na primeira assinatura do Premium. Quando ela entra e paga o Premium, você ganha 10% de desconto no seu
        próximo ciclo de pagamento, automaticamente (uma amiga, um ciclo).
      </p>
      {rows && rows.length > 0 && (
        <ul className="cty-invite-list">
          {rows.map((r, i) => (
            <li key={i}>
              <strong>{r.nome}</strong> ({new Date(r.entrou_em).toLocaleDateString('pt-BR')}): {inviteStatus(r)}
            </li>
          ))}
        </ul>
      )}
    </div>
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
