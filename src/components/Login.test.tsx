import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { Login } from './Login'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { signInWithPassword: vi.fn(), signUp: vi.fn(), resetPasswordForEmail: vi.fn(), setSession: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}))

function fnError(code: string) {
  return {
    data: null,
    error: { context: new Response(JSON.stringify({ code, error: 'x' }), { status: 401 }) },
  }
}

function submitPhone(phone = '(51) 99650-9660') {
  fireEvent.change(screen.getByLabelText('Celular'), { target: { value: phone } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Senha1!' } })
  fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }))
}

function submitEmail() {
  fireEvent.click(screen.getByRole('button', { name: /entrar com e-mail/i }))
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'ana@exemplo.com' } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Senha1!' } })
  fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }))
}

describe('Login', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('o login é o celular: manda só os dígitos (padrão DDD + 9 + número) ao servidor', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { access_token: 'a', refresh_token: 'r' },
      error: null,
    } as never)
    vi.mocked(supabase.auth.setSession).mockResolvedValue({ data: {}, error: null } as never)
    render(<Login />)
    submitPhone('(51) 99650-9660')
    await waitFor(() =>
      expect(supabase.functions.invoke).toHaveBeenCalledWith('login-with-phone', {
        body: { action: 'login', phone: '51996509660', password: 'Senha1!' },
      }),
    )
    await waitFor(() => expect(supabase.auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' }))
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('celular ou senha errados mostram a mensagem genérica', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue(fnError('invalid_credentials') as never)
    render(<Login />)
    submitPhone()
    expect(await screen.findByText('Celular ou senha inválidos.')).toBeInTheDocument()
  })

  it('celular fora do padrão nem chega ao servidor', async () => {
    render(<Login />)
    submitPhone('996509660')
    expect(await screen.findByText('Celular ou senha inválidos.')).toBeInTheDocument()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('e-mail não confirmado mostra mensagem própria', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue(fnError('email_not_confirmed') as never)
    render(<Login />)
    submitPhone()
    expect(await screen.findByText(/Seu e-mail ainda não foi confirmado/)).toBeInTheDocument()
  })

  it('"Entrar com e-mail" (contas antigas): e-mail não confirmado', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    } as never)
    render(<Login />)
    submitEmail()
    expect(await screen.findByText(/Seu e-mail ainda não foi confirmado/)).toBeInTheDocument()
    expect(screen.queryByText('E-mail ou senha inválidos.')).not.toBeInTheDocument()
  })

  it('"Entrar com e-mail": credenciais erradas continuam com a mensagem genérica', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    } as never)
    render(<Login />)
    submitEmail()
    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeInTheDocument()
  })
})
