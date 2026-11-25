import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { DivAcerto, DivDespesa, DivParticipante } from '../lib/dividir'

export interface DivGrupo {
  id: string
  nome: string
}

const FALHA = 'Não foi possível salvar agora. Tente de novo.'

export function useDividirGrupos() {
  const [grupos, setGrupos] = useState<DivGrupo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    const { data, error: e } = await supabase.from('div_grupos').select('id, nome').order('criado_em', { ascending: false })
    if (e) return setError('Não foi possível carregar agora. Confira a internet e tente de novo.')
    setError(null)
    setGrupos((data ?? []) as DivGrupo[])
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  async function criar(nome: string): Promise<string | null> {
    const { error: e } = await supabase.from('div_grupos').insert({ nome: nome.trim() })
    if (e) return FALHA
    await reload()
    return null
  }
  async function apagar(id: string): Promise<string | null> {
    const { error: e } = await supabase.from('div_grupos').delete().eq('id', id)
    if (e) return 'Não foi possível apagar agora.'
    await reload()
    return null
  }
  return { grupos, error, criar, apagar }
}

export function useDividirGrupo(grupoId: string) {
  const [participantes, setParticipantes] = useState<DivParticipante[] | null>(null)
  const [despesas, setDespesas] = useState<DivDespesa[]>([])
  const [acertos, setAcertos] = useState<DivAcerto[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [p, d, a] = await Promise.all([
      supabase.from('div_participantes').select('id, nome, ativo').eq('grupo_id', grupoId).order('criado_em'),
      supabase.from('div_despesas').select('id, descricao, valor_centavos, pagador_id, participantes, data').eq('grupo_id', grupoId).order('data', { ascending: false }),
      supabase.from('div_acertos').select('id, de_id, para_id, valor_centavos, feito_em').eq('grupo_id', grupoId).order('feito_em', { ascending: false }),
    ])
    if (p.error || d.error || a.error) return setError('Não foi possível carregar agora. Confira a internet e tente de novo.')
    setError(null)
    setParticipantes((p.data ?? []) as DivParticipante[])
    setDespesas((d.data ?? []) as DivDespesa[])
    setAcertos((a.data ?? []) as DivAcerto[])
  }, [grupoId])
  useEffect(() => {
    void reload()
  }, [reload])

  async function run(q: PromiseLike<{ error: unknown }>, msg = FALHA): Promise<string | null> {
    const { error: e } = await q
    if (e) return msg
    await reload()
    return null
  }

  return {
    participantes,
    despesas,
    acertos,
    error,
    adicionarParticipante: (nome: string) => run(supabase.from('div_participantes').insert({ grupo_id: grupoId, nome: nome.trim() })),
    /** Com histórico (pagou ou participou de algo), só deixa de aparecer nas próximas despesas; sem histórico, some de vez. */
    removerParticipante: async (id: string) => {
      const comHistorico = despesas.some((d) => d.pagador_id === id || d.participantes.includes(id)) || acertos.some((a) => a.de_id === id || a.para_id === id)
      if (comHistorico) return run(supabase.from('div_participantes').update({ ativo: false }).eq('id', id))
      return run(supabase.from('div_participantes').delete().eq('id', id))
    },
    reativarParticipante: (id: string) => run(supabase.from('div_participantes').update({ ativo: true }).eq('id', id)),
    salvarDespesa: (d: Omit<DivDespesa, 'id'>, id?: string) =>
      id ? run(supabase.from('div_despesas').update(d).eq('id', id)) : run(supabase.from('div_despesas').insert({ ...d, grupo_id: grupoId })),
    apagarDespesa: (id: string) => run(supabase.from('div_despesas').delete().eq('id', id), 'Não foi possível apagar agora.'),
    marcarPago: (de: string, para: string, valor: number) => run(supabase.from('div_acertos').insert({ grupo_id: grupoId, de_id: de, para_id: para, valor_centavos: valor })),
    desfazerPagamento: (id: string) => run(supabase.from('div_acertos').delete().eq('id', id)),
  }
}
