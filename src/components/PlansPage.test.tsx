import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { PlansPage } from './PlansPage'
import { novasConfirmacoes } from '../hooks/useConfirmacaoAssinatura'
import type { Confirmacao } from '../hooks/useConfirmacaoAssinatura'

// Captura o aviso de "assinatura confirmada" que o servidor liberou (o teste dispara na mão).
let confirmar: ((c: Confirmacao) => void) | null = null
vi.mock('../hooks/useConfirmacaoAssinatura', async (original) => ({
  ...(await original<typeof import('../hooks/useConfirmacaoAssinatura')>()),
  useConfirmacaoAssinatura: (opts: { onConfirmada: (c: Confirmacao) => void }) => {
    confirmar = opts.onConfirmada
  },
}))
vi.mock('../hooks/useSubscription', () => ({
  useSubscription: () => ({ hasBillingCustomerData: true, saveBillingCustomerData: vi.fn() }),
}))
vi.mock('../hooks/useAddonCheckout', () => ({
  useAddonCheckout: () => ({
    subscribe: vi.fn(async () => ({ error: null, invoiceUrl: null })),
    subscribeCart: vi.fn(async () => ({ error: null, invoiceUrl: null })),
    busy: false,
  }),
}))
vi.mock('../hooks/useMyAddonSubscription', () => ({
  useMyAddonSubscription: () => ({ sub: null, busy: false, error: null, cancel: vi.fn() }),
}))

vi.mock('../hooks/useBillingPlans', () => ({
  useBillingPlans: () => ({ plans: [] }),
}))
vi.mock('./SubscriptionPanel', () => ({
  SubscriptionPanel: () => <div data-testid="subscription-panel" />,
}))

