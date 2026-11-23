import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { ClaimsList } from './CityAdminPanel'
import { CityClaim } from './CityClaim'
import type { CityListing } from '../lib/city'

// ---- servidor simulado: guarda os pedidos e aplica as regras como o banco faz ----
interface Row {
  id: string
  listing_id: string
  titulo: string
  tipo: 'lugar'
  cidade: string
  estado: string
  nome: string
  whatsapp: string
  mensagem: string | null
  status: 'pendente' | 'aprovada' | 'recusada'
  criado_em: string
  destaque: null
}
let rows: Row[] = []
let owners: Record<string, string | null> = {}

const rpc = vi.fn(async (name: string, args: Record<string, string>) => {
  if (name === 'city_admin_claims') return { data: rows.filter((r) => r.status !== 'recusada'), error: null }
  if (name === 'city_claim_resolve') {
    const r = rows.find((x) => x.id === args.p_claim)!
    if (args.p_action === 'aprovar') {
      r.status = 'aprovada'
      owners[r.listing_id] = 'usuaria'
    } else if (args.p_action === 'recusar') r.status = 'recusada'
    else {
      r.status = 'recusada'
      owners[r.listing_id] = null
    }
    return { data: null, error: null }
  }
  return { data: null, error: null }
})
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (n: string, a: Record<string, string>) => rpc(n, a) } }))
vi.mock('../hooks/useCity', () => ({
  useCityCatalog: () => ({ categories: [], tags: [] }),
  useGroupImages: () => ({ images: {}, reload: vi.fn() }),
  setGroupImage: vi.fn(),
  uploadCityPhoto: vi.fn(),
  createClaim: vi.fn(async () => ({ error: null })),
  hasBillingData: vi.fn(async () => true),
  saveBillingData: vi.fn(),
  subscribeHighlight: vi.fn(),
  cancelHighlight: vi.fn(),
}))

const row = (over: Partial<Row>): Row => ({
  id: 'k1', listing_id: 'l1', titulo: 'Speed Box', tipo: 'lugar', cidade: 'Lajeado', estado: 'RS', nome: 'Ana',
  whatsapp: '51999998888', mensagem: null, status: 'pendente', criado_em: '2026-12-01T10:00:00Z', destaque: null, ...over,
})

beforeEach(() => {
  rows = [row({})]
  owners = { l1: null }
  rpc.mockClear()
})
afterEach(cleanup)

describe('Reivindicação: lista do profissional', () => {
  it('um pedido novo fica pendente e NÃO vincula o negócio', async () => {
    render(<ClaimsList />)
    expect(await screen.findByText('Speed Box')).toBeInTheDocument()
    expect(screen.getByText(/aguardando aprovação/)).toBeInTheDocument()
    expect(owners.l1).toBeNull()
  })

  it('o botão de WhatsApp abre a conversa com o número normalizado (DDI 55)', async () => {
    render(<ClaimsList />)
    const link = await screen.findByRole('link', { name: /WhatsApp/ })
    expect(link).toHaveAttribute('href', 'https://wa.me/5551999998888')
  })

  it('aprovar vincula o negócio e o pedido sai da lista de pendentes', async () => {
    render(<ClaimsList />)
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar' }))
    await waitFor(() => expect(owners.l1).toBe('usuaria'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument())
    expect(screen.getByText('Nenhum pedido pendente.')).toBeInTheDocument()
    // vai para "Negócios com dona", onde dá para tirar a dona
    expect(screen.getByText('Negócios com dona')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tirar a dona' })).toBeInTheDocument()
  })

  it('recusar não vincula nada e o pedido some da lista', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ClaimsList />)
    fireEvent.click(await screen.findByRole('button', { name: 'Recusar' }))
    await waitFor(() => expect(screen.getByText('Nenhum pedido pendente.')).toBeInTheDocument())
    expect(owners.l1).toBeNull()
    expect(screen.queryByText('Negócios com dona')).not.toBeInTheDocument()
  })
})

const listing = (over: Partial<CityListing>) =>
  ({ id: 'l1', tipo: 'lugar', reivindicado: false, sou_dona: false, minha_reivindicacao: null, pedido_em_aberto: false, destaque_meu: null, destaque_meu_id: null, destaque_ate: null, ...over }) as CityListing

describe('Reivindicação: o que a pessoa vê', () => {
  it('antes de pedir, avisa que nome e WhatsApp serão compartilhados com a profissional', () => {
    render(<CityClaim listing={listing({})} readOnly={false} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Este negócio é meu/ }))
    expect(screen.getByText(/nome e seu WhatsApp serão compartilhados com a profissional responsável/)).toBeInTheDocument()
  })

  it('pedido pendente: texto de aguardando', () => {
    render(<CityClaim listing={listing({ minha_reivindicacao: 'pendente', pedido_em_aberto: true })} readOnly={false} onChanged={vi.fn()} />)
    expect(screen.getByText(/aguardando aprovação/)).toBeInTheDocument()
  })

  it('pedido aprovado: mostra que é a dona', () => {
    render(<CityClaim listing={listing({ minha_reivindicacao: 'aprovada', reivindicado: true, sou_dona: true })} readOnly={false} onChanged={vi.fn()} />)
    expect(screen.getByText(/Pedido aprovado: você é a dona/)).toBeInTheDocument()
  })

  it('pedido recusado: texto claro e dá para pedir de novo', () => {
    render(<CityClaim listing={listing({ minha_reivindicacao: 'recusada' })} readOnly={false} onChanged={vi.fn()} />)
    expect(screen.getByText(/pedido anterior foi recusado/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Este negócio é meu/ })).toBeInTheDocument()
  })
})
