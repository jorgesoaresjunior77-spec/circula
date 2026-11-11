import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { HomePartnersStrip, PARTNER_ROTATE_MS } from './HomePartnersStrip'

const partners = [
  { id: 'a', community_id: 'c', name: 'Alfa', logo_path: 'https://x.test/a.png', link_url: 'https://alfa.test/', position: 0, status: 'published' },
  { id: 'b', community_id: 'c', name: 'Beta', logo_path: 'https://x.test/b.png', link_url: null, position: 1, status: 'published' },
  { id: 'r', community_id: 'c', name: 'Rascunho', logo_path: 'https://x.test/r.png', link_url: null, position: 2, status: 'draft' },
]

vi.mock('../hooks/useManagedContent', () => ({
  useManagedContent: () => ({ items: partners }),
}))
vi.mock('../hooks/useSignedImageUrl', () => ({
  useSignedImageUrl: (path: string | null) => ({ url: path }),
}))

describe('HomePartnersStrip — um parceiro de cada vez', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('mostra só um logo por vez, nas cores originais, e ignora rascunhos', () => {
    const { container } = render(<HomePartnersStrip communityId="c" />)
    expect(container.querySelectorAll('.partner-logo img')).toHaveLength(1)
    // Só os 2 publicados têm pontinho.
    expect(screen.getAllByRole('button', { name: /Parceiro \d de 2/ })).toHaveLength(2)
    expect(container.textContent).not.toContain('Rascunho')
  })

  it('o logo com link abre o site do parceiro em outra aba, com rel seguro', () => {
    render(<HomePartnersStrip communityId="c" />)
    const link = screen.getByRole('link', { name: /Alfa \(abre o site do parceiro\)/ })
    expect(link).toHaveAttribute('href', 'https://alfa.test/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('gira sozinho para o próximo e volta ao primeiro; parceiro sem link não vira link', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const { container } = render(<HomePartnersStrip communityId="c" />)
    expect(container.querySelector('.partner-logo img')).toHaveAttribute('src', 'https://x.test/a.png')

    act(() => {
      vi.advanceTimersByTime(PARTNER_ROTATE_MS)
    })
    expect(container.querySelector('.partner-logo img')).toHaveAttribute('src', 'https://x.test/b.png')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(PARTNER_ROTATE_MS)
    })
    expect(container.querySelector('.partner-logo img')).toHaveAttribute('src', 'https://x.test/a.png')
  })

  it('os pontinhos trocam o parceiro na mão', () => {
    const { container } = render(<HomePartnersStrip communityId="c" />)
    fireEvent.click(screen.getByRole('button', { name: /Parceiro 2 de 2: Beta/ }))
    expect(container.querySelector('.partner-logo img')).toHaveAttribute('src', 'https://x.test/b.png')
  })
})
