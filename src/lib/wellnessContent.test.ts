import { describe, it, expect } from 'vitest'
import { formatDuration, isValidAudioUrl, kindLabel, themeLabel } from './wellnessContent'

describe('wellnessContent', () => {
  it('formata a duração', () => {
    expect(formatDuration(5)).toBe('5 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(90)).toBe('1 h 30 min')
  })

  it('só aceita áudio por https', () => {
    expect(isValidAudioUrl('https://exemplo.com/a.mp3')).toBe(true)
    expect(isValidAudioUrl('http://exemplo.com/a.mp3')).toBe(false)
    expect(isValidAudioUrl('javascript:alert(1)')).toBe(false)
    expect(isValidAudioUrl('não é link')).toBe(false)
  })

  it('traduz temas e tipos conhecidos e deixa os desconhecidos como estão', () => {
    expect(themeLabel('inteligencia_emocional')).toBe('Inteligência emocional')
    expect(kindLabel('relaxamento')).toBe('Áudios de relaxamento')
    expect(themeLabel('outro')).toBe('outro')
  })
})
