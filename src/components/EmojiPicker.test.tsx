import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { EmojiPicker } from './EmojiPicker'
import { CommentForm } from './CommentForm'

describe('EmojiPicker', () => {
  afterEach(() => cleanup())

  it('abre a lista, insere o emoji escolhido e fecha', () => {
    const onPick = vi.fn()
    render(<EmojiPicker onPick={onPick} />)

    fireEvent.click(screen.getByRole('button', { name: 'Inserir emoji' }))
    fireEvent.click(screen.getByRole('button', { name: '🌸' }))

    expect(onPick).toHaveBeenCalledWith('🌸')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('toque fora fecha a lista', () => {
    render(
      <div>
        <EmojiPicker onPick={() => {}} />
        <p>fora</p>
      </div>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Inserir emoji' }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.pointerDown(screen.getByText('fora'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('Esc fecha a lista', () => {
    render(<EmojiPicker onPick={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Inserir emoji' }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

describe('CommentForm — anexar foto', () => {
  afterEach(() => cleanup())

  it('o botão de foto é um ícone (sem emoji) e tem nome acessível', () => {
    render(<CommentForm onSubmit={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'Anexar foto' })
    expect(button.querySelector('svg')).not.toBeNull()
    expect(button.textContent).toBe('')
  })
})
