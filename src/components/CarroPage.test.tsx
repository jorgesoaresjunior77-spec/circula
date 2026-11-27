import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CarroPage } from './CarroPage'
import { hasSensitiveData } from '../lib/carro'

const settings = { ativo: true, titulo: 'Carro em Dia', subtitulo: 'Cuide do seu carro', icone: 'carro', ordem: 0, teaser: 'Libere para ler as respostas.', tempo_resposta: 'até 3 dias úteis', lembrete_dias: 3, imagem: null, imagem_alt: null }
const categorias = [{ id: 'c1', nome: 'Pneus e freios', icone: 'pneu', cidade_categorias: ['x'] }]
let acesso = false
const rpc = vi.fn(async (name: string, _args?: unknown) => {
  void _args
  if (name === 'car_home') return { error: null, data: { settings, acesso, pode_responder: false, categorias, teaser: ['Como saber se o pneu está careca?'] } }
  if (name === 'car_list')
    return {
      error: null,
      data: [{ id: 'q1', texto: 'Quando trocar as pastilhas de freio?', resposta: 'Ao ouvir chiado ou com 3 mm.', categoria_id: 'c1', respondido_em: null, fixa: false, util: 2, meu_util: false, por_nome: 'Marluce', por_funcao: 'Nutricionista', foto: null }],
    }
  return { error: null, data: [] }
})
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => (rpc as (...x: unknown[]) => unknown)(...a),
    from: () => ({ select: () => ({ in: () => ({ eq: async () => ({ data: [], error: null }) }) }) }),
  },
}))
vi.mock('./AddonCheckout', () => ({ AddonCheckout: () => <div>checkout do avulso</div> }))

describe('CarroPage', () => {
  afterEach(() => {
    cleanup()
    rpc.mockClear()
  })

  it('quem não liberou vê alguns títulos da base, o preço e o checkout', async () => {
    acesso = false
    render(<CarroPage communityId="com1" profileId="p1" onOpenCity={() => undefined} />)
    expect(await screen.findByText('Quando devo fazer a revisão do carro?')).toBeInTheDocument()
    expect(screen.getByText('R$ 4,50')).toBeInTheDocument()
    expect(screen.getByText('checkout do avulso')).toBeInTheDocument()
  })

  it('quem liberou vê as dúvidas por assunto, abre a resposta e procura', async () => {
    acesso = true
    render(<CarroPage communityId="com1" profileId="p1" onOpenCity={() => undefined} />)
    fireEvent.click(await screen.findByText('O pneu furou com o carro andando. O que fazer?'))
    expect(screen.getByText(/Segure o volante firme/)).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/pneu, bateria/), { target: { value: 'ipva atrasado' } })
    await waitFor(() => expect(screen.getByText('Atrasei o IPVA. O que acontece?')).toBeInTheDocument())
    // a profissional não escreve respostas aqui: não há mais a lista vinda do banco
    expect(rpc).not.toHaveBeenCalledWith('car_list', expect.anything())
  })

  it('detecta placa, telefone e CPF no texto da pergunta', () => {
    expect(hasSensitiveData('meu carro ABC-1D23 não liga')).toBe(true)
    expect(hasSensitiveData('me liga (51) 99999-1234')).toBe(true)
    expect(hasSensitiveData('CPF 123.456.789-09')).toBe(true)
    expect(hasSensitiveData('a luz do painel acendeu')).toBe(false)
  })
})
