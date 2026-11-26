import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CityCategory, CityGroup } from '../lib/city'
import { deleteGroup, saveCategory, saveGroup, uploadCityPhoto, useCityCatalog, useCityGroups } from '../hooks/useCity'

// Painel → Na minha cidade → Grupos e categorias.
// A profissional cria grupos novos e, dentro de cada grupo, as categorias. Cada grupo e cada
// categoria tem nome, descrição curta e imagem (o que aparece nos cards da tela da cidade).

export const GROUP_IMAGE_SPEC = '1200 × 900 px (4:3, horizontal). Aparece no card do grupo, na tela “Na minha cidade”.'
export const CATEGORY_IMAGE_SPEC = '1200 × 900 px (4:3, horizontal). Aparece no card da categoria, dentro do grupo.'

async function enviarImagem(file: File): Promise<{ url: string | null; error: string | null }> {
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) return { url: null, error: 'Sem sessão ativa.' }
  return uploadCityPhoto(uid, file)
}

export function ImageField({ value, spec, onChange }: { value: string | null; spec: string; onChange: (url: string | null) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function pick(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy(true)
    const r = await enviarImagem(file)
    setBusy(false)
    if (r.error || !r.url) setError(r.error ?? 'Não foi possível enviar.')
    else onChange(r.url)
  }
  return (
    <div className="cty-field">
      <span className="cty-label">Imagem (opcional: sem ela, o app mostra um ícone próprio)</span>
      {value ? <img className="cty-group-admin-img" src={value} alt="" loading="lazy" /> : <p className="home-muted">Sem imagem ainda.</p>}
      <p className="cty-note">Tamanho: {spec}</p>
      <div className="cty-actions">
        <label className="cty-btn cty-btn--small">
          {busy ? 'Enviando…' : value ? 'Trocar imagem' : 'Cadastrar imagem'}
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
        {value && (
          <button type="button" className="cty-btn cty-btn--small" onClick={() => onChange(null)}>
            Tirar
          </button>
        )}
      </div>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function CategoryEditor({ cat, grupo, onDone, onCancel }: { cat: CityCategory | null; grupo: string; onDone: () => void; onCancel: () => void }) {
  const [nome, setNome] = useState(cat?.nome ?? '')
  const [descricao, setDescricao] = useState(cat?.descricao ?? '')
  const [imagem] = useState<string | null>(cat?.imagem ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const r = await saveCategory({ id: cat?.id ?? null, nome: nome.trim(), grupo, descricao: descricao.trim() || null, imagem })
    setBusy(false)
    if (r.error) setError(r.error)
    else onDone()
  }

  return (
    <div className="cty-admin-item cty-admin-edit">
      <label className="cty-field">
        <span className="cty-label">Nome da categoria (até 30 letras)</span>
        <input type="text" maxLength={30} value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <label className="cty-field">
        <span className="cty-label">Descrição curta (aparece no card)</span>
        <textarea rows={2} maxLength={200} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </label>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <div className="cty-actions">
        <button type="button" className="cty-btn cty-btn--small cty-btn--primary" disabled={busy || nome.trim().length < 2} onClick={() => void save()}>
          {busy ? 'Salvando…' : 'Salvar categoria'}
        </button>
        <button type="button" className="cty-btn cty-btn--small" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

function GroupEditor({ group, onDone, onCancel }: { group: CityGroup | null; onDone: () => void; onCancel: () => void }) {
  const [nome, setNome] = useState(group?.nome ?? '')
  const [icone, setIcone] = useState(group?.icone ?? '')
  const [descricao, setDescricao] = useState(group?.descricao ?? '')
  const [imagem] = useState<string | null>(group?.imagem ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const r = await saveGroup({ slug: group?.slug ?? null, nome: nome.trim(), icone: icone.trim() || null, descricao: descricao.trim() || null, imagem })
    setBusy(false)
    if (r.error) setError(r.error)
    else onDone()
  }

  return (
    <div className="cty-admin-item cty-admin-edit">
      <label className="cty-field">
        <span className="cty-label">Nome do grupo</span>
        <input type="text" maxLength={40} value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <label className="cty-field">
        <span className="cty-label">Ícone (um emoji, opcional)</span>
        <input type="text" maxLength={4} value={icone} onChange={(e) => setIcone(e.target.value)} />
      </label>
      <label className="cty-field">
        <span className="cty-label">Descrição curta (aparece no card)</span>
        <textarea rows={2} maxLength={200} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </label>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <div className="cty-actions">
        <button type="button" className="cty-btn cty-btn--small cty-btn--primary" disabled={busy || nome.trim().length < 2} onClick={() => void save()}>
          {busy ? 'Salvando…' : 'Salvar grupo'}
        </button>
        <button type="button" className="cty-btn cty-btn--small" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

export function CityGroupsAdmin() {
  const { groups, reload: reloadGroups } = useCityGroups()
  const { categories, reload: reloadCats } = useCityCatalog()
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [editingGroup, setEditingGroup] = useState<string | 'novo' | null>(null)
  const [editingCat, setEditingCat] = useState<string | 'novo' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    await Promise.all([reloadGroups(), reloadCats()])
  }

  async function removeGroup(slug: string) {
    if (!window.confirm('Remover este grupo? (só é possível se ele não tiver categorias)')) return
    const r = await deleteGroup(slug)
    if (r.error) setError(r.error)
    else {
      setError(null)
      await refresh()
    }
  }

  async function removeCategory(c: CityCategory) {
    if (!window.confirm(`Remover a categoria “${c.nome}”? Os cadastros dela vão para “Outros”.`)) return
    const { error: rpcError } = await supabase.rpc('city_category_admin', { p_id: c.id, p_action: 'remover', p_value: null, p_into: null })
    if (rpcError) setError('Não foi possível remover agora.')
    else {
      setError(null)
      await refresh()
    }
  }

  return (
    <div className="cty-admin">
      <p className="home-muted">Crie os grupos e, dentro de cada um, as categorias. Cada grupo e cada categoria aparece na tela “Na minha cidade” com um ícone próprio do Círcula e uma descrição.</p>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      {editingGroup === 'novo' ? (
        <GroupEditor group={null} onDone={() => { setEditingGroup(null); void refresh() }} onCancel={() => setEditingGroup(null)} />
      ) : (
        <button type="button" className="cty-btn cty-btn--primary" onClick={() => setEditingGroup('novo')}>
          + Novo grupo
        </button>
      )}

      {groups.map((g) => {
        const cats = categories.filter((c) => c.grupo === g.slug && c.status !== 'unida')
        const open = openSlug === g.slug
        return (
          <article key={g.slug} className="cty-admin-item cty-admin-group">
            <button type="button" className="cty-admin-group-head" aria-expanded={open} onClick={() => setOpenSlug(open ? null : g.slug)}>
              {g.imagem ? <img src={g.imagem} alt="" loading="lazy" /> : <span className="cty-admin-group-ph" aria-hidden="true">{g.icone ?? '•'}</span>}
              <span className="cty-admin-group-name">
                <strong>{g.nome}</strong>
                <small>
                  {cats.length} {cats.length === 1 ? 'categoria' : 'categorias'}
                </small>
              </span>
              <span aria-hidden="true">{open ? '−' : '+'}</span>
            </button>

            {open && (
              <div className="cty-admin-group-body">
                {editingGroup === g.slug ? (
                  <GroupEditor group={g} onDone={() => { setEditingGroup(null); void refresh() }} onCancel={() => setEditingGroup(null)} />
                ) : (
                  <div className="cty-actions">
                    <button type="button" className="cty-btn cty-btn--small" onClick={() => setEditingGroup(g.slug)}>
                      Editar grupo (nome e descrição)
                    </button>
                    {g.slug !== 'outros' && cats.length === 0 && (
                      <button type="button" className="cty-btn cty-btn--small" onClick={() => void removeGroup(g.slug)}>
                        Remover grupo
                      </button>
                    )}
                  </div>
                )}

                <h4 className="cty-admin-sub">Categorias de {g.nome}</h4>
                {cats.map((c) =>
                  editingCat === c.id ? (
                    <CategoryEditor key={c.id} cat={c} grupo={g.slug} onDone={() => { setEditingCat(null); void refresh() }} onCancel={() => setEditingCat(null)} />
                  ) : (
                    <div key={c.id} className="cty-admin-cat">
                      {c.imagem ? <img src={c.imagem} alt="" loading="lazy" /> : <span className="cty-admin-group-ph" aria-hidden="true">•</span>}
                      <span className="cty-admin-group-name">
                        <strong>{c.nome}</strong>
                        {c.descricao && <small>{c.descricao}</small>}
                      </span>
                      <button type="button" className="cty-btn cty-btn--small" onClick={() => setEditingCat(c.id)}>
                        Editar
                      </button>
                      <button type="button" className="cty-btn cty-btn--small" onClick={() => void removeCategory(c)}>
                        Remover
                      </button>
                    </div>
                  ),
                )}
                {editingCat === 'novo' ? (
                  <CategoryEditor cat={null} grupo={g.slug} onDone={() => { setEditingCat(null); void refresh() }} onCancel={() => setEditingCat(null)} />
                ) : (
                  <button type="button" className="cty-btn cty-btn--small cty-btn--primary" onClick={() => setEditingCat('novo')}>
                    + Nova categoria em {g.nome}
                  </button>
                )}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
