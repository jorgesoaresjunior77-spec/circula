import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { FeedbackPage } from './FeedbackPage'

const rpc = vi.fn(async () => ({ error: null }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => (rpc as (...x: unknown[]) => unknown)(...a) } }))

describe('FeedbackPage', () => {
  afterEach(() => {
    cleanup()
    rpc.mockClear()
  })

  it('só envia com um texto de pelo menos 5 letras', () => {
    render(<FeedbackPage />)
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'oi' } })
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })

  it('envia o problema para a profissional e mostra a confirmação', async () => {
    render(<FeedbackPage />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A tela de planos não abre no celular' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(screen.getByText('Recebemos o seu aviso')).toBeInTheDocument())
    expect(rpc).toHaveBeenCalledWith('feedback_send', { p_tipo: 'problema', p_texto: 'A tela de planos não abre no celular' })
  })

  it('dá para escolher "Tenho uma sugestão"', async () => {
    render(<FeedbackPage />)
    fireEvent.click(screen.getByRole('radio', { name: 'Tenho uma sugestão' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Um lembrete de água seria ótimo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('feedback_send', { p_tipo: 'sugestao', p_texto: 'Um lembrete de água seria ótimo' }))
  })
})
