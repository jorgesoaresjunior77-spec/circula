import type { ComponentType } from 'react'
import { PlusIcon } from './icons'

export type NavKey =
  | 'inicio'
  | 'feed'
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
  /** Aparece também na barra inferior do mobile. */
  inBottomNav: boolean
}

interface PrimaryNavProps {
  items: NavItem[]
  active: NavKey
  onNavigate: (key: NavKey) => void
  /** Ação do botão "+" central do mobile. */
  onPlus: () => void
  plusLabel: string
  /** Contadores opcionais por destino (ex.: mensagens não lidas). */
  badges?: Partial<Record<NavKey, number>>
}

/**
 * Navegação primária do Círcula. Um único componente que renderiza a
 * sidebar (desktop, rail compacto só-ícone) e a barra inferior fixa
 * (mobile, com "+" central) — a alternância é 100% CSS. Puramente
 * apresentacional: não toca dados, hooks de negócio, Supabase ou auth.
 */
export function PrimaryNav({
  items,
  active,
  onNavigate,
  onPlus,
  plusLabel,
  badges,
}: PrimaryNavProps) {
  const bottomItems = items.filter((item) => item.inBottomNav)
  const splitAt = Math.ceil(bottomItems.length / 2)
  const leftItems = bottomItems.slice(0, splitAt)
  const rightItems = bottomItems.slice(splitAt)

  function badgeFor(key: NavKey) {
    const count = badges?.[key] ?? 0
    if (count <= 0) return null
    return <span className="nav-badge">{count > 99 ? '99+' : count}</span>
  }

  function renderBottomItem(item: NavItem) {
    return (
      <button
        key={item.key}
        type="button"
        className={`bottom-nav-item${active === item.key ? ' bottom-nav-item--active' : ''}`}
        aria-current={active === item.key ? 'page' : undefined}
        onClick={() => onNavigate(item.key)}
      >
        <span className="nav-icon-wrap">
          <item.Icon size={22} />
          {badgeFor(item.key)}
        </span>
        <span>{item.label}</span>
      </button>
    )
  }

  return (
    <>
      <nav className="sidebar" aria-label="Navegação principal">
        <ul className="sidebar-list">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className={`sidebar-item${active === item.key ? ' sidebar-item--active' : ''}`}
                aria-current={active === item.key ? 'page' : undefined}
                title={item.label}
                onClick={() => onNavigate(item.key)}
              >
                <span className="nav-icon-wrap">
                  <item.Icon size={22} />
                  {badgeFor(item.key)}
                </span>
                <span className="sidebar-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <nav className="bottom-nav" aria-label="Navegação principal">
        <div className="bottom-nav-side">{leftItems.map(renderBottomItem)}</div>
        <button
          type="button"
          className="bottom-nav-fab"
          aria-label={plusLabel}
          onClick={onPlus}
        >
          <PlusIcon size={24} />
        </button>
        <div className="bottom-nav-side">{rightItems.map(renderBottomItem)}</div>
      </nav>
    </>
  )
}
