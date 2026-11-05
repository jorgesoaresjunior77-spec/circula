import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { FeedPhotoCropper, FEED_PHOTO_ASPECT } from './FeedPhotoCropper'
import { CommentForm } from './CommentForm'

vi.mock('./ImageCropper', () => ({
  ImageCropper: ({
    aspect,
    outputWidth,
    title,
    onCancel,
    onDone,
  }: {
    aspect: number
    outputWidth: number
    title: string
    onCancel: () => void
    onDone: (file: File) => void
  }) => (
    <div role="dialog" aria-label={title} data-aspect={aspect} data-width={outputWidth}>
      <button type="button" onClick={onCancel}>
        cancelar recorte
      </button>
      <button type="button" onClick={() => onDone(new File(['x'], 'recorte.webp', { type: 'image/webp' }))}>
        usar recorte
      </button>
    </div>
  ),
}))

describe('FeedPhotoCropper — foto 4:5 estilo Instagram', () => {
  afterEach(() => cleanup())

  it('o formato do feed é retrato 4:5, com 1080 px de largura', () => {
    expect(FEED_PHOTO_ASPECT).toBeCloseTo(0.8)
    render(<FeedPhotoCropper file={new File(['x'], 'f.jpg')} onCancel={() => {}} onDone={() => {}} />)

    const dialog = screen.getByRole('dialog', { name: 'Ajustar a foto (4:5)' })
    expect(dialog).toHaveAttribute('data-aspect', '0.8')
    expect(dialog).toHaveAttribute('data-width', '1080')
  })

  it('abre fora do formulário (portal no body), para não enviar o comentário sem querer', () => {
    const { container } = render(
      <FeedPhotoCropper file={new File(['x'], 'f.jpg')} onCancel={() => {}} onDone={() => {}} />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
  })
})

describe('CommentForm — a foto passa pelo recorte 4:5', () => {
  afterEach(() => cleanup())

  it('escolher uma foto abre o recorte; usar o recorte anexa a foto', () => {
    const { container } = render(<CommentForm onSubmit={vi.fn()} />)

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] } })

    expect(screen.getByRole('dialog', { name: 'Ajustar a foto (4:5)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anexar foto' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'usar recorte' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Foto anexada' })).toBeInTheDocument()
  })

  it('cancelar o recorte não anexa nada', () => {
    const { container } = render(<CommentForm onSubmit={vi.fn()} />)

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'cancelar recorte' }))

    expect(screen.getByRole('button', { name: 'Anexar foto' })).toBeInTheDocument()
  })
})
