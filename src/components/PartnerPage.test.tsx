import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }))
vi.mock('../lib/itemViews', () => ({ recordView: () => {} }))
vi.mock('../hooks/useSignedImageUrl', () => ({ useSignedImageUrl: () => ({ url: null }) }))

import { PartnerPage } from './PartnerPage'
import type { Partner } from '../lib/partners'

const partner: Partner = {
  id: 'p1',
  community_id: 'c1',
  name: 'Loja Flor',
  logo_path: 'x.png',
  link_url: 'https://flor.test/',
  position: 0,
  status: 'published',
  instagram: '@lojaflor',
  city_listing_id: 'l1',
}

const coupon = (over: Record<string, unknown>) => ({
  id: 'k1',
  title: 'Boas-vindas',
  code: 'FLOR10',
  benefit: '10% em qualquer compra',
  discount_type: 'percentual',
  discount_value: 10,
  instructions: 'Mostre no caixa.',
  valid_from: null,
  valid_until: '2027-01-31',
  max_per_person: 3,
  after_redeem: 'mark',
  used: 1,
  available: true,
  status: 'disponivel',
  ...over,
})

describe('PartnerPage', () => {
  afterEach(() => {
    cleanup()
    rpc.mockReset()
  })

  it('mostra Instagram do próprio parceiro, site, estabelecimento e o cupom só com os campos da participante', async () => {
    rpc.mockResolvedValue({ data: [coupon({})], error: null })
    const onOpenListing = vi.fn()
    render(<PartnerPage partner={partner} onClose={() => {}} onOpenListing={onOpenListing} />)
    expect(screen.getByRole('link', { name: /Instagram de Loja Flor/ })).toHaveAttribute('href', 'https://www.instagram.com/lojaflor/')
    expect(screen.getByRole('link', { name: 'Visitar parceiro' })).toHaveAttribute('href', 'https://flor.test/')
    fireEvent.click(screen.getByRole('button', { name: 'Ver estabelecimento na Minha cidade' }))
    expect(onOpenListing).toHaveBeenCalledWith('l1')
    expect(await screen.findByLabelText('Código FLOR10')).toBeInTheDocument()
    expect(screen.getByText('10% OFF')).toBeInTheDocument()
    expect(screen.getByText('Restam 2 usos')).toBeInTheDocument()
    expect(screen.getByText('Válido até 31/01/2027')).toBeInTheDocument()
    // nada de campos de gestão para a participante
    expect(screen.queryByText(/por pessoa/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Editar|Desativar/)).not.toBeInTheDocument()
  })

  it('cupom esgotado aparece riscado e sem botão de usar', async () => {
    rpc.mockResolvedValue({ data: [coupon({ used: 3, available: false, status: 'esgotado' })], error: null })
    render(<PartnerPage partner={partner} onClose={() => {}} />)
    const code = await screen.findByLabelText('Código FLOR10')
    expect(code.className).toMatch(/--used/)
    expect(screen.getByText('Já utilizado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Usar este cupom' })).not.toBeInTheDocument()
  })

  it('limite atingido no banco vira mensagem clara', async () => {
    rpc.mockImplementation((fn: string) =>
      fn === 'list_partner_coupons'
        ? Promise.resolve({ data: [coupon({})], error: null })
        : Promise.resolve({ data: null, error: { message: 'limit_reached' } }),
    )
    render(<PartnerPage partner={partner} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Usar este cupom' }))
    await waitFor(() => expect(screen.getByText('Você já usou este cupom o máximo de vezes permitido.')).toBeInTheDocument())
    expect(rpc).toHaveBeenCalledWith('redeem_partner_coupon', { p_coupon_id: 'k1' })
  })
})
