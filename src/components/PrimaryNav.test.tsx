import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { PrimaryNav } from './PrimaryNav'
import type { NavItem } from './PrimaryNav'

function DummyIcon() {
  return <svg aria-hidden="true" />
}

/**
 * Mesma composição que Dashboard.tsx monta de verdade para uma Member
 * (ver navItems em Dashboard.tsx): Início/Feed/Perfil vão para a
 * cápsula (`inBottomNav: true`); Círculos/Eventos/Receitas/Jardim/
 * Loja/Mensagens não vão — ficam só nos cards da Home e no chip do
 * desktop. Fixture local, não importa Dashboard.tsx (fora do escopo
 * dos 5 itens autorizados) — só replica a FORMA real dos dados que
 * PrimaryNav recebe.
 */
const MEMBER_ITEMS: NavItem[] = [
  { key: 'inicio', label: 'Início', Icon: DummyIcon, inBottomNav: true },
  { key: 'feed', label: 'Feed', Icon: DummyIcon, inBottomNav: true },
  { key: 'circulos', label: 'Círculos', Icon: DummyIcon, inBottomNav: false },
  { key: 'eventos', label: 'Eventos', Icon: DummyIcon, inBottomNav: false },
  { key: 'receitas', label: 'Receitas', Icon: DummyIcon, inBottomNav: false },
  { key: 'jardim', label: 'Meu Jardim', Icon: DummyIcon, inBottomNav: false },
  { key: 'loja', label: 'Loja', Icon: DummyIcon, inBottomNav: false },
  { key: 'mensagens', label: 'Mensagens', Icon: DummyIcon, inBottomNav: false },
  { key: 'perfil', label: 'Meu perfil', Icon: DummyIcon, inBottomNav: true },
]

/** Mesma lista + "Painel", como a anfitriã (Professional) recebe — Jardim continua fora da cápsula. */
const HOST_ITEMS: NavItem[] = [
  ...MEMBER_ITEMS.slice(0, -1),
  { key: 'painel', label: 'Painel', Icon: DummyIcon, inBottomNav: true },
  MEMBER_ITEMS[MEMBER_ITEMS.length - 1],
]

describe('PrimaryNav — Item 2: "Meu Jardim" não pode entrar na cápsula inferior', () => {
  afterEach(() => {
    cleanup()
  })

  it('(Member) renderiza "Meu Jardim" no chip do desktop, mas não na cápsula fixa', () => {
    const { container } = render(<PrimaryNav items={MEMBER_ITEMS} active="inicio" onNavigate={vi.fn()} />)

    // Aparece exatamente 1x no total (só no .topnav-list) — nunca 2x
    // (o que aconteceria se também tivesse entrado na cápsula).
    expect(screen.getAllByText('Meu Jardim')).toHaveLength(1)

    const bottomNav = container.querySelector('.bottom-nav-list') as HTMLElement
    expect(within(bottomNav).queryByText('Meu Jardim')).not.toBeInTheDocument()
  })

  it('(Member) a cápsula fixa contém só Início, Feed e Meu perfil — nenhum destino a mais', () => {
    const { container } = render(<PrimaryNav items={MEMBER_ITEMS} active="inicio" onNavigate={vi.fn()} />)

    const bottomNav = container.querySelector('.bottom-nav-list') as HTMLElement
    const labels = within(bottomNav)
      .getAllByRole('button')
      .map((btn) => btn.textContent)

    expect(labels).toEqual(['Início', 'Feed', 'Meu perfil'])
  })

  it('(anfitriã, com Painel) a cápsula ganha "Painel" mas "Meu Jardim" continua de fora — sem regressão por causa do novo card', () => {
    const { container } = render(<PrimaryNav items={HOST_ITEMS} active="inicio" onNavigate={vi.fn()} />)

    const bottomNav = container.querySelector('.bottom-nav-list') as HTMLElement
    const labels = within(bottomNav)
      .getAllByRole('button')
      .map((btn) => btn.textContent)

    expect(labels).toEqual(['Início', 'Feed', 'Painel', 'Meu perfil'])
    expect(within(bottomNav).queryByText('Meu Jardim')).not.toBeInTheDocument()
  })

  it('o chip "Meu Jardim" do desktop ainda navega corretamente para a chave certa', () => {
    const onNavigate = vi.fn()
    render(<PrimaryNav items={MEMBER_ITEMS} active="inicio" onNavigate={onNavigate} />)

    screen.getByText('Meu Jardim').closest('button')!.click()

    expect(onNavigate).toHaveBeenCalledWith('jardim')
  })
})
