import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  detectInstallPlatform,
  hasSeenInstallGuide,
  markInstallGuideSeen,
  shouldAutoShowInstallGuide,
} from './installGuide'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36'
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'

describe('detectInstallPlatform', () => {
  it('reconhece iPhone, Android, iPad moderno e computador', () => {
    expect(detectInstallPlatform(IPHONE, 5)).toBe('ios')
    expect(detectInstallPlatform(ANDROID, 5)).toBe('android')
    expect(detectInstallPlatform(IPAD_AS_MAC, 5)).toBe('ios')
    expect(detectInstallPlatform(IPAD_AS_MAC, 0)).toBe('other')
    expect(detectInstallPlatform(DESKTOP, 0)).toBe('other')
  })
})

describe('marca de "já viu o guia"', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('começa como não vista e vira vista depois de marcada', () => {
    expect(hasSeenInstallGuide()).toBe(false)
    markInstallGuideSeen()
    expect(hasSeenInstallGuide()).toBe(true)
  })

  it('sem localStorage não quebra', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    })
    expect(hasSeenInstallGuide()).toBe(false)
    expect(() => markInstallGuideSeen()).not.toThrow()
  })
})

describe('shouldAutoShowInstallGuide', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  function stubDevice(userAgent: string, standalone = false) {
    vi.stubGlobal('navigator', { userAgent, maxTouchPoints: 5, standalone })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
  }

  it('mostra no celular que ainda não viu o guia e não abriu o app instalado', () => {
    stubDevice(IPHONE)
    expect(shouldAutoShowInstallGuide()).toBe(true)
  })

  it('não mostra no computador', () => {
    stubDevice(DESKTOP)
    expect(shouldAutoShowInstallGuide()).toBe(false)
  })

  it('não mostra se o Círcula já está aberto como app instalado', () => {
    stubDevice(IPHONE, true)
    expect(shouldAutoShowInstallGuide()).toBe(false)
  })

  it('não mostra de novo depois de visto', () => {
    stubDevice(ANDROID)
    markInstallGuideSeen()
    expect(shouldAutoShowInstallGuide()).toBe(false)
  })
})
