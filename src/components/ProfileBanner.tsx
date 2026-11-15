import type { ReactNode } from 'react'

// Capa do perfil em 9:16 (retrato): o banner ocupa o cartão inteiro e, por
// cima dele, ficam a foto redonda e as informações da pessoa — nome, cidades,
// "sobre" e interesses — sobre um véu escuro, para ler bem em qualquer foto.
// `actions` (trocar foto/banner) ficam logo abaixo do cartão.
interface ProfileBannerProps {
  bannerUrl: string | null
  avatarUrl: string | null
  name: string | null
  city?: string | null
  /** Cidade onde nasceu. */
  birthCity?: string | null
  bio?: string | null
  interests?: string[]
  actions?: ReactNode
}

const MAX_CHIPS = 8

export function ProfileBanner({
  bannerUrl,
  avatarUrl,
  name,
  city,
  birthCity,
  bio,
  interests = [],
  actions,
}: ProfileBannerProps) {
  const places = [city ? `Mora em ${city}` : null, birthCity ? `Nasceu em ${birthCity}` : null].filter(Boolean)
  const chips = interests.slice(0, MAX_CHIPS)
  const extra = interests.length - chips.length

  return (
    <div className="profile-banner-wrap profile-hero-wrap">
      <div className={`profile-hero${bannerUrl ? '' : ' profile-hero--empty'}`}>
        {bannerUrl && <img className="profile-hero-bg" src={bannerUrl} alt="" decoding="async" />}
        <div className="profile-hero-veil" aria-hidden="true" />
        <div className="profile-hero-info">
          <div className="profile-banner-avatar profile-hero-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" decoding="async" />
            ) : (
              <span>{(name ?? 'U').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <h2 className="profile-banner-name profile-hero-name">{name ?? 'Participante'}</h2>
          {places.length > 0 && <p className="profile-hero-places">{places.join(' · ')}</p>}
          {bio && <p className="profile-hero-bio">{bio}</p>}
          {chips.length > 0 && (
            <ul className="profile-hero-chips" aria-label="Interesses">
              {chips.map((item) => (
                <li key={item}>{item}</li>
              ))}
              {extra > 0 && <li>+{extra}</li>}
            </ul>
          )}
        </div>
      </div>
      {actions && <div className="profile-banner-actions">{actions}</div>}
    </div>
  )
}
