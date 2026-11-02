import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemberSignup } from './MemberSignup'
import { supabase } from '../lib/supabase'
import { useInvitePreview } from '../hooks/useInvitePreview'

vi.mock('../lib/supabase', () => ({ supabase: { auth: { signUp: vi.fn() } } }))
vi.mock('../hooks/useInvitePreview')

const TOKEN = 'abc123abc123abc123abc123'

function fill(password: string) {
  fireEvent.change(screen.getByLabelText('Como podemos te chamar?'), { target: { value: 'Ana' } })
  fireEvent.change(screen.getByLabelText('E-mail (será o seu login)'), { target: { value: 'ana@exemplo.com' } })
  fireEvent.change(screen.getByLabelText('Crie uma senha'), { target: { value: password } })
}

describe('MemberSignup', () => {
  beforeEach(() => {
    vi.mocked(useInvitePreview).mockReturnValue({ status: 'valid', communityName: 'Fluir & Florescer' })
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { identities: [{}] }, session: { access_token: 't' } },
      error: null,
    } as never)
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('mostra o nome da comunidade do convite', () => {
    render(<MemberSignup token={TOKEN} onHaveAccount={vi.fn()} />)
    expect(screen.getByText('Fluir & Florescer')).toBeInTheDocument()
  })

  it('marca os requisitos da senha conforme ela é digitada', () => {
    render(<MemberSignup token={TOKEN} onHaveAccount={vi.fn()} />)
    const item = (text: string) => screen.getByText(text).closest('li')!
    expect(item('1 letra maiúscula')).not.toHaveClass('member-signup-rule--met')
    fireEvent.change(screen.getByLabelText('Crie uma senha'), { target: { value: 'Abc1!x' } })
    expect(item('1 letra maiúscula')).toHaveClass('member-signup-rule--met')
    expect(item('1 número')).toHaveClass('member-signup-rule--met')
  })

  it('NÃO cria a conta com senha fraca', async () => {
    render(<MemberSignup token={TOKEN} onHaveAccount={vi.fn()} />)
    fill('semmaiuscula1!')
    fireEvent.click(screen.getByText('Criar minha conta'))
    expect(await screen.findByRole('alert')).toHaveTextContent('requisitos')
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
  })

  it('cria a conta como participante (sem account_type) com nome, e-mail e senha', async () => {
    render(<MemberSignup token={TOKEN} onHaveAccount={vi.fn()} />)
    fill('Senha1!')
    fireEvent.click(screen.getByText('Criar minha conta'))
    await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalled())
    const args = vi.mocked(supabase.auth.signUp).mock.calls[0][0] as {
      email: string
      password: string
      options: { data: Record<string, string> }
    }
    expect(args.email).toBe('ana@exemplo.com')
    expect(args.password).toBe('Senha1!')
    expect(args.options.data).toEqual({ full_name: 'Ana' })
  })

  it('sem sessão (projeto exige confirmar e-mail) avisa para confirmar', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { identities: [{}] }, session: null },
      error: null,
    } as never)
    render(<MemberSignup token={TOKEN} onHaveAccount={vi.fn()} />)
    fill('Senha1!')
    fireEvent.click(screen.getByText('Criar minha conta'))
    expect(await screen.findByText(/Seu e-mail ainda não foi confirmado/)).toBeInTheDocument()
    expect(screen.getByText('Ir para o login')).toBeInTheDocument()
    // não segue como se tivesse entrado: o formulário some e não há "criando"
    expect(screen.queryByText('Criar minha conta')).not.toBeInTheDocument()
  })

  it('e-mail que já tem conta: mensagem neutra, sem entrar', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { identities: [] }, session: null },
      error: null,
    } as never)
    render(<MemberSignup token={TOKEN} onHaveAccount={vi.fn()} />)
    fill('Senha1!')
    fireEvent.click(screen.getByText('Criar minha conta'))
    expect(await screen.findByRole('alert')).toHaveTextContent('já pode ter uma conta')
  })

  it('convite desativado mostra aviso e não mostra o formulário', () => {
    vi.mocked(useInvitePreview).mockReturnValue({ status: 'invalid' })
    render(<MemberSignup token={TOKEN} onHaveAccount={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('não está mais ativo')
    expect(screen.queryByLabelText('Crie uma senha')).not.toBeInTheDocument()
  })

  it('"Já tenho conta" leva ao login', () => {
    const onHaveAccount = vi.fn()
    render(<MemberSignup token={TOKEN} onHaveAccount={onHaveAccount} />)
    fireEvent.click(screen.getByText('Já tenho conta'))
    expect(onHaveAccount).toHaveBeenCalled()
  })
})
