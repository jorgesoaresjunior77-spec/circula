import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Profile, ProfileUpdateInput } from '../types/profile'

interface MyProfileProps {
  profile: Profile
  onUpdate: (input: ProfileUpdateInput) => Promise<{ error: string | null }>
  onUploadAvatar: (file: File) => Promise<{ error: string | null }>
}

export function MyProfile({ profile, onUpdate, onUploadAvatar }: MyProfileProps) {
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

  return (
    <section className="community-card">
      <div className="profile-header">
        <div className="profile-avatar">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" />
          ) : (
            <span>{(profile.full_name ?? 'U').charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div>
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

      {!editing ? (
        <>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}

          {profile.interests.length > 0 && (
            <div className="interest-tags">
              {profile.interests.map((interest) => (
                <span key={interest} className="interest-tag">
                  {interest}
                </span>
              ))}
            </div>
          )}

          {message && (
            <p className={message.type === 'success' ? 'auth-success' : 'auth-error'}>
              {message.text}
            </p>
          )}

          <button type="button" onClick={startEditing}>
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

          <label htmlFor="profile-interest">Interesses</label>
          <div className="interest-tags">
            {interests.map((interest) => (
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
              placeholder="Ex: corrida, alimentação..."
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
            <button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
