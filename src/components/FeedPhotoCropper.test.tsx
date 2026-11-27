import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { FeedPhotoCropper, FEED_PHOTO_ASPECT } from './FeedPhotoCropper'
import { CommentForm } from './CommentForm'
import { PostComposer } from './PostComposer'

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

describe('CommentForm — comentários só em texto', () => {
  afterEach(() => cleanup())

  it('não tem ícone nem campo de imagem', () => {
    const { container } = render(<CommentForm onSubmit={vi.fn()} />)
    expect(container.querySelector('input[type="file"]')).toBeNull()
    expect(screen.queryByRole('button', { name: /Anexar foto|Foto anexada/ })).not.toBeInTheDocument()
  })

  it('envia só o texto (nunca uma imagem)', () => {
    const onSubmit = vi.fn().mockResolvedValue({ error: null })
    render(<CommentForm onSubmit={onSubmit} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Que lindo!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }))
    expect(onSubmit).toHaveBeenCalledWith('Que lindo!', null)
  })
})

describe('PostComposer — a publicação própria continua com foto', () => {
  URL.createObjectURL = vi.fn(() => 'blob:previa')
  URL.revokeObjectURL = vi.fn()
  afterEach(() => cleanup())

  it('escolher a foto abre o recorte; depois mostra a prévia com Trocar e Remover', () => {
    const { container } = render(<PostComposer onPublish={vi.fn()} onUploadImage={vi.fn()} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toHaveAttribute('accept', 'image/*')
    fireEvent.change(input, { target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'usar recorte' }))
    expect(screen.getByAltText('Pré-visualização da imagem do post')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trocar imagem' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remover imagem' }))
    expect(screen.queryByAltText('Pré-visualização da imagem do post')).not.toBeInTheDocument()
  })
})
