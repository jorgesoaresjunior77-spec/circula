import { ViewCount } from './ViewCount'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useManagedContent } from '../hooks/useManagedContent'
import { normalizeInstagram, safePartnerLink } from '../lib/partners'
import { PartnerCouponsManager } from './PartnerCouponsManager'
import { PartnerListingPicker } from './PartnerListingPicker'
import type { Partner } from '../lib/partners'
import { CoverImageInput } from './CoverImageInput'

// Parceiros (profissional): cadastra os logos da faixa em movimento da
// Home. Use PNG ou WebP com fundo transparente — com fundo branco o logo
// aparece como um retângulo branco sobre o fundo bege.

interface Props {
  communityId: string
  profileId: string
}

interface FormState {
  id: string | null
  name: string
  logo: string
  link: string
  position: string
  status: 'draft' | 'published'
  cover: string
  description: string
  category: string
  city: string
  instagram: string
  listingId: string | null
}

const EMPTY: FormState = { id: null, name: '', logo: '', link: '', position: '0', status: 'draft', cover: '', description: '', category: '', city: '', instagram: '', listingId: null }

export function PartnersManager({ communityId, profileId }: Props) {
  const { items, loading, error, save, remove } = useManagedContent<Partner>(
    'community_partners',
    communityId,
    'position',
  )
  const [form, setForm] = useState<FormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function openEdit(p: Partner) {
    setForm({
      id: p.id,
      name: p.name,
      logo: p.logo_path,
      link: p.link_url ?? '',
      position: String(p.position),
      status: p.status,
      cover: p.cover_path ?? '',
      description: p.description ?? '',
      category: p.category ?? '',
      city: p.city ?? '',
      instagram: p.instagram ?? '',
      listingId: p.city_listing_id ?? null,
    })
    setFormError(null)
    setConfirmDelete(false)
  }

  function closeForm() {
    setForm(null)
    setFormError(null)
    setConfirmDelete(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.name.trim()) {
      setFormError('Informe o nome do parceiro.')
      return
    }
    if (!form.logo) {
      setFormError('Envie o logo (PNG ou WebP com fundo transparente).')
      return
    }
    const link = safePartnerLink(form.link)
    if (form.link.trim() && !link) {
      setFormError('O link precisa começar com https://')
      return
    }
    const insta = normalizeInstagram(form.instagram)
    if (form.instagram.trim() && !insta) {
      setFormError('Instagram: use só o @ do perfil (ex.: @lojadaana) ou o link do perfil.')
      return
    }
    setSaving(true)
    const result = await save(form.id, {
      cover_path: form.cover || null,
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      city: form.city.trim() || null,
      instagram: insta,
      city_listing_id: form.listingId,
      name: form.name.trim(),
      logo_path: form.logo,
      link_url: link,
      position: Number.parseInt(form.position, 10) || 0,
      status: form.status,
    })
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    closeForm()
  }

  async function handleDelete() {
    if (!form?.id) return
    setSaving(true)
    const result = await remove(form.id)
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    closeForm()
  }

  return (
    <div className="card-images-manager">
      <header className="card-images-head">
        <h4 className="card-images-title">Parceiros</h4>
        <p className="card-images-desc">
          Logos que passam na faixa da Home, nas cores originais. Ao tocar no logo, abre a página do parceiro:
          foto grande do lugar, descrição, Instagram, botão para o site, o estabelecimento em “Na minha cidade” e
          os cupons de desconto. Publique só parceiros que autorizaram o uso da marca. Logo em PNG ou WebP com
          fundo transparente.
        </p>
      </header>

      {loading && <p className="home-muted">Carregando…</p>}
      {error && <p className="auth-error">{error}</p>}
      {!loading && items.length === 0 && <p className="home-muted">Nenhum parceiro cadastrado ainda.</p>}

      <ul className="inspiration-list">
        {items.map((p) => (
          <li key={p.id} className="inspiration-item">
            <p className="inspiration-item-text">{p.name}</p>
            <p className="inspiration-item-meta">
              <ViewCount communityId={communityId} kind="partner_click" itemId={p.id} />
            </p>
            <p className="inspiration-item-meta">
              Posição {p.position} · {p.status === 'published' ? 'Publicado' : 'Rascunho'}
            </p>
            <p className="inspiration-item-meta">
              {p.link_url ? `Link: ${p.link_url}` : 'Sem link (o logo não abre nenhum site)'}
            </p>
            <button type="button" className="water-link" onClick={() => openEdit(p)}>
              Editar
            </button>
          </li>
        ))}
      </ul>

      {!form && (
        <button type="button" className="water-primary" onClick={() => setForm({ ...EMPTY })}>
          Novo parceiro
        </button>
      )}

      {form && (
        <form
          className="wellness-form"
          onSubmit={(e) => void handleSubmit(e)}
          aria-label={form.id ? 'Editar parceiro' : 'Novo parceiro'}
        >
          <h3>{form.id ? 'Editar parceiro' : 'Novo parceiro'}</h3>
          <label>
            Nome
            <input value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <CoverImageInput
            communityId={communityId}
            uid={profileId}
            value={form.logo}
            label="Logo"
            aspectRatio="3 / 2"
            recommendedSize="600 × 400 px, fundo transparente"
            onChange={(path) => setForm({ ...form, logo: path })}
          />
          <CoverImageInput
            communityId={communityId}
            uid={profileId}
            value={form.cover}
            label="Foto grande da página do parceiro (loja, clínica, ambiente)"
            aspectRatio="16 / 10"
            recommendedSize="1600 × 1000 px"
            onChange={(path) => setForm({ ...form, cover: path })}
          />
          <label>
            Descrição
            <textarea value={form.description} maxLength={1500} rows={4} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label>
            Categoria (opcional)
            <input value={form.category} maxLength={60} placeholder="Ex.: Moda, Clínica, Alimentação" onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </label>
          <label>
            Cidade (opcional)
            <input value={form.city} maxLength={80} placeholder="Ex.: Lajeado/RS" onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          <label>
            Instagram do parceiro (opcional)
            <input value={form.instagram} maxLength={120} placeholder="@perfil ou link do perfil" onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
          </label>
          <PartnerListingPicker value={form.listingId} onChange={(id) => setForm({ ...form, listingId: id })} />
          <label>
            Site do parceiro (opcional): o botão “Visitar parceiro” abre este endereço — comece com https://
            <input
              inputMode="url"
              value={form.link}
              maxLength={500}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="https://"
            />
          </label>
          <label>
            Posição (menor aparece primeiro)
            <input
              inputMode="numeric"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
            />
          </label>
          <label>
            Situação
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'draft' | 'published' })}>
              <option value="draft">Rascunho (não aparece)</option>
              <option value="published">Publicado</option>
            </select>
          </label>
          {formError && <p className="auth-error">{formError}</p>}
          <div className="wellness-form-actions">
            <button type="submit" className="water-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" className="water-link" onClick={closeForm} disabled={saving}>
              Cancelar
            </button>
            {form.id &&
              (confirmDelete ? (
                <button type="button" className="agenda-danger" onClick={() => void handleDelete()} disabled={saving}>
                  Confirmar exclusão
                </button>
              ) : (
                <button type="button" className="agenda-danger" onClick={() => setConfirmDelete(true)} disabled={saving}>
                  Excluir
                </button>
              ))}
          </div>
        </form>
      )}
      {form?.id && <PartnerCouponsManager communityId={communityId} partnerId={form.id} />}
      {form && !form.id && <p className="home-muted">Depois de salvar o parceiro, abra “Editar” para cadastrar os cupons dele.</p>}
    </div>
  )
}
