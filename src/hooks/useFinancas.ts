import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIAS_PADRAO } from '../lib/financas'
import type { FinCategoria, FinLancamento, FinTipo } from '../lib/financas'

// Dados do módulo Finanças. Tudo é privado: o banco só devolve as linhas da própria pessoa (RLS),
// e nada daqui vai para analytics, logs ou terceiros.

const COLS = 'id, tipo, categoria, valor_centavos, data, observacao, movimento, parcela_grupo, parcela_n, parcela_total'

export type NovoLancamento = Omit<FinLancamento, 'id'>

export function useFinancas() {
  const [lancs, setLancs] = useState<FinLancamento[] | null>(null)
  const [custom, setCustom] = useState<FinCategoria[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [l, c] = await Promise.all([
      supabase.from('fin_lancamentos').select(COLS).order('data', { ascending: false }).limit(6000),
      supabase.from('fin_categorias').select('id, tipo, nome, icone').order('criado_em'),
    ])
    if (l.error || c.error) {
      setError('Não foi possível carregar agora. Confira a internet e tente de novo.')
      return
    }
    setError(null)
    setLancs((l.data ?? []) as FinLancamento[])
    setCustom(((c.data ?? []) as { id: string; tipo: FinTipo; nome: string; icone: string }[]).map((x) => ({ ...x, padrao: false })))
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      supabase.from('fin_lancamentos').select(COLS).order('data', { ascending: false }).limit(6000),
      supabase.from('fin_categorias').select('id, tipo, nome, icone').order('criado_em'),
    ]).then(([l, c]) => {
      if (cancelled) return
      if (l.error || c.error) {
        setError('Não foi possível carregar agora. Confira a internet e tente de novo.')
        return
      }
      setLancs((l.data ?? []) as FinLancamento[])
      setCustom(((c.data ?? []) as { id: string; tipo: FinTipo; nome: string; icone: string }[]).map((x) => ({ ...x, padrao: false })))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const categorias = useCallback((tipo: FinTipo) => [...CATEGORIAS_PADRAO.filter((c) => c.tipo === tipo), ...custom.filter((c) => c.tipo === tipo)], [custom])
  const todasCategorias = [...CATEGORIAS_PADRAO, ...custom]

  async function adicionar(rows: NovoLancamento[]): Promise<string | null> {
    const { error: e } = await supabase.from('fin_lancamentos').insert(rows)
    if (e) return 'Não foi possível salvar agora. Tente de novo.'
    await reload()
    return null
  }
  async function editar(id: string, patch: Partial<NovoLancamento>): Promise<string | null> {
    const { error: e } = await supabase.from('fin_lancamentos').update(patch).eq('id', id)
    if (e) return 'Não foi possível salvar agora. Tente de novo.'
    await reload()
    return null
  }
  async function apagar(ids: string[]): Promise<string | null> {
    const { error: e } = await supabase.from('fin_lancamentos').delete().in('id', ids)
    if (e) return 'Não foi possível apagar agora. Tente de novo.'
    await reload()
    return null
  }
  async function criarCategoria(tipo: FinTipo, nome: string, icone: string): Promise<string | null> {
    const { error: e } = await supabase.from('fin_categorias').insert({ tipo, nome: nome.trim(), icone })
    if (e) return e.code === '23505' ? 'Você já tem uma categoria com esse nome.' : 'Não foi possível criar a categoria agora.'
    await reload()
    return null
  }
  async function excluirCategoria(id: string): Promise<string | null> {
    const { error: e } = await supabase.from('fin_categorias').delete().eq('id', id)
    if (e) return e.message.includes('categoria_com_lancamentos') ? 'Só dá para excluir categorias sem lançamentos.' : 'Não foi possível excluir agora.'
    await reload()
    return null
  }

  return { lancs, error, categorias, todasCategorias, adicionar, editar, apagar, criarCategoria, excluirCategoria }
}
