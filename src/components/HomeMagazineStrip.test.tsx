import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HomeMagazineStrip, MAGAZINE_STACK_MAX } from './HomeMagazineStrip'
import type { MagazineIssue } from '../types/magazine'

vi.mock('../hooks/useSignedImageUrl', () => ({
  useSignedImageUrl: (path: string | null) => ({ url: path ? `https://img.test/${path}` : null }),
}))

function issue(n: number): MagazineIssue {
  return {
    id: `issue-${n}`,
    community_id: 'c1',
    title: `Edição ${n}`,
    cover_path: `cover-${n}.jpg`,
    pages: [],
    published_at: '2026-11-01T00:00:00Z',
  } as unknown as MagazineIssue
}

describe('HomeMagazineStrip — pilha de revistas', () => {
  afterEach(() => cleanup())

  it('sem nenhuma edição, mostra a pilha cheia com exemplares em branco', () => {
    const { container } = render(<HomeMagazineStrip issues={[]} officeImage={null} />)
    expect(container.querySelectorAll('.mag2-stack-item')).toHaveLength(MAGAZINE_STACK_MAX)
    expect(screen.getAllByRole('button', { name: 'Revista em breve' })).toHaveLength(MAGAZINE_STACK_MAX)
  })

  it('com poucas edições, completa a pilha com antigas sem capa atrás das reais', () => {
    const { container } = render(
      <HomeMagazineStrip issues={[issue(2), issue(1)]} officeImage={null} />,
    )

    expect(container.querySelectorAll('.mag2-stack-item')).toHaveLength(MAGAZINE_STACK_MAX)
    expect(screen.getByRole('button', { name: 'Ler a revista Edição 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ler a revista Edição 1' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Revista em breve' })).toHaveLength(MAGAZINE_STACK_MAX - 2)
  })

  it('a edição mais nova fica na frente (primeira da lista de z-index mais alto)', () => {
    const { container } = render(
      <HomeMagazineStrip issues={[issue(2), issue(1)]} officeImage={null} />,
    )
    const items = Array.from(container.querySelectorAll<HTMLElement>('.mag2-stack-item'))
    const front = items.find((el) => el.style.zIndex === String(MAGAZINE_STACK_MAX))
    expect(front?.querySelector('button')).toHaveAttribute('aria-label', 'Ler a revista Edição 2')
  })

  it('com mais edições que o limite, só as mais novas entram na pilha', () => {
    const many = Array.from({ length: 9 }, (_, i) => issue(9 - i))
    const { container } = render(<HomeMagazineStrip issues={many} officeImage={null} />)
    expect(container.querySelectorAll('.mag2-stack-item')).toHaveLength(MAGAZINE_STACK_MAX)
  })

  it('o membro entra no escritório sem ver o cadastro de edições', () => {
    render(<HomeMagazineStrip issues={[issue(1)]} officeImage={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ler a revista Edição 1' }))
    fireEvent.click(screen.getByText('Entrar no Escritório Editorial'))

    expect(screen.getByRole('dialog', { name: 'Escritório Editorial' })).toBeInTheDocument()
    expect(screen.queryByText('Cadastro das edições')).not.toBeInTheDocument()
  })

  it('a profissional vê o cadastro de edições dentro do escritório', () => {
    render(
      <HomeMagazineStrip
        issues={[issue(1)]}
        officeImage={null}
        manager={<p>Cadastro das edições</p>}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ler a revista Edição 1' }))
    fireEvent.click(screen.getByText('Entrar no Escritório Editorial'))

    expect(screen.getByText('Cadastro das edições')).toBeInTheDocument()
  })
})
