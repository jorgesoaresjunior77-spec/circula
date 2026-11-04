import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { InstallAppGuide } from './InstallAppGuide'
import { hasSeenInstallGuide } from '../lib/installGuide'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36'

describe('InstallAppGuide', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('abre na aba do celular da pessoa: iPhone com os passos do Safari', () => {
    vi.stubGlobal('navigator', { userAgent: IPHONE, maxTouchPoints: 5 })
    render(<InstallAppGuide onClose={vi.fn()} />)

    expect(screen.getByRole('tab', { name: 'iPhone' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeInTheDocument()
    expect(screen.getByText('Abra o Círcula no Safari.')).toBeInTheDocument()
  })

  it('abre na aba Android com os passos do Chrome', () => {
    vi.stubGlobal('navigator', { userAgent: ANDROID, maxTouchPoints: 5 })
    render(<InstallAppGuide onClose={vi.fn()} />)

    expect(screen.getByRole('tab', { name: 'Android' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Adicionar à tela inicial/)).toBeInTheDocument()
    expect(screen.getByText('Abra o Círcula no Chrome.')).toBeInTheDocument()
  })

  it('troca de aba mostrando os passos do outro celular', () => {
    vi.stubGlobal('navigator', { userAgent: ANDROID, maxTouchPoints: 5 })
    render(<InstallAppGuide onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('tab', { name: 'iPhone' }))

    expect(screen.getByText('Abra o Círcula no Safari.')).toBeInTheDocument()
    expect(screen.queryByText('Abra o Círcula no Chrome.')).not.toBeInTheDocument()
  })

  it('"Entendi" fecha e marca o guia como visto neste aparelho', () => {
    vi.stubGlobal('navigator', { userAgent: ANDROID, maxTouchPoints: 5 })
    const onClose = vi.fn()
    render(<InstallAppGuide onClose={onClose} />)

    expect(hasSeenInstallGuide()).toBe(false)
    fireEvent.click(screen.getByText('Entendi'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(hasSeenInstallGuide()).toBe(true)
  })
})
