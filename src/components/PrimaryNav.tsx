import type { ComponentType } from 'react'

export type NavKey =
  | 'inicio'
  | 'feed'
  // 'comunidades' permanece no tipo (mesmo padrão de 'salvos' abaixo):
  // reorganização do menu removeu o destino — gestão de comunidade
  // mora no Painel, Member chega ao conteúdo pelo Feed — mas nenhum
  // componente/hook que dependa do tipo precisa mudar. Nunca mais
  // empurrado para `navItems` em Dashboard.tsx.
  | 'comunidades'
  | 'circulos'
  | 'eventos'
  | 'receitas'
  // 'salvos' permanece no tipo: destino desativado da navegação primária
  // na Fase 1 (Módulo 7 despriorizado), código mantido dormente.
  | 'salvos'
  | 'mensagens'
  | 'painel'
  | 'loja'
  | 'perfil'

export interface NavItem {
  key: NavKey
  label: string
  Icon: ComponentType<{ size?: number; className?: string }>
  /** Decide quais destinos aparecem na cápsula fixa do mobile (os demais
   *  continuam alcançáveis pelos cards da Home e pelos chips do desktop
   *  — ver HomeExperienceStrip). Calculado por papel no Dashboard. */
  inBottomNav: boolean
}

interface PrimaryNavProps {
  items: NavItem[]
  active: NavKey
  onNavigate: (key: NavKey) => void
  /** Contadores opcionais por destino (ex.: mensagens não lidas). */
  badges?: Partial<Record<NavKey, number>>
}

/**
 * Navegação primária do Círcula — sem menu lateral e sem folha de
 * overflow.
 *
 * Ajustes de navegação (item 1) — o botão "Menu" (três risquinhos) e a
 * folha "Mais" saíram por completo: a barra inferior fixa do mobile
 * (cápsula flutuante, estilo Netflix/Prime Video) é a ÚNICA navegação
 * principal, com exatamente os destinos marcados `inBottomNav` (Início/
 * Feed/Painel/Perfil para quem tem Painel; Início/Feed/Perfil para as
 * demais). Os destinos que não cabem na cápsula (Círculos, Eventos,
 * Loja, Receitas, Mensagens) continuam acessíveis pelos cards fixos de
 * "Hoje no Círcula" na Home (HomeExperienceStrip) — nenhuma tela ficou
 * sem acesso, só mudou o caminho. No desktop (>= 1024px), `.topnav-list`
 * continua mostrando todos os destinos como chips, inalterada.
 */
export function PrimaryNav({ items, active, onNavigate, badges }: PrimaryNavProps) {
  const bottomItems = items.filter((item) => item.inBottomNav)

  function badgeFor(key: NavKey) {
    const count = badges?.[key] ?? 0
    if (count <= 0) return null
    return <span className="nav-badge">{count > 99 ? '99+' : count}</span>
  }

  return (
    <nav className="topnav" aria-label="Navegação principal">
      {/* Desktop — lista única de destinos, chips compactos. */}
      <ul className="topnav-list">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={`topnav-item${active === item.key ? ' topnav-item--active' : ''}`}
              aria-current={active === item.key ? 'page' : undefined}
              title={item.label}
              onClick={() => onNavigate(item.key)}
            >
              <span className="nav-icon-wrap">
                <item.Icon size={14} />
                {badgeFor(item.key)}
              </span>
              <span className="topnav-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* Mobile (< 1024px) — cápsula flutuante fixa, única navegação. */}
      <div className="bottom-nav">
        <ul className="bottom-nav-list">
          {bottomItems.map((item) => {
            // Feed é o destino central da cápsula — ícone um pouco maior
            // e mais escuro que os demais (diferença sutil).
            const isFeed = item.key === 'feed'
            return (
              <li key={item.key}>
                <button
                  type="button"
                  className={`bottom-nav-item${active === item.key ? ' bottom-nav-item--active' : ''}${isFeed ? ' bottom-nav-item--feed' : ''}`}
                  aria-current={active === item.key ? 'page' : undefined}
                  onClick={() => onNavigate(item.key)}
                >
                  <span className="nav-icon-wrap">
                    <item.Icon size={isFeed ? 26 : 22} />
                    {badgeFor(item.key)}
                  </span>
                  <span className="bottom-nav-label">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
