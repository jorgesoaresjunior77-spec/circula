import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIAS_PADRAO } from '../lib/financas'
import type { FinCategoria, FinLancamento, FinTipo } from '../lib/financas'

// Dados do módulo Finanças. Tudo é privado: o banco só devolve as linhas da própria pessoa (RLS),
// e nada daqui vai para analytics, logs ou terceiros.

const COLS = 'id, tipo, categoria, valor_centavos, data, observacao, movimento, parcela_grupo, parcela_n, parcela_total'

export type NovoLancamento = Omit<FinLancamento, 'id'>

interface Ajuste {
  categoria: string
  nome: string | null
  icone: string | null
  oculta: boolean
}

export function useFinancas() {
  const [lancs, setLancs] = useState<FinLancamento[] | null>(null)
  const [custom, setCustom] = useState<FinCategoria[]>([])
  const [ajustes, setAjustes] = useState<Ajuste[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [l, c, aj] = await Promise.all([
      supabase.from('fin_lancamentos').select(COLS).order('data', { ascending: false }).limit(6000),
      supabase.from('fin_categorias').select('id, tipo, nome, icone').order('criado_em'),
      supabase.from('fin_categoria_ajustes').select('categoria, nome, icone, oculta'),
    ])
    if (l.error || c.error) {
      setError('Não foi possível carregar agora. Confira a internet e tente de novo.')
      return
    }
    setAjustes(aj.error ? [] : ((aj.data ?? []) as Ajuste[]))
    setError(null)
    setLancs((l.data ?? []) as FinLancamento[])
    setCustom(((c.data ?? []) as { id: string; tipo: FinTipo; nome: string; icone: string }[]).map((x) => ({ ...x, padrao: false })))
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      supabase.from('fin_lancamentos').select(COLS).order('data', { ascending: false }).limit(6000),
      supabase.from('fin_categorias').select('id, tipo, nome, icone').order('criado_em'),
      supabase.from('fin_categoria_ajustes').select('categoria, nome, icone, oculta'),
    ]).then(([l, c, aj]) => {
      if (cancelled) return
      if (l.error || c.error) {
        setError('Não foi possível carregar agora. Confira a internet e tente de novo.')
        return
      }
      setAjustes(aj.error ? [] : ((aj.data ?? []) as Ajuste[]))
      setLancs((l.data ?? []) as FinLancamento[])
      setCustom(((c.data ?? []) as { id: string; tipo: FinTipo; nome: string; icone: string }[]).map((x) => ({ ...x, padrao: false })))
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Padrões podem ser renomeadas, trocar de ícone ou sumir da lista (o histórico continua apontando para elas).
  const padroes = CATEGORIAS_PADRAO.map((c) => {
    const a = ajustes.find((x) => x.categoria === c.id)
    return a ? { ...c, nome: a.nome ?? c.nome, icone: a.icone ?? c.icone, oculta: a.oculta } : { ...c, oculta: false }
  })
  const categorias = useCallback(
    (tipo: FinTipo): FinCategoria[] => [...padroes.filter((c) => c.tipo === tipo && !c.oculta), ...custom.filter((c) => c.tipo === tipo)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [custom, ajustes],
  )
  const todasCategorias: FinCategoria[] = [...padroes, ...custom]

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
  /** Renomeia e/ou troca o ícone. Padrão: guarda o ajuste; própria: altera a linha. */
  async function editarCategoria(id: string, nome: string, icone: string): Promise<string | null> {
    if (!nome.trim()) return 'Dê um nome para a categoria.'
    if (id.startsWith('padrao:')) {
      const { error: e } = await supabase.from('fin_categoria_ajustes').upsert({ categoria: id, nome: nome.trim(), icone, oculta: false }, { onConflict: 'profile_id,categoria' })
      if (e) return 'Não foi possível salvar agora.'
    } else {
      const { error: e } = await supabase.from('fin_categorias').update({ nome: nome.trim(), icone }).eq('id', id)
      if (e) return e.code === '23505' ? 'Você já tem uma categoria com esse nome.' : 'Não foi possível salvar agora.'
    }
    await reload()
    return null
  }
  /** Com lançamentos, EXIGE um destino: tudo é movido antes (nada do histórico é apagado). */
  async function excluirCategoria(id: string, tipo: FinTipo, destino?: string): Promise<string | null> {
    const tem = (lancs ?? []).some((l) => l.categoria === id)
    if (tem) {
      if (!destino || destino === id) return 'Escolha para onde levar os lançamentos.'
      const { error: r } = await supabase.rpc('fin_reclassificar', { p_origem: id, p_destino: destino, p_tipo: tipo })
      if (r) return 'Não foi possível mover os lançamentos agora. Nada foi apagado.'
    }
    if (id.startsWith('padrao:')) {
      const { error: e } = await supabase.from('fin_categoria_ajustes').upsert({ categoria: id, oculta: true }, { onConflict: 'profile_id,categoria' })
      if (e) return 'Não foi possível excluir agora.'
    } else {
      const { error: e } = await supabase.from('fin_categorias').delete().eq('id', id)
      if (e) return 'Não foi possível excluir agora.'
    }
    await reload()
    return null
  }

  return { lancs, error, categorias, todasCategorias, adicionar, editar, apagar, criarCategoria, editarCategoria, excluirCategoria }
}
