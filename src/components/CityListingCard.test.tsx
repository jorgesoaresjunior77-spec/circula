import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CityListingCard } from './CityListingCard'
import type { CityListing } from '../lib/city'

vi.mock('../hooks/useCity', () => ({
  fetchAttendees: vi.fn(async () => []),
  fetchReviews: vi.fn(async () => []),
  saveReview: vi.fn(async () => ({ error: null })),
  deleteReview: vi.fn(async () => ({ error: null })),
  adminDeleteReview: vi.fn(async () => ({ error: null })),
}))

const base: CityListing = {
  id: 'l1', city_id: 'c', cidade: 'Lajeado', estado: 'RS', tipo: 'lugar', categoria_id: null, titulo: 'Speed Box',
  descricao: 'Academia boa', bairro: 'Centro', endereco: 'Rua A, 10', contato: '(51) 99999-9999', instagram: null,
  faixa_preco: null, horario: 'Combinar', horarios: { seg: '06:00-22:00', ter: '06:00-22:00', dom: 'fechado' }, foto: null,
  criado_por: 'autora', autora_nome: 'Elisa', autora_avatar: null, e_proprio_negocio: false, atende_toda_cidade: false,
  status: 'ativo', criado_em: '2026-11-23T08:00:00Z', starts_at: null, local_nome: null, valor: null, link: null,
  atividade: null, vagas: null, nivel: null, votos: 0, votei: false, salvei: false, confirmadas: 0, vou: false,
  media: 4.5, avaliacoes: 2, minha_nota: null, reivindicado: false, sou_dona: false, minha_reivindicacao: null, pedido_em_aberto: false,
  destaque: false, destaque_meu: null, destaque_meu_id: null, destaque_ate: null, tags: [],
}

function props(over: Record<string, unknown> = {}) {
  const ok = async () => ({ error: null })
  return { listing: base, category: null, tags: [], uid: 'outra', isAdmin: false, onVote: vi.fn(ok), onSave: vi.fn(ok), onGo: vi.fn(ok), onEdit: vi.fn(), onDelete: vi.fn(ok), onHide: vi.fn(ok), onReport: vi.fn(ok), ...over }
}

describe('CityListingCard', () => {
  afterEach(cleanup)

  it('Salvar chama o salvamento do cadastro', async () => {
    const p = props()
    render(<CityListingCard {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    await waitFor(() => expect(p.onSave).toHaveBeenCalledWith(base))
  })

  it('mostra a média em estrelas, o horário por dia e o telefone clicável', () => {
    render(<CityListingCard {...props()} />)
    expect(screen.getByText('4,5')).toBeTruthy()
    expect(screen.getByText(/2 avaliações/)).toBeTruthy()
    expect(screen.getByText(/Seg a Ter 06:00 às 22:00 · Dom fechado · Combinar/)).toBeTruthy()
    expect((screen.getByText('(51) 99999-9999') as HTMLAnchorElement).href).toContain('tel:+5551999999999')
  })

  it('quem criou não avalia o próprio cadastro; as demais veem o formulário de nota', async () => {
    const { unmount } = render(<CityListingCard {...props({ uid: 'autora' })} />)
    fireEvent.click(screen.getByRole('button', { name: /Avaliar e ver comentários/ }))
    expect(await screen.findByText(/não pode avaliá-lo/)).toBeTruthy()
    unmount()
    render(<CityListingCard {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: /Avaliar e ver comentários/ }))
    expect(await screen.findByRole('radiogroup', { name: 'Sua nota' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Publicar avaliação/ })).toBeTruthy()
  })
})
