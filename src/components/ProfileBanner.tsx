import type { ReactNode } from 'react'

// Banner largo (de canto a canto) com a foto redonda sobreposta e o nome
// logo abaixo. `actions` (trocar foto/banner) ficam perto das imagens.
interface ProfileBannerProps {
  bannerUrl: string | null
  avatarUrl: string | null
  name: string | null
  city?: string | null
  actions?: ReactNode
}

export function ProfileBanner({ bannerUrl, avatarUrl, name, city, actions }: ProfileBannerProps) {
  return (
    <div className="profile-banner-wrap">
      <div className="profile-banner">
        {bannerUrl && <img src={bannerUrl} alt="" decoding="async" />}
      </div>
      <div className="profile-banner-avatar">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" decoding="async" />
        ) : (
          <span>{(name ?? 'U').charAt(0).toUpperCase()}</span>
        )}
      </div>
      {actions && <div className="profile-banner-actions">{actions}</div>}
      <h2 className="profile-banner-name">{name ?? 'Participante'}</h2>
      {city && <p className="profile-city profile-banner-city">{city}</p>}
    </div>
  )
}
