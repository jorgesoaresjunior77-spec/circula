import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CityPicker } from './CityPicker'
import { HomeCityCard } from './HomeCityCard'

const RS: [number, string][] = [
  [4311403, 'Lajeado'],
  [4304606, 'Canoas'],
  [4306403, 'Cruz Alta'],
]

describe('CityPicker', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => RS })))
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('lista os 27 estados e só mostra as cidades depois de escolher o estado', async () => {
    render(<CityPicker confirmLabel="Salvar minha cidade" onConfirm={vi.fn()} />)
    const select = screen.getByLabelText('Estado') as HTMLSelectElement
    expect(select.querySelectorAll('option')).toHaveLength(28) // placeholder + 27
    expect(screen.queryByLabelText('Buscar cidade')).toBeNull()
    fireEvent.change(select, { target: { value: 'RS' } })
    expect(await screen.findByLabelText('Buscar cidade')).toBeTruthy()
    expect(screen.getByText('Lajeado')).toBeTruthy()
  })

  it('busca dentro da lista e confirma com estado e cidade', async () => {
    const onConfirm = vi.fn()
    render(<CityPicker confirmLabel="Salvar minha cidade" onConfirm={onConfirm} />)
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'RS' } })
    const search = await screen.findByLabelText('Buscar cidade')
    fireEvent.change(search, { target: { value: 'cruz' } })
    expect(screen.queryByText('Lajeado')).toBeNull()
    fireEvent.click(screen.getByText('Cruz Alta'))
    fireEvent.click(screen.getByRole('button', { name: /Salvar minha cidade/ }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('RS', { ibge_id: 4306403, nome: 'Cruz Alta' }))
  })

  it('o botão de salvar fica desligado até escolher a cidade', async () => {
    render(<CityPicker confirmLabel="Salvar minha cidade" onConfirm={vi.fn()} />)
    expect((screen.getByRole('button', { name: /Salvar minha cidade/ }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('HomeCityCard', () => {
  afterEach(cleanup)
  const city = { id: 'c', estado: 'RS', nome: 'Lajeado', ibge_id: 4311403, mulheres: 12, cadastros: 1 }

  it('só o título e a frase, sem chamada', () => {
    const onOpen = vi.fn()
    render(<HomeCityCard city={null} onOpen={onOpen} />)
    expect(screen.getByText('Ache locais e profissionais')).toBeTruthy()
    expect(screen.getByText('Minha cidade')).toBeTruthy()
    expect(screen.queryByText(/Encontre mulheres/)).toBeNull()
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalled()
  })

  it('com cidade escolhida o card continua igual: sem nome da cidade nem números', () => {
    render(<HomeCityCard city={city} onOpen={vi.fn()} />)
    expect(screen.getByText('Minha cidade')).toBeTruthy()
    expect(screen.queryByText(/Lajeado/)).toBeNull()
    expect(screen.queryByText(/Abrir a minha cidade/)).toBeNull()
  })
})
