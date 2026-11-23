import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CircleRequestReview } from './CircleRequestReview'

// Servidor simulado: guarda só as solicitações; qualquer outra tabela falha o teste
// (aprovar ou recusar nunca pode mexer nos Círculos).
let rows: Record<string, unknown>[] = []
let failUpdate = false
let updateCalls = 0
const tablesTouched: string[] = []

const base = (id: string, status: string) => ({
  id, community_id: 'com', profile_id: 'p1', suggested_name: `Círculo ${id}`, topic: null, reason: null, activities: null, visual_idea: null,
  notes: null, reference_image_path: null, status, professional_note: null, created_at: '2026-12-01T10:00:00Z', reviewed_at: null, reviewed_by: null,
  profile: { id: 'p1', full_name: 'Ana', avatar_url: null },
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      tablesTouched.push(table)
      return {
        select: () => ({ eq: () => ({ order: async () => ({ data: rows, error: null }) }) }),
        update: (patch: Record<string, unknown>) => ({
          eq: async (_c: string, id: string) => {
            updateCalls += 1
            if (failUpdate) return { error: { message: 'falhou' } }
            rows = rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
            return { error: null }
          },
        }),
      }
    },
  },
}))
vi.mock('../hooks/useSignedImageUrl', () => ({ useSignedImageUrl: () => ({ url: null }) }))

beforeEach(() => {
  rows = [base('a', 'pending'), base('b', 'pending')]
  failUpdate = false
  updateCalls = 0
  tablesTouched.length = 0
})
afterEach(cleanup)

describe('Solicitações de novo Círculo (profissional)', () => {
  it('aceitar tira a solicitação da lista e grava approved', async () => {
    render(<CircleRequestReview communityId="com" profileId="prof" />)
    expect(await screen.findByText('Círculo a')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Aprovar' })[0])
    await waitFor(() => expect(screen.queryByText('Círculo a')).not.toBeInTheDocument())
    expect(screen.getByText('Círculo b')).toBeInTheDocument()
    expect(rows.find((r) => r.id === 'a')?.status).toBe('approved')
  })

  it('recusar também tira da lista', async () => {
    render(<CircleRequestReview communityId="com" profileId="prof" />)
    await screen.findByText('Círculo a')
    fireEvent.click(screen.getAllByRole('button', { name: 'Recusar' })[0])
    await waitFor(() => expect(screen.queryByText('Círculo a')).not.toBeInTheDocument())
    expect(rows.find((r) => r.id === 'a')?.status).toBe('rejected')
  })

  it('a lista não mostra as que já foram respondidas', async () => {
    rows = [base('x', 'approved'), base('y', 'rejected'), base('z', 'pending')]
    render(<CircleRequestReview communityId="com" profileId="prof" />)
    expect(await screen.findByText('Círculo z')).toBeInTheDocument()
    expect(screen.queryByText('Círculo x')).not.toBeInTheDocument()
    expect(screen.queryByText('Círculo y')).not.toBeInTheDocument()
  })

  it('aprovar só mexe em circle_requests: os Círculos ficam intactos', async () => {
    render(<CircleRequestReview communityId="com" profileId="prof" />)
    await screen.findByText('Círculo a')
    fireEvent.click(screen.getAllByRole('button', { name: 'Aprovar' })[0])
    await waitFor(() => expect(screen.queryByText('Círculo a')).not.toBeInTheDocument())
    expect(new Set(tablesTouched)).toEqual(new Set(['circle_requests']))
  })

  it('se o servidor falhar, a solicitação volta à lista com mensagem', async () => {
    failUpdate = true
    render(<CircleRequestReview communityId="com" profileId="prof" />)
    await screen.findByText('Círculo a')
    fireEvent.click(screen.getAllByRole('button', { name: 'Aprovar' })[0])
    expect(await screen.findAllByText(/Não foi possível salvar agora/)).not.toHaveLength(0)
    expect(screen.getByText('Círculo a')).toBeInTheDocument()
    expect(rows.find((r) => r.id === 'a')?.status).toBe('pending')
  })

  it('clique duplo envia uma única atualização', async () => {
    render(<CircleRequestReview communityId="com" profileId="prof" />)
    await screen.findByText('Círculo a')
    const btn = screen.getAllByRole('button', { name: 'Aprovar' })[0]
    fireEvent.click(btn)
    fireEvent.click(btn)
    await waitFor(() => expect(screen.queryByText('Círculo a')).not.toBeInTheDocument())
    expect(updateCalls).toBe(1)
  })
})
