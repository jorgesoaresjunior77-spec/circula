import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PlansPage } from './PlansPage'

vi.mock('../hooks/useBillingPlans', () => ({
  useBillingPlans: () => ({ plans: [] }),
}))
vi.mock('./SubscriptionPanel', () => ({
  SubscriptionPanel: () => <div data-testid="subscription-panel" />,
}))

describe('PlansPage', () => {
  afterEach(() => cleanup())

  it('a membro vê o painel para assinar o Círcula', () => {
    render(<PlansPage communityId="c1" />)
    expect(screen.getByTestId('subscription-panel')).toBeInTheDocument()
  })

  it('a profissional vê a página sem poder assinar, com um aviso', () => {
    render(<PlansPage communityId="c1" viewOnly />)
    expect(screen.queryByTestId('subscription-panel')).not.toBeInTheDocument()
    expect(screen.getByText(/você não precisa assinar/i)).toBeInTheDocument()
    // O restante da página (preços, avulsos, pacotes) continua igual.
    expect(screen.getByRole('heading', { name: 'Planos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Superpacotes' })).toBeInTheDocument()
  })
})
