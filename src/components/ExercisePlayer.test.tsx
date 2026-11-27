import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sound = vi.hoisted(() => ({ beep: vi.fn(), tick: vi.fn(), unlockBeep: vi.fn(), closeBeep: vi.fn() }))
vi.mock('../lib/beep', () => sound)

import { ExercisePlayer } from './ExercisePlayer'
import type { WorkoutExercise } from '../hooks/useHomeWorkouts'

const ex = (over: Partial<WorkoutExercise>): WorkoutExercise => ({
  id: 'prancha',
  slug: 'prancha',
  name: 'Prancha',
  categories: [],
  goals: [],
  level: 'Iniciante',
  mode: 'time',
  target: 5,
  sets: 2,
  rest_sec: 4,
  description: '',
  steps: ['Apoie os antebraços'],
  muscles: [],
  cautions: '',
  mistakes: [],
  ...over,
})

function advance(seconds: number) {
  for (let i = 0; i < seconds; i++) {
    act(() => {
      vi.advanceTimersByTime(1000)
    })
  }
}

describe('ExercisePlayer: bipes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    Object.values(sound).forEach((f) => f.mockClear())
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('3, 2, 1 e bipe no fim da série; dois bipes no fim do descanso; sem repetir', () => {
    render(<ExercisePlayer title="Treino" exercises={[ex({})]} onFinish={() => {}} onExit={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }))
    expect(sound.unlockBeep).toHaveBeenCalled()
    advance(2) // 5 → 3
    expect(sound.tick).toHaveBeenCalledTimes(1)
    advance(3) // 3 → 0: fim da série
    expect(sound.tick).toHaveBeenCalledTimes(3)
    expect(sound.beep).toHaveBeenCalledTimes(1)
    expect(sound.beep).toHaveBeenLastCalledWith(1, 880)
    advance(4) // descanso de 4s
    expect(sound.beep).toHaveBeenCalledTimes(2)
    expect(sound.beep).toHaveBeenLastCalledWith(2, 1040)
    expect(sound.tick).toHaveBeenCalledTimes(6)
  })

  it('pausado não conta nem bipa', () => {
    render(<ExercisePlayer title="Treino" exercises={[ex({})]} onFinish={() => {}} onExit={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }))
    fireEvent.click(screen.getByRole('button', { name: /Pausar/ }))
    advance(8)
    expect(sound.tick).not.toHaveBeenCalled()
    expect(sound.beep).not.toHaveBeenCalled()
    expect(document.querySelector('.ex-clock')?.textContent).toMatch(/0:05$/)
  })

  it('com o som desligado não bipa', () => {
    render(<ExercisePlayer title="Treino" exercises={[ex({})]} onFinish={() => {}} onExit={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Desligar os bipes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }))
    advance(9)
    expect(sound.tick).not.toHaveBeenCalled()
    expect(sound.beep).not.toHaveBeenCalled()
  })

  it('série por repetição: bipe ao tocar em "Fiz a série"', () => {
    render(<ExercisePlayer title="Treino" exercises={[ex({ mode: 'reps', target: 10, slug: 'agachamento-livre' })]} onFinish={() => {}} onExit={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fiz a série' }))
    expect(sound.beep).toHaveBeenCalledTimes(1)
  })

  it('controles com ícones (sem emoji) e nomes claros', () => {
    render(<ExercisePlayer title="Treino" exercises={[ex({})]} onFinish={() => {}} onExit={() => {}} />)
    expect(screen.getByRole('button', { name: /Pular exercício/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Finalizar treino/ })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/[🔔🔕⏭■]/u)
  })
})
