import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Painel → Parceiros: liga o parceiro a um cadastro que já existe em "Na minha
// cidade" (sem duplicar nada). Busca pelo nome; mostra a cidade de cada um.

interface Hit {
  id: string
  titulo: string
  bairro: string | null
  cidades: { nome: string; estado: string } | null
}

export function PartnerListingPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [current, setCurrent] = useState<Hit | null>(null)

  useEffect(() => {
    if (!value) {
      setCurrent(null)
      return
    }
    void supabase
      .from('city_listings')
      .select('id, titulo, bairro, cidades(nome, estado)')
      .eq('id', value)
      .maybeSingle()
      .then(({ data }) => setCurrent((data as unknown as Hit | null) ?? null))
  }, [value])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    const t = window.setTimeout(() => {
      void supabase
        .from('city_listings')
        .select('id, titulo, bairro, cidades(nome, estado)')
        .in('tipo', ['lugar', 'profissional'])
        .eq('status', 'ativo')
        .ilike('titulo', `%${q.replace(/[%_]/g, '')}%`)
        .limit(8)
        .then(({ data }) => setHits((data as unknown as Hit[] | null) ?? []))
    }, 280)
    return () => window.clearTimeout(t)
  }, [query])

  const where = (h: Hit) => [h.bairro, h.cidades ? `${h.cidades.nome}/${h.cidades.estado}` : null].filter(Boolean).join(' · ')

  return (
    <fieldset className="plp">
      <legend>Estabelecimento em “Na minha cidade” (opcional)</legend>
      {value && current ? (
        <p className="plp-current">
          <strong>{current.titulo}</strong> {where(current) && <small>· {where(current)}</small>}{' '}
          <button type="button" className="water-link" onClick={() => onChange(null)}>
            Desvincular
          </button>
        </p>
      ) : (
        <>
          <input type="search" value={query} placeholder="Buscar pelo nome do estabelecimento" onChange={(e) => setQuery(e.target.value)} aria-label="Buscar estabelecimento" />
          {hits.length > 0 && (
            <ul className="plp-hits">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(h.id)
                      setQuery('')
                      setHits([])
                    }}
                  >
                    <strong>{h.titulo}</strong> {where(h) && <small>· {where(h)}</small>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 2 && hits.length === 0 && <small className="home-muted">Nenhum cadastro com esse nome. Ele precisa existir em “Na minha cidade” primeiro.</small>}
        </>
      )}
    </fieldset>
  )
}
