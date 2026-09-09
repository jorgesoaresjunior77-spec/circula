import { useEffect, useId, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { CloseIcon } from './icons'
import circulaIcon from '../assets/circula-icon.png'

export type NavKey =
  | 'inicio'
  | 'feed'
  | 'comunidades'
  | 'circulos'
  | 'eventos'
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
  /** Campo dormente desde a Etapa B2: a barra inferior do mobile foi
   *  substituída pela folha de navegação, que mostra TODOS os itens.
   *  Mantido só para não alterar a construção de navItems no Dashboard. */
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
 * Navegação primária do Círcula — sem menu lateral, sem barra inferior.
 *
 * Desktop (>= 1024px): barra superior editorial com os itens em linha
 * (Etapa B1). Mobile (< 1024px): a mesma barra recolhe para um botão
 * "Menu" arredondado que abre uma folha/overlay com EXATAMENTE os
 * mesmos itens e destinos. A alternância é 100% CSS; só o aberto/fechado
 * da folha é estado local. Puramente apresentacional: não toca dados,
 * hooks de negócio, Supabase ou auth. onNavigate / badges / aria-current
 * / destinos: inalterados.
 */
export function PrimaryNav({ items, active, onNavigate, badges }: PrimaryNavProps) {
  const [open, setOpen] = useState(false)
  const sheetId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  function badgeFor(key: NavKey) {
    const count = badges?.[key] ?? 0
    if (count <= 0) return null
    return <span className="nav-badge">{count > 99 ? '99+' : count}</span>
  }

  function close() {
    setOpen(false)
  }

  // Enquanto a folha está aberta: foco entra nela, ESC e Tab tratados,
  // rolagem do fundo travada. Ao fechar, o foco volta para o botão.
  // Respeita prefers-reduced-motion via CSS (sem animação por JS).
  useEffect(() => {
    if (!open) return

    const toggle = toggleRef.current
    const sheet = sheetRef.current
    sheet?.querySelector<HTMLElement>('[data-autofocus]')?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
        return
      }
      if (event.key !== 'Tab' || !sheet) return
      const focusables = sheet.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
      toggle?.focus()
    }
  }, [open])

  return (
    <nav className="topnav" aria-label="Navegação principal">
      {/* Desktop — itens em linha (Etapa B1). Escondido no mobile. */}
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
                <item.Icon size={18} />
                {badgeFor(item.key)}
              </span>
              <span className="topnav-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* Mobile — botão arredondado que abre a folha. Escondido no desktop. */}
      <button
        ref={toggleRef}
        type="button"
        className="topnav-toggle"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={sheetId}
        onClick={() => setOpen(true)}
      >
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none" aria-hidden="true">
          <path
            d="M1 1h16M1 6h16M1 11h16"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <span className="topnav-toggle-label">Menu</span>
      </button>

      {open && (
        <div className="nav-sheet-backdrop" onClick={close}>
          <div
            ref={sheetRef}
            id={sheetId}
            className="nav-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Navegação"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="nav-sheet-head">
              <img src={circulaIcon} alt="Círcula" className="nav-sheet-mark" />
              <button
                type="button"
                className="nav-sheet-close"
                onClick={close}
                aria-label="Fechar menu"
                data-autofocus
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <ul className="nav-sheet-list">
              {items.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    className={`nav-sheet-item${
                      active === item.key ? ' nav-sheet-item--active' : ''
                    }`}
                    aria-current={active === item.key ? 'page' : undefined}
                    onClick={() => {
                      onNavigate(item.key)
                      close()
                    }}
                  >
                    <span className="nav-icon-wrap">
                      <item.Icon size={20} />
                      {badgeFor(item.key)}
                    </span>
                    <span className="nav-sheet-label">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </nav>
  )
}
