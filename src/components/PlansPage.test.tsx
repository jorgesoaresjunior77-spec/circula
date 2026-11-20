import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { PlansPage } from './PlansPage'

vi.mock('../hooks/useBillingPlans', () => ({
  useBillingPlans: () => ({ plans: [] }),
}))
vi.mock('./SubscriptionPanel', () => ({
  SubscriptionPanel: () => <div data-testid="subscription-panel" />,
}))

describe('PlansPage', () => {
  afterEach(() => cleanup())

  it('a membro abre o cartão do Círcula e vê o painel para assinar', () => {
    render(<PlansPage communityId="c1" />)
    fireEvent.click(screen.getByRole('button', { name: /^Círcula, / }))
    expect(screen.getByTestId('subscription-panel')).toBeInTheDocument()
  })

  it('a profissional vê a página sem poder assinar, com um aviso', () => {
    render(<PlansPage communityId="c1" viewOnly />)
    fireEvent.click(screen.getByRole('button', { name: /^Círcula, / }))
    expect(screen.queryByTestId('subscription-panel')).not.toBeInTheDocument()
    expect(screen.getByText(/você não precisa assinar/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Planos e assinaturas' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Círcula Premium', level: 3 })).toBeInTheDocument()
  })

  it('mostra todos os planos em cartões, incluindo os avulsos novos e o Premium', () => {
    render(<PlansPage communityId="c1" />)
    for (const name of ['Respiração', 'Playlist', 'Wellness', 'Círcula Premium']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${name}, `) })).toBeInTheDocument()
    }
  })
})