describe('PlansPage', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

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

  it('a dica do topo recomenda o plano anual com a economia real em reais', () => {
    render(<PlansPage communityId="c1" profileId="p1" />)
    const dica = screen.getByRole('complementary', { name: 'Dica de plano' })
    expect(dica).toHaveTextContent(/plano anual/)
    expect(dica).toHaveTextContent(/R\$\s*[\d.]+,\d{2}/)
  })

  it('o ciclo anual já vem escolhido, com a tag "Melhor escolha agora"; o mensal continua disponível', () => {
    render(<PlansPage communityId="c1" profileId="p1" />)
    fireEvent.click(screen.getByRole('button', { name: /^Respiração, / }))
    const anual = screen.getByRole('radio', { name: /Anual/ })
    expect(anual).toHaveAttribute('aria-checked', 'true')
    expect(anual).toHaveTextContent('Melhor escolha agora')
    expect(screen.getByRole('radio', { name: /Mensal/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Assinar anual/ })).toBeInTheDocument()
  })

  it('o robô fica dentro da assinatura e insiste no anual: no mensal mostra a economia e o mensal segue assinável', () => {
    render(<PlansPage communityId="c1" profileId="p1" />)
    fireEvent.click(screen.getByRole('button', { name: /^Respiração, / }))
    expect(screen.getByRole('note', { name: 'Dica da Livi' })).toHaveTextContent(/Ótima escolha/)
    fireEvent.click(screen.getByRole('radio', { name: /Mensal/ }))
    expect(screen.getByRole('note', { name: 'Dica da Livi' })).toHaveTextContent(/semestral.*economiza/)
    expect(screen.getByRole('button', { name: /^Assinar mensal/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Quero o semestral' }))
    expect(screen.getByRole('radio', { name: /Semestral/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('note', { name: 'Dica da Livi' })).toHaveTextContent(/anual.*maior economia/)
  })

  it('"Quero o anual" (oferecido no semestral) leva ao anual', () => {
    render(<PlansPage communityId="c1" profileId="p1" />)
    fireEvent.click(screen.getByRole('button', { name: /^Respiração, / }))
    fireEvent.click(screen.getByRole('radio', { name: /Mensal/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Quero o semestral' }))
    fireEvent.click(screen.getByRole('button', { name: 'Quero o anual' }))
    expect(screen.getByRole('radio', { name: /Anual/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('se a pessoa recusa a oferta do plano acima, a Livi respeita e some', () => {
    render(<PlansPage communityId="c1" profileId="p1" />)
    fireEvent.click(screen.getByRole('button', { name: /^Respiração, / }))
    fireEvent.click(screen.getByRole('radio', { name: /Mensal/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar no mensal' }))
    expect(screen.queryByRole('note', { name: 'Dica da Livi' })).toBeNull()
    expect(screen.getByRole('button', { name: /^Assinar mensal/ })).toBeInTheDocument()
  })

  it('NÃO comemora ao clicar em assinar: só quando o servidor confirma a assinatura', () => {
    render(<PlansPage communityId="c1" profileId="p1" />)
    fireEvent.click(screen.getByRole('button', { name: /^Respiração, / }))
    fireEvent.click(screen.getByRole('button', { name: /^Assinar anual/ }))
    expect(screen.queryByText(/Sua assinatura está ativa/)).not.toBeInTheDocument()
  })

  it('comemora UMA vez quando a assinatura é confirmada', () => {
    render(<PlansPage communityId="c1" profileId="p1" />)
    const c: Confirmacao = { chave: 'c1:pacote:respiracao', tipo: 'pacote', pacote: 'respiracao' }
    act(() => confirmar?.(c))
    expect(screen.getByText(/Obrigada! Sua assinatura está ativa/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.queryByText(/Sua assinatura está ativa/)).not.toBeInTheDocument()
    act(() => confirmar?.(c)) // a mesma assinatura não comemora de novo
    expect(screen.queryByText(/Sua assinatura está ativa/)).not.toBeInTheDocument()
  })
})

describe('PlansPage · cesta de assinaturas', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('a cesta soma os conteúdos marcados e só libera o botão com 2 ou mais', () => {
    render(<PlansPage communityId="c1" profileId="p1" />)
    fireEvent.click(screen.getByRole('button', { name: /Montar minha cesta/ }))
    const assinar = () => screen.getByRole('button', { name: /Escolha pelo menos 2|Assinar tudo junto/ })
    expect(assinar()).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /Respiração/ }))
    expect(assinar()).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /Playlist/ }))
    expect(assinar()).not.toBeDisabled()
    expect(screen.getByText(/2 conteúdos/)).toBeInTheDocument()
    expect(screen.getAllByText(/Círcula Premium/).length).toBeGreaterThan(0)
  })

  it('o anual já vem escolhido na cesta e o robô comenta a economia', () => {
    render(<PlansPage communityId="c1" profileId="p1" />)
    fireEvent.click(screen.getByRole('button', { name: /Montar minha cesta/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Respiração/ }))
    expect(screen.getByRole('radio', { name: /Anual/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('note', { name: 'Dica da Livi' })).toHaveTextContent(/Ótima escolha/)
  })
})

describe('novasConfirmacoes (o que conta como assinatura confirmada)', () => {
  const vazio = { pacotes: new Set<string>(), circulaAtiva: false }
  it('um pacote novo liberado pelo servidor conta', () => {
    expect(novasConfirmacoes(vazio, { pacotes: new Set(['premium']), circulaAtiva: false }, 'c1')).toEqual([
      { chave: 'c1:pacote:premium', tipo: 'pacote', pacote: 'premium' },
    ])
  })
  it('o que a pessoa já tinha não conta', () => {
    const antes = { pacotes: new Set(['respiracao']), circulaAtiva: true }
    expect(novasConfirmacoes(antes, antes, 'c1')).toEqual([])
  })
  it('a assinatura do Círcula passando a ativa conta', () => {
    expect(novasConfirmacoes(vazio, { pacotes: new Set(), circulaAtiva: true }, 'c1')).toEqual([{ chave: 'c1:circula', tipo: 'circula' }])
  })
})
