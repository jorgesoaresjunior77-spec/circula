import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Login } from './Login'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: vi.fn(), signUp: vi.fn(), resetPasswordForEmail: vi.fn() } },
}))

function submit() {
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'ana@exemplo.com' } })
  fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'Senha1!' } })
  fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }))
}

describe('Login', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('e-mail não confirmado mostra mensagem própria', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    } as never)
    render(<Login />)
    submit()
    expect(await screen.findByText(/Seu e-mail ainda não foi confirmado/)).toBeInTheDocument()
    expect(screen.queryByText('E-mail ou senha inválidos.')).not.toBeInTheDocument()
  })

  it('credenciais erradas continuam com a mensagem genérica', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    } as never)
    render(<Login />)
    submit()
    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeInTheDocument()
  })
})
