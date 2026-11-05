import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { PasswordInput } from './PasswordInput'

describe('PasswordInput', () => {
  afterEach(() => cleanup())

  it('começa oculto e o olhinho alterna entre mostrar e ocultar a senha', () => {
    render(
      <>
        <label htmlFor="pw">Senha</label>
        <PasswordInput id="pw" defaultValue="Segredo1!" />
      </>,
    )

    const input = screen.getByLabelText('Senha') as HTMLInputElement
    expect(input.type).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(input.type).toBe('text')
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(input.type).toBe('password')
  })

  it('o olhinho não envia o formulário', () => {
    let submitted = false
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submitted = true
        }}
      >
        <PasswordInput aria-label="senha" />
      </form>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(submitted).toBe(false)
  })

  it('repassa as props do campo (autocomplete, required, valor)', () => {
    render(<PasswordInput aria-label="campo" autoComplete="new-password" required defaultValue="abc" />)
    const input = screen.getByLabelText('campo') as HTMLInputElement
    expect(input.autocomplete).toBe('new-password')
    expect(input.required).toBe(true)
    expect(input.value).toBe('abc')
  })
})
