import { useEffect, useMemo, useState } from 'react'
import { BR_STATES } from '../lib/travel'
import { cityNormalize, loadStateCities } from '../lib/city'
import type { IbgeCity } from '../lib/city'

// Escolha de Estado e Cidade: o Estado é um select com os 27; ao escolher,
// aparece a lista de cidades daquele estado (base oficial do IBGE) com
// campo de busca, porque há estados com centenas de cidades.

interface CityPickerProps {
  /** Estado já escolhido antes (abre direto nele). */
  initialUf?: string | null
  confirmLabel: string
  busy?: boolean
  error?: string | null
  onConfirm: (uf: string, city: IbgeCity) => void
  onCancel?: () => void
}

export function CityPicker({ initialUf = null, confirmLabel, busy = false, error = null, onConfirm, onCancel }: CityPickerProps) {
  const [uf, setUf] = useState(initialUf ?? '')
  const [cities, setCities] = useState<IbgeCity[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<IbgeCity | null>(null)

  useEffect(() => {
    if (!uf) return
    let cancelled = false
    void loadStateCities(uf)
      .then((rows) => {
        if (!cancelled) {
          setCities(rows)
          setLoadError(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [uf])

  const shown = useMemo(() => {
    if (!cities) return []
    const q = cityNormalize(query)
    // Sem "s" final, igual à regra de busca: "cruz alta" acha "Cruz Alta".
    return q ? cities.filter((c) => cityNormalize(c.nome).includes(q)) : cities
  }, [cities, query])

  function chooseState(value: string) {
    setUf(value)
    setCities(null)
    setLoadError(false)
    setQuery('')
    setPicked(null)
  }

  return (
    <div className="cty-picker">
      <label className="cty-field">
        <span className="cty-label">Estado</span>
        <select value={uf} onChange={(e) => chooseState(e.target.value)} aria-label="Estado">
          <option value="">Escolha o seu estado</option>
          {BR_STATES.map((s) => (
            <option key={s.uf} value={s.uf}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {uf && (
        <div className="cty-field">
          <span className="cty-label">Cidade</span>
          {loadError && (
            <p className="auth-error" role="alert">
              Não foi possível carregar as cidades agora. Confira a internet e tente de novo.
            </p>
          )}
          {!loadError && !cities && <p className="home-muted">Carregando as cidades…</p>}
          {cities && (
            <>
              <input
                type="search"
                className="cty-search"
                placeholder={`Buscar entre ${cities.length} cidades`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar cidade"
              />
              <ul className="cty-city-list" role="listbox" aria-label="Cidades">
                {shown.length === 0 && <li className="cty-city-empty">Nenhuma cidade com esse nome.</li>}
                {shown.map((c) => (
                  <li key={c.ibge_id} role="option" aria-selected={picked?.ibge_id === c.ibge_id}>
                    <button
                      type="button"
                      className={`cty-city-option${picked?.ibge_id === c.ibge_id ? ' cty-city-option--on' : ''}`}
                      onClick={() => setPicked(c)}
                    >
                      {c.nome}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <div className="cty-actions">
        <button type="button" className="cty-btn cty-btn--primary" disabled={!uf || !picked || busy} onClick={() => picked && onConfirm(uf, picked)}>
          {busy ? 'Salvando…' : picked ? `${confirmLabel} · ${picked.nome}` : confirmLabel}
        </button>
        {onCancel && (
          <button type="button" className="cty-btn" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
