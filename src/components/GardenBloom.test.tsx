import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GardenBloom, GARDEN_STAGE_LABEL, gardenStageForPercent } from './GardenBloom'

describe('gardenStageForPercent', () => {
  it('escolhe a etapa pelo percentual do mês', () => {
    expect(gardenStageForPercent(0)).toBe('seed')
    expect(gardenStageForPercent(33)).toBe('seed')
    expect(gardenStageForPercent(34)).toBe('bloom')
    expect(gardenStageForPercent(99)).toBe('bloom')
    expect(gardenStageForPercent(100)).toBe('garden')
  })
})

describe('<GardenBloom>', () => {
  it('expõe o rótulo quando recebe label e é decorativa sem ele', () => {
    const { rerender, container } = render(<GardenBloom stage="bloom" label="Seu jardim: Florescendo" />)
    expect(screen.getByRole('img', { name: 'Seu jardim: Florescendo' })).toBeInTheDocument()
    rerender(<GardenBloom stage="bloom" />)
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('tem um nome para cada etapa', () => {
    expect(Object.keys(GARDEN_STAGE_LABEL)).toEqual(['seed', 'bloom', 'garden'])
  })
})
