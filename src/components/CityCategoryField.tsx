import { useMemo, useState } from 'react'
import { FALLBACK_GROUPS, cityNormalize, findSimilarCategory, groupLabel } from '../lib/city'
import type { CityCategory, CityGroup } from '../lib/city'
import { findBlockedTerm } from '../lib/moderation'

// Campo "Categoria" do cadastro: lista agrupada por tema, com busca. Se a
// participante não encontra, "+ Criar nova categoria" (nome de até 30 letras
// e grupo). Antes de salvar, avisa se já existe uma igual ou parecida
// ("Você quis dizer Eletricista?"). A nova categoria vale na hora para todas.

interface CityCategoryFieldProps {
  categories: CityCategory[]
  value: string | null
  onChange: (id: string) => void
  onCreate: (nome: string, grupo: string, grupoSugerido?: string) => Promise<{ error: string | null; id: string | null; existing: boolean }>
  groups?: CityGroup[]
}

export function CityCategoryField({ categories, value, onChange, onCreate, groups = FALLBACK_GROUPS }: CityCategoryFieldProps) {
  const [newGroupName, setNewGroupName] = useState('')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState('outros')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const usable = useMemo(() => categories.filter((c) => c.status !== 'unida'), [categories])
  const current = usable.find((c) => c.id === value) ?? null
  const q = cityNormalize(query)
  const filtered = useMemo(() => (q ? usable.filter((c) => c.nome_normalizado.includes(q) || cityNormalize(groupLabel(c.grupo, groups)).includes(q)) : usable), [usable, q])
  const similar = useMemo(() => (creating ? findSimilarCategory(newName, usable) : null), [creating, newName, usable])

  function pick(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
    setCreating(false)
  }

  async function createNow() {
    setError(null)
    const name = newName.trim()
    if (name.length < 2) {
      setError('Escreva o nome da categoria.')
      return
    }
    if (findBlockedTerm(name)) {
      setError('Este nome tem palavras que não combinam com o nosso espaço de cuidado.')
      return
    }
    setBusy(true)
    const r = await onCreate(name, newGroup, newGroupName.trim() || undefined)
    setBusy(false)
    if (r.error || !r.id) {
      setError(r.error ?? 'Não foi possível criar agora.')
      return
    }
    setNewName('')
    pick(r.id)
  }

  return (
    <div className="cty-field">
      <span className="cty-label">Categoria</span>
      <button type="button" className="cty-select-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {current ? `${current.nome} · ${groupLabel(current.grupo)}` : 'Escolha a categoria'}
      </button>

      {open && (
        <div className="cty-cat-panel">
          <input
            type="search"
            className="cty-search"
            placeholder="Buscar categoria (ex.: eletricista, café)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar categoria"
          />
          <div className="cty-cat-scroll">
            {groups.map((g) => {
              const items = filtered.filter((c) => c.grupo === g.slug)
              if (items.length === 0) return null
              return (
                <div key={g.slug} className="cty-cat-group">
                  <p className="cty-cat-group-title">
                    <span aria-hidden="true">{g.icone}</span> {g.nome}
                  </p>
                  <div className="cty-chips">
                    {items.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`cty-chip${c.id === value ? ' cty-chip--on' : ''}`}
                        onClick={() => pick(c.id)}
                      >
                        {c.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && <p className="home-muted">Nenhuma categoria com esse nome.</p>}
          </div>

          {!creating ? (
            <button type="button" className="cty-link" onClick={() => { setCreating(true); setNewName(query.slice(0, 30)) }}>
              + Criar nova categoria
            </button>
          ) : (
            <div className="cty-newcat">
              <label className="cty-field">
                <span className="cty-label">Nome da nova categoria</span>
                <input type="text" maxLength={30} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Até 30 letras" />
              </label>
              <label className="cty-field">
                <span className="cty-label">Grupo</span>
                <select value={newGroup} onChange={(e) => setNewGroup(e.target.value)}>
                  {groups.map((g) => (
                    <option key={g.slug} value={g.slug}>
                      {g.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cty-field">
                <span className="cty-label">Não achou o grupo? Sugira um novo (opcional)</span>
                <input type="text" maxLength={40} value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Ex.: Fotografia" />
              </label>
              <p className="cty-note">A nutricionista recebe o seu pedido e cria a categoria (e o grupo, se for novo).</p>
              {similar && (
                <p className="cty-didyoumean">
                  Você quis dizer{' '}
                  <button type="button" className="cty-link" onClick={() => pick(similar.id)}>
                    {similar.nome}
                  </button>
                  ? Já existe uma categoria parecida.
                </p>
              )}
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              <div className="cty-actions">
                <button type="button" className="cty-btn cty-btn--primary" disabled={busy || !newName.trim()} onClick={() => void createNow()}>
                  {busy ? 'Criando…' : similar ? 'Criar mesmo assim' : 'Criar categoria'}
                </button>
                <button type="button" className="cty-btn" onClick={() => setCreating(false)}>
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
