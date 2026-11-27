import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HomePartnersStrip } from './HomePartnersStrip'

const partners = [
  { id: 'a', community_id: 'c', name: 'Alfa', logo_path: 'https://x.test/a.png', link_url: 'https://alfa.test/', position: 0, status: 'published' },
  { id: 'b', community_id: 'c', name: 'Beta', logo_path: 'https://x.test/b.png', link_url: null, position: 1, status: 'published' },
  { id: 'r', community_id: 'c', name: 'Rascunho', logo_path: 'https://x.test/r.png', link_url: null, position: 2, status: 'draft' },
]

vi.mock('../hooks/useManagedContent', () => ({
  useManagedContent: () => ({ items: partners }),
}))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: () => Promise.resolve({ data: [], error: null }) } }))
vi.mock('../lib/itemViews', () => ({ recordView: () => {} }))
vi.mock('../hooks/useSignedImageUrl', () => ({
  useSignedImageUrl: (path: string | null) => ({ url: path }),
}))

describe('HomePartnersStrip — logos lado a lado, andando para a esquerda', () => {
  afterEach(cleanup)

  it('mostra os publicados lado a lado e ignora rascunhos', () => {
    const { container } = render(<HomePartnersStrip communityId="c" />)
    const first = container.querySelector('.partner-seq:not([aria-hidden])')!
    const srcs = [...first.querySelectorAll('img')].map((img) => img.getAttribute('src'))
    expect(srcs.slice(0, 2)).toEqual(['https://x.test/a.png', 'https://x.test/b.png'])
    expect(srcs).not.toContain('https://x.test/r.png')
  })

  it('desenha a lista duas vezes (emenda sem salto) e a cópia é só visual', () => {
    const { container } = render(<HomePartnersStrip communityId="c" />)
    const halves = container.querySelectorAll('.partner-seq')
    expect(halves).toHaveLength(2)
    expect(halves[1]).toHaveAttribute('aria-hidden', 'true')
    expect(halves[0].querySelectorAll('img').length).toBe(halves[1].querySelectorAll('img').length)
    halves[1].querySelectorAll('button').forEach((b) => expect(b).toHaveAttribute('tabindex', '-1'))
  })

  it('tocar no logo abre a página do parceiro; o site sai pelo botão Visitar parceiro, em outra aba e com rel seguro', () => {
    render(<HomePartnersStrip communityId="c" />)
    fireEvent.click(screen.getAllByRole('button', { name: /Alfa: ver a página do parceiro/ })[0])
    expect(screen.getByRole('dialog', { name: 'Parceiro Alfa' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Visitar parceiro' })
    expect(link).toHaveAttribute('href', 'https://alfa.test/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('parceiro sem site não mostra o botão Visitar parceiro', () => {
    render(<HomePartnersStrip communityId="c" />)
    fireEvent.click(screen.getAllByRole('button', { name: /Beta: ver a página do parceiro/ })[0])
    expect(screen.queryByRole('link', { name: 'Visitar parceiro' })).not.toBeInTheDocument()
  })
})
