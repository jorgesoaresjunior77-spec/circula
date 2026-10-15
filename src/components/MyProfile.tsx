import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Profile, ProfileUpdateInput } from '../types/profile'
import { ABOUT_ME_OPTIONS } from '../lib/aboutMeOptions'
import { ProfileGallery } from './ProfileGallery'

interface MyProfileProps {
  profile: Profile
  onUpdate: (input: ProfileUpdateInput) => Promise<{ error: string | null }>
  onUploadAvatar: (file: File) => Promise<{ error: string | null }>
  /** Item 10 — upload cru de uma foto da galeria (bucket `avatars`);
   *  devolve a URL pública, não toca `profiles`. */
  onUploadGalleryPhoto: (file: File) => Promise<{ url: string | null; error: string | null }>
}

export function MyProfile({ profile, onUpdate, onUploadAvatar, onUploadGalleryPhoto }: MyProfileProps) {
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [city, setCity] = useState(profile.city ?? '')
  const [interests, setInterests] = useState<string[]>(profile.interests)
  const [interestDraft, setInterestDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  )
  // Item 10 — galeria: independente do modo de edição do resto do
  // formulário, igual ao avatar ("Trocar foto" já funciona fora do
  // `editing`). `galleryBusyIndex` identifica qual vaga está enviando
  // (desabilita só aquele slot, não a galeria inteira).
  const [galleryBusyIndex, setGalleryBusyIndex] = useState<number | null>(null)

  function startEditing() {
    setFullName(profile.full_name ?? '')
    setBio(profile.bio ?? '')
    setCity(profile.city ?? '')
    setInterests(profile.interests)
    setInterestDraft('')
    setMessage(null)
    setEditing(true)
  }

  function addInterest() {
    const value = interestDraft.trim()
    if (!value || interests.includes(value)) return
    setInterests([...interests, value])
    setInterestDraft('')
  }

  function removeInterest(value: string) {
    setInterests(interests.filter((item) => item !== value))
  }

  // Item 9 — "Um pouco sobre mim": marcar/desmarcar um item sugerido é o
  // mesmo add/remove de sempre em `interests`, só partindo de uma lista
  // fixa em vez de texto livre.
  function toggleAboutMe(value: string) {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)

    const { error } = await onUpdate({
      full_name: fullName.trim() ? fullName.trim() : null,
      bio: bio.trim() ? bio.trim() : null,
      city: city.trim() ? city.trim() : null,
      interests,
    })

    setSaving(false)

    if (error) {
      setMessage({ type: 'error', text: 'Não foi possível salvar agora. Tente novamente.' })
      return
    }

    setMessage({ type: 'success', text: 'Perfil atualizado.' })
    setEditing(false)
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMessage(null)

    const { error } = await onUploadAvatar(file)

    setUploading(false)
    event.target.value = ''

    if (error) {
      setMessage({ type: 'error', text: 'Não foi possível enviar a foto agora. Tente novamente.' })
      return
    }

    setMessage({ type: 'success', text: 'Foto atualizada.' })
  }

  // Item 10 — galeria: upload "cru" (onUploadGalleryPhoto, bucket
  // `avatars`) seguido de persistir o array via onUpdate, exatamente
  // como CoverImageInput + createCircle/renameCircle já fazem noutras
  // telas. `profile.gallery_photos` é sempre a fonte da verdade — o
  // pai (Dashboard/useAuth) recarrega o perfil após cada onUpdate.
  async function handleGalleryAdd(file: File) {
    setGalleryBusyIndex(profile.gallery_photos.length)
    setMessage(null)

    const { url, error: uploadError } = await onUploadGalleryPhoto(file)
    if (uploadError || !url) {
      setGalleryBusyIndex(null)
      setMessage({ type: 'error', text: 'Não foi possível enviar a foto agora. Tente novamente.' })
      return
    }

    const { error } = await onUpdate({ gallery_photos: [...profile.gallery_photos, url] })
    setGalleryBusyIndex(null)
    if (error) {
      setMessage({ type: 'error', text: 'Não foi possível salvar a foto agora. Tente novamente.' })
      return
    }
    setMessage({ type: 'success', text: 'Foto adicionada.' })
  }

  async function handleGalleryReplace(index: number, file: File) {
    setGalleryBusyIndex(index)
    setMessage(null)

    const { url, error: uploadError } = await onUploadGalleryPhoto(file)
    if (uploadError || !url) {
      setGalleryBusyIndex(null)
      setMessage({ type: 'error', text: 'Não foi possível enviar a foto agora. Tente novamente.' })
      return
    }

    const next = [...profile.gallery_photos]
    next[index] = url
    const { error } = await onUpdate({ gallery_photos: next })
    setGalleryBusyIndex(null)
    if (error) {
      setMessage({ type: 'error', text: 'Não foi possível salvar a foto agora. Tente novamente.' })
      return
    }
    setMessage({ type: 'success', text: 'Foto atualizada.' })
  }

  async function handleGalleryRemove(index: number) {
    setGalleryBusyIndex(index)
    setMessage(null)

    const next = profile.gallery_photos.filter((_, i) => i !== index)
    const { error } = await onUpdate({ gallery_photos: next })
    setGalleryBusyIndex(null)
    if (error) {
      setMessage({ type: 'error', text: 'Não foi possível remover a foto agora. Tente novamente.' })
      return
    }
    setMessage({ type: 'success', text: 'Foto removida.' })
  }

  return (
    <section className="community-card community-card--profile">
      <p className="profile-eyebrow">Meu perfil</p>
      <div className="profile-header">
        <div className="profile-avatar">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" />
          ) : (
            <span>{(profile.full_name ?? 'U').charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="profile-identity">
          <h2>{profile.full_name ?? 'Seu perfil'}</h2>
          {profile.city && <p className="profile-city">{profile.city}</p>}
          <label className="auth-link">
            {uploading ? 'Enviando...' : 'Trocar foto'}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              disabled={uploading}
              hidden
            />
          </label>
        </div>
      </div>

      {/* Item 10 — galeria de fotos: sempre visível e editável, fora do
          `editing` do resto do formulário (mesmo padrão do avatar). */}
      <div className="profile-gallery-section">
        <p className="profile-section-label">Minhas fotos</p>
        <ProfileGallery
          photos={profile.gallery_photos}
          editable
          busyIndex={galleryBusyIndex}
          onAdd={handleGalleryAdd}
          onReplace={handleGalleryReplace}
          onRemove={handleGalleryRemove}
        />
      </div>

      {!editing ? (
        <>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}

          {/* Item 9 — "Um pouco sobre mim": só os itens da lista sugerida
              que a usuária marcou. Opcional — some por completo sem
              nenhum marcado, nunca uma seção vazia. */}
          {(() => {
            const aboutMe = ABOUT_ME_OPTIONS.filter((option) =>
              profile.interests.includes(option),
            )
            return (
              aboutMe.length > 0 && (
                <div className="profile-about-me">
                  <p className="profile-section-label">Um pouco sobre mim</p>
                  <div className="interest-tags interest-tags--view">
                    {aboutMe.map((item) => (
                      <span key={item} className="interest-tag">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )
            )
          })()}

          {/* Interesses em texto livre — segue existindo, só sem repetir
              os itens que já aparecem em "Um pouco sobre mim" acima. */}
          {(() => {
            const freeform = profile.interests.filter(
              (interest) => !(ABOUT_ME_OPTIONS as readonly string[]).includes(interest),
            )
            return (
              freeform.length > 0 && (
                <div className="interest-tags interest-tags--view">
                  {freeform.map((interest) => (
                    <span key={interest} className="interest-tag">
                      {interest}
                    </span>
                  ))}
                </div>
              )
            )
          })()}

          {message && (
            <p className={message.type === 'success' ? 'auth-success' : 'auth-error'}>
              {message.text}
            </p>
          )}

          <button type="button" className="profile-edit-action" onClick={startEditing}>
            Editar perfil
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <label htmlFor="profile-name">Nome completo</label>
          <input
            id="profile-name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />

          <label htmlFor="profile-city">Cidade</label>
          <input
            id="profile-city"
            type="text"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Ex: Belo Horizonte"
          />

          <label htmlFor="profile-bio">Sobre você</label>
          <textarea
            id="profile-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={4}
            placeholder="Uma apresentação curta para as outras mulheres."
          />

          {/* Item 9 — "Um pouco sobre mim": caixas de seleção, várias
              marcáveis, opcional (nenhuma obrigatória). Marcar/desmarcar
              só chama `toggleAboutMe`, que lê/grava o mesmo array
              `interests` de sempre — persistência idêntica à de
              "Interesses" abaixo, mesmo `onUpdate` no submit. */}
          <fieldset className="profile-about-me-field">
            <legend>Um pouco sobre mim</legend>
            <p className="profile-field-hint">
              Opcional — marque o que quiser compartilhar com as outras mulheres.
            </p>
            <div className="about-me-options">
              {ABOUT_ME_OPTIONS.map((option) => (
                <label key={option} className="about-me-option">
                  <input
                    type="checkbox"
                    checked={interests.includes(option)}
                    onChange={() => toggleAboutMe(option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label htmlFor="profile-interest">Outros interesses</label>
          <div className="interest-tags">
            {interests
              .filter((interest) => !(ABOUT_ME_OPTIONS as readonly string[]).includes(interest))
              .map((interest) => (
                <span key={interest} className="interest-tag">
                  {interest}
                  <button
                    type="button"
                    onClick={() => removeInterest(interest)}
                    aria-label={`Remover ${interest}`}
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>
          <div className="interest-input-row">
            <input
              id="profile-interest"
              type="text"
              value={interestDraft}
              onChange={(event) => setInterestDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addInterest()
                }
              }}
              placeholder="Ex: corrida, leitura, meditação..."
            />
            <button type="button" onClick={addInterest}>
              Adicionar
            </button>
          </div>

          {message && (
            <p className={message.type === 'success' ? 'auth-success' : 'auth-error'}>
              {message.text}
            </p>
          )}

          <div className="profile-actions">
            <button type="button" className="auth-link" onClick={() => setEditing(false)}>
              Cancelar
            </button>
            <button type="submit" className="profile-save-action" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
