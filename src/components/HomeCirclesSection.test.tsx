import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HomeCirclesSection } from './HomeCirclesSection'
import type { CircleWithMembers } from '../types/circle'

// Mocka useDragCarousel — a mecânica de arrasto/ciclo/autoplay já tem
// cobertura própria e exaustiva (useDragCarousel.test.ts); aqui o que
// importa é só o CONTEÚDO renderizado: o card fixo "Novo Círculo" (item
// 5, evolução/gamificação) aparece quando (e só quando) `onRequestNewCircle`
// é passado, com a mesma estrutura de card dos demais, e nunca é
// confundido com um Círculo real ao clicar.
vi.mock('../hooks/useDragCarousel', () => ({
  useDragCarousel: () => ({
    viewportRef: { current: null },
    seqRef: { current: null },
    loop: false,
    dragging: false,
  }),
  LOOP_EXTRA_COPIES: 2,
}))

vi.mock('../hooks/useSignedImageUrl', () => ({
  useSignedImageUrl: () => ({ url: null }),
}))

const CIRCLE: CircleWithMembers = {
  id: 'circle-1',
  community_id: 'c1',
  name: 'Mães',
  cover_image_url: null,
  created_by: 'owner-1',
  created_at: '2026-01-01T00:00:00Z',
  members: [],
}

describe('HomeCirclesSection — card "Novo Círculo"', () => {
  afterEach(() => {
    cleanup()
  })

  it('não aparece quando onRequestNewCircle não é passado (ex.: Professional)', () => {
    render(<HomeCirclesSection circles={[CIRCLE]} onOpen={() => {}} />)
    expect(screen.queryByText('Novo Círculo')).not.toBeInTheDocument()
  })

  it('aparece como último card, com a mesma estrutura dos reais, e aciona onRequestNewCircle (nunca onOpen)', () => {
    const onOpen = vi.fn()
    const onRequestNewCircle = vi.fn()
    render(
      <HomeCirclesSection
        circles={[CIRCLE]}
        onOpen={onOpen}
        onRequestNewCircle={onRequestNewCircle}
      />,
    )

    const button = screen.getByRole('button', { name: 'Sugerir um novo círculo' })
    fireEvent.click(button)

    expect(onRequestNewCircle).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('aparece sozinho (sem nenhum Círculo real ainda) em vez da seção inteira sumir', () => {
    render(<HomeCirclesSection circles={[]} onOpen={() => {}} onRequestNewCircle={() => {}} />)
    expect(screen.getByText('Novo Círculo')).toBeInTheDocument()
  })

  it('sem círculos reais e sem onRequestNewCircle, a seção inteira não renderiza nada', () => {
    const { container } = render(<HomeCirclesSection circles={[]} onOpen={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
