import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { Onboarding } from './Onboarding'
import type { Profile } from '../types/profile'

const PROFILE: Profile = {
  id: 'p1',
  role: 'member',
  full_name: 'Ana',
  avatar_url: null,
  interests: ['Gosto de ler'],
  bio: null,
  city: null,
  gallery_photos: [],
  garden_color_one: null,
  garden_color_two: null,
}

describe('Onboarding', () => {
  afterEach(() => {
    cleanup()
  })

  it('"Pular" no primeiro passo conclui sem exigir nenhuma resposta', async () => {
    const onUpdateProfile = vi.fn().mockResolvedValue({ error: null })
    const onDone = vi.fn()
    const onStartTour = vi.fn()

    render(
      <Onboarding
        profile={PROFILE}
        onUpdateProfile={onUpdateProfile}
        onDone={onDone}
        onStartTour={onStartTour}
      />,
    )

    fireEvent.click(screen.getByText('Pular'))

    await waitFor(() => {
      expect(onUpdateProfile).toHaveBeenCalledTimes(1)
    })
    const patch = onUpdateProfile.mock.calls[0][0]
    expect(patch.onboarding_answers).toEqual({})
    expect(typeof patch.onboarding_completed_at).toBe('string')
    expect(patch.interests).toBeUndefined() // nenhum tópico marcado -> não mexe em interests
    expect(onDone).toHaveBeenCalledTimes(1)
    // Pular NUNCA inicia o tour sozinho — só "Concluir" no último passo.
    expect(onStartTour).not.toHaveBeenCalled()
  })

  it('avançar até o fim ("Concluir") persiste as respostas e inicia o tour', async () => {
    const onUpdateProfile = vi.fn().mockResolvedValue({ error: null })
    const onDone = vi.fn()
    const onStartTour = vi.fn()

    render(
      <Onboarding
        profile={PROFILE}
        onUpdateProfile={onUpdateProfile}
        onDone={onDone}
        onStartTour={onStartTour}
      />,
    )

    // passo 0 -> 1 (nome)
    fireEvent.click(screen.getByText('Avançar'))
    fireEvent.change(screen.getByPlaceholderText(/Ju, Bia/), { target: { value: 'Aninha' } })

    // passo 1 -> 2 (momento atual)
    fireEvent.click(screen.getByText('Avançar'))
    fireEvent.click(screen.getByText('Cuidando de mim'))

    // passo 2 -> 3 (interesses) — reaproveita profiles.interests
    fireEvent.click(screen.getByText('Avançar'))
    fireEvent.click(screen.getByText('Saúde e bem-estar'))

    // passo 3 -> 4 (participação)
    fireEvent.click(screen.getByText('Avançar'))
    fireEvent.click(screen.getByText('Quero aprender coisas novas'))

    // passo 4 -> 5 (por último)
    fireEvent.click(screen.getByText('Avançar'))

    // último passo: "Concluir"
    fireEvent.click(screen.getByText('Concluir'))

    await waitFor(() => {
      expect(onUpdateProfile).toHaveBeenCalledTimes(1)
    })
    const patch = onUpdateProfile.mock.calls[0][0]
    expect(patch.onboarding_answers).toEqual({
      preferred_name: 'Aninha',
      current_moment: 'Cuidando de mim',
      participation_style: ['Quero aprender coisas novas'],
    })
    // Interesses do onboarding somam aos já existentes, nunca substituem.
    expect(patch.interests).toEqual(expect.arrayContaining(['Gosto de ler', 'Saúde e bem-estar']))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onStartTour).toHaveBeenCalledTimes(1)
  })

  it('"Voltar" preserva as respostas já dadas no passo anterior', () => {
    render(
      <Onboarding
        profile={PROFILE}
        onUpdateProfile={vi.fn().mockResolvedValue({ error: null })}
        onDone={vi.fn()}
        onStartTour={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Avançar')) // -> passo 1 (nome)
    fireEvent.change(screen.getByPlaceholderText(/Ju, Bia/), { target: { value: 'Mari' } })
    fireEvent.click(screen.getByText('Avançar')) // -> passo 2
    fireEvent.click(screen.getByText('Voltar')) // volta ao passo 1

    expect(screen.getByPlaceholderText(/Ju, Bia/)).toHaveValue('Mari')
  })
})
