import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CarroCategoria, CarroSettings } from '../lib/carro'
import { CAR_ICON_NAMES, CarIcon } from './CarIcon'
import { ImageField } from './CityGroupsAdmin'

// Painel → Carro em Dia: fila de perguntas, respostas publicadas, categorias, equipe, o card e denúncias.

type Sub = 'fila' | 'publicadas' | 'categorias' | 'equipe' | 'card' | 'denuncias'
const SUBS: { key: Sub; label: string }[] = [
  { key: 'fila', label: 'Fila' },
  { key: 'publicadas', label: 'Publicadas' },
  { key: 'categorias', label: 'Categorias' },
  { key: 'equipe', label: 'Equipe' },
  { key: 'card', label: 'Card' },
  { key: 'denuncias', label: 'Denúncias' },
]

interface Q {
  id: string
  texto: string
  status: 'aguardando' | 'mais_info' | 'respondida' | 'recusada'
  motivo: string | null
  resposta: string | null
  categoria_id: string | null
  modelo: string | null
  ano: number | null
  foto: string | null
  publicada: boolean
  fixa: boolean
  criado_em: string
  semente: boolean
  quem: string
}

const FILAS: { key: string; label: string; test: (q: Q) => boolean }[] = [
  { key: 'aguardando', label: 'Aguardando', test: (q) => q.status === 'aguardando' },
  { key: 'mais_info', label: 'Mais informações', test: (q) => q.status === 'mais_info' },
  { key: 'respondida', label: 'Respondidas', test: (q) => q.status === 'respondida' },
  { key: 'recusada', label: 'Não publicadas', test: (q) => q.status === 'recusada' || (q.status === 'respondida' && !q.publicada) },
]

function useCategorias() {
  const [cats, setCats] = useState<(CarroCategoria & { ordem: number; ativa: boolean })[]>([])
  const reload = useCallback(async () => {
    const { data } = await supabase.from('car_categories').select('id, nome, icone, ordem, ativa, cidade_categorias').order('ordem')
    setCats((data ?? []) as never)
  }, [])
  useEffect(() => {
    let cancelled = false
    void supabase
      .from('car_categories')
      .select('id, nome, icone, ordem, ativa, cidade_categorias')
      .order('ordem')
      .then(({ data }) => {
        if (!cancelled) setCats((data ?? []) as never)
      })
    return () => {
      cancelled = true
    }
  }, [])
  return { cats, reload }
}

function QueueItem({ q, cats, publicadas, onDone }: { q: Q; cats: CarroCategoria[]; publicadas: Q[]; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [texto, setTexto] = useState(q.texto)
  const [cat, setCat] = useState(q.categoria_id ?? '')
  const [resposta, setResposta] = useState(q.resposta ?? '')
  const [motivo, setMotivo] = useState(q.motivo ?? '')
  const [dup, setDup] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function agir(acao: 'rascunho' | 'publicar' | 'mais_info' | 'recusar') {
    setErro(null)
    setBusy(true)
    const { error } = await supabase.rpc('car_review', {
      p_id: q.id,
      p_acao: acao,
      p_texto: texto,
      p_categoria: cat || null,
      p_resposta: resposta,
      p_motivo: motivo,
      p_duplicada_de: acao === 'publicar' && dup ? dup : null,
    })
    setBusy(false)
    if (error) {
      setErro(error.message.includes('resposta_vazia') ? 'Escreva a resposta antes de publicar.' : error.message.includes('motivo_obrigatorio') ? 'Escreva o motivo, em tom acolhedor.' : 'Não foi possível salvar agora.')
      return
    }
    onDone()
  }

  return (
    <article className="cty-admin-item">
      <button type="button" className="car-card-q" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{q.texto}</span>
      </button>
      <p className="home-muted">
        {q.quem} · {new Date(q.criado_em).toLocaleDateString('pt-BR')}
        {q.modelo ? ` · ${q.modelo}` : ''}
        {q.ano ? ` ${q.ano}` : ''}
      </p>
      {open && (
        <div className="car-form">
          {q.foto && <img className="cty-group-admin-img" src={q.foto} alt="Foto enviada com a pergunta" loading="lazy" />}
          <label className="cty-field">
            <span className="cty-label">Pergunta (pode corrigir a digitação)</span>
            <textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </label>
          <label className="cty-field">
            <span className="cty-label">Categoria</span>
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Sem categoria</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="cty-field">
            <span className="cty-label">Resposta</span>
            <textarea rows={8} maxLength={6000} value={resposta} onChange={(e) => setResposta(e.target.value)} />
          </label>
          <label className="cty-field">
            <span className="cty-label">Ou repetir uma resposta que já existe</span>
            <select value={dup} onChange={(e) => setDup(e.target.value)}>
              <option value="">Não, escrevo uma resposta</option>
              {publicadas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.texto.slice(0, 70)}
                </option>
              ))}
            </select>
          </label>
          <label className="cty-field">
            <span className="cty-label">Motivo (para pedir mais informações ou recusar)</span>
            <input type="text" maxLength={600} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          {erro && (
            <p className="auth-error" role="alert">
              {erro}
            </p>
          )}
          <div className="cty-actions">
            <button type="button" className="water-primary" disabled={busy} onClick={() => void agir('publicar')}>
              Publicar
            </button>
            <button type="button" className="cty-btn" disabled={busy} onClick={() => void agir('rascunho')}>
              Salvar rascunho
            </button>
            <button type="button" className="cty-btn" disabled={busy} onClick={() => void agir('mais_info')}>
              Pedir mais informações
            </button>
            <button type="button" className="cty-btn" disabled={busy} onClick={() => void agir('recusar')}>
              Recusar
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

function Fila({ perguntas, cats, reload, soPublicadas }: { perguntas: Q[]; cats: CarroCategoria[]; reload: () => void; soPublicadas: boolean }) {
  const [fila, setFila] = useState('aguardando')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const publicadas = useMemo(() => perguntas.filter((p) => p.publicada), [perguntas])
  const lista = useMemo(() => {
    const term = q.trim().toLowerCase()
    return perguntas.filter((p) => (soPublicadas ? p.publicada : FILAS.find((f) => f.key === fila)?.test(p)) && (!cat || p.categoria_id === cat) && (!term || p.texto.toLowerCase().includes(term)))
  }, [perguntas, fila, q, cat, soPublicadas])

  async function flags(p: Q, publicada: boolean, fixa: boolean) {
    await supabase.rpc('car_flags', { p_id: p.id, p_publicada: publicada, p_fixa: fixa })
    reload()
  }

  return (
    <div className="cty-admin">
      {!soPublicadas && (
        <div className="cty-chips" role="tablist" aria-label="Filas">
          {FILAS.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={fila === f.key} className={`cty-chip${fila === f.key ? ' cty-chip--on' : ''}`} onClick={() => setFila(f.key)}>
              {f.label} · {perguntas.filter(f.test).length}
            </button>
          ))}
        </div>
      )}
      <input type="search" className="cty-search" placeholder="Buscar pergunta" aria-label="Buscar pergunta" value={q} onChange={(e) => setQ(e.target.value)} />
      <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filtrar por categoria">
        <option value="">Todas as categorias</option>
        {cats.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
      {lista.length === 0 && <p className="home-muted">Nada por aqui.</p>}
      {lista.map((p) =>
        soPublicadas ? (
          <article key={p.id} className="cty-admin-item">
            <p>
              <strong>{p.texto}</strong>
              {p.fixa ? ' · fixa' : ''}
            </p>
            <div className="cty-actions">
              <button type="button" className="cty-btn cty-btn--small" onClick={() => void flags(p, false, p.fixa)}>
                Despublicar
              </button>
              <button type="button" className="cty-btn cty-btn--small" onClick={() => void flags(p, true, !p.fixa)}>
                {p.fixa ? 'Soltar' : 'Fixar no topo'}
              </button>
            </div>
          </article>
        ) : (
          <QueueItem key={`${p.id}-${p.status}-${p.publicada}`} q={p} cats={cats} publicadas={publicadas} onDone={reload} />
        ),
      )}
    </div>
  )
}

function Categorias() {
  const { cats, reload } = useCategorias()
  const [cidade, setCidade] = useState<{ id: string; nome: string }[]>([])
  const [novo, setNovo] = useState('')
  useEffect(() => {
    let cancelled = false
    void supabase
      .from('city_categories')
      .select('id, nome')
      .eq('status', 'ativa')
      .order('nome')
      .then(({ data }) => {
        if (!cancelled) setCidade((data ?? []) as { id: string; nome: string }[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function save(id: string, patch: Record<string, unknown>) {
    await supabase.from('car_categories').update(patch).eq('id', id)
    await reload()
  }
  async function criar() {
    if (novo.trim().length < 2) return
    await supabase.from('car_categories').insert({ nome: novo.trim(), icone: 'carro', ordem: cats.length + 1 })
    setNovo('')
    await reload()
  }
  return (
    <div className="cty-admin">
      <p className="home-muted">Cada categoria pode apontar para categorias de "Na minha cidade". As respostas nunca indicam um lugar específico, só a categoria.</p>
      {cats.map((c) => (
        <article key={c.id} className="cty-admin-item">
          <label className="cty-field">
            <span className="cty-label">Nome</span>
            <input type="text" defaultValue={c.nome} maxLength={60} onBlur={(e) => e.target.value.trim().length >= 2 && e.target.value !== c.nome && void save(c.id, { nome: e.target.value.trim() })} />
          </label>
          <div className="cty-chips" role="radiogroup" aria-label="Ícone">
            {CAR_ICON_NAMES.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={c.icone === n} aria-label={n} className={`cty-chip${c.icone === n ? ' cty-chip--on' : ''}`} onClick={() => void save(c.id, { icone: n })}>
                <CarIcon name={n} size={18} />
              </button>
            ))}
          </div>
          <label className="cty-field">
            <span className="cty-label">Ordem</span>
            <input type="number" defaultValue={c.ordem} onBlur={(e) => void save(c.id, { ordem: Number(e.target.value) || 0 })} />
          </label>
          <p className="cty-label">Categorias de "Na minha cidade" ligadas a esta</p>
          <div className="cty-chips">
            {cidade.map((cc) => {
              const on = c.cidade_categorias.includes(cc.id)
              return (
                <button key={cc.id} type="button" aria-pressed={on} className={`cty-chip${on ? ' cty-chip--on' : ''}`} onClick={() => void save(c.id, { cidade_categorias: on ? c.cidade_categorias.filter((x) => x !== cc.id) : [...c.cidade_categorias, cc.id] })}>
                  {cc.nome}
                </button>
              )
            })}
          </div>
          <label className="car-check">
            <input type="checkbox" checked={c.ativa} onChange={(e) => void save(c.id, { ativa: e.target.checked })} /> Ativa
          </label>
        </article>
      ))}
      <div className="cty-actions">
        <input type="text" placeholder="Nova categoria" value={novo} maxLength={60} onChange={(e) => setNovo(e.target.value)} />
        <button type="button" className="water-primary" onClick={() => void criar()}>
          Criar categoria
        </button>
      </div>
    </div>
  )
}

interface Resp {
  profile_id: string
  nome: string
  funcao: string
  foto: string | null
}

function Equipe() {
  const [lista, setLista] = useState<Resp[]>([])
  const [candidatas, setCandidatas] = useState<{ id: string; full_name: string | null }[]>([])
  const load = useCallback(async () => {
    const [{ data: r }, { data: p }] = await Promise.all([supabase.from('car_responders').select('profile_id, nome, funcao, foto').order('nome'), supabase.from('profiles').select('id, full_name').in('role', ['master', 'professional'])])
    setLista((r ?? []) as Resp[])
    setCandidatas((p ?? []) as { id: string; full_name: string | null }[])
  }, [])
  useEffect(() => {
    let cancelled = false
    void Promise.all([supabase.from('car_responders').select('profile_id, nome, funcao, foto').order('nome'), supabase.from('profiles').select('id, full_name').in('role', ['master', 'professional'])]).then(([{ data: r }, { data: p }]) => {
      if (cancelled) return
      setLista((r ?? []) as Resp[])
      setCandidatas((p ?? []) as { id: string; full_name: string | null }[])
    })
    return () => {
      cancelled = true
    }
  }, [])
  async function patch(id: string, v: Partial<Resp>) {
    await supabase.from('car_responders').update(v).eq('profile_id', id)
    await load()
  }
  const fora = candidatas.filter((c) => !lista.some((r) => r.profile_id === c.id))
  return (
    <div className="cty-admin">
      <p className="home-muted">Só quem está aqui recebe os avisos de perguntas novas e pode responder. O nome, a função e a foto aparecem na resposta.</p>
      {lista.map((r) => (
        <article key={r.profile_id} className="cty-admin-item">
          <label className="cty-field">
            <span className="cty-label">Nome</span>
            <input type="text" defaultValue={r.nome} maxLength={80} onBlur={(e) => e.target.value.trim() && void patch(r.profile_id, { nome: e.target.value.trim() })} />
          </label>
          <label className="cty-field">
            <span className="cty-label">Função</span>
            <input type="text" defaultValue={r.funcao} maxLength={80} onBlur={(e) => void patch(r.profile_id, { funcao: e.target.value.trim() })} />
          </label>
          <ImageField value={r.foto} spec="400 × 400 px (quadrada). Aparece ao lado do nome na resposta." onChange={(u) => void patch(r.profile_id, { foto: u })} />
          <button
            type="button"
            className="cty-btn cty-btn--small"
            onClick={() => void supabase.from('car_responders').delete().eq('profile_id', r.profile_id).then(load)}
          >
            Tirar da equipe
          </button>
        </article>
      ))}
      {fora.map((c) => (
        <div key={c.id} className="cty-actions">
          <span>{c.full_name ?? 'Profissional'}</span>
          <button
            type="button"
            className="cty-btn cty-btn--small"
            onClick={() => void supabase.from('car_responders').insert({ profile_id: c.id, nome: c.full_name?.trim() || 'Profissional', funcao: 'Profissional do Círcula' }).then(load)}
          >
            Habilitar a responder
          </button>
        </div>
      ))}
    </div>
  )
}

function CardConfig() {
  const [s, setS] = useState<CarroSettings | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void supabase
      .from('car_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setS(data as CarroSettings | null)
      })
    return () => {
      cancelled = true
    }
  }, [])
  if (!s) return <p className="home-muted">Carregando…</p>
  const set = (v: Partial<CarroSettings>) => setS({ ...s, ...v })
  async function save(next?: Partial<CarroSettings>) {
    const body = { ...s, ...next }
    const { error } = await supabase.from('car_settings').update({
      ativo: body.ativo, titulo: body.titulo, subtitulo: body.subtitulo, icone: body.icone, ordem: body.ordem,
      teaser: body.teaser, tempo_resposta: body.tempo_resposta, lembrete_dias: body.lembrete_dias, imagem: body.imagem, imagem_alt: body.imagem_alt,
    }).eq('id', 1)
    setMsg(error ? 'Não foi possível salvar. Confira os campos.' : 'Salvo.')
  }
  return (
    <div className="cty-admin">
      <label className="car-check">
        <input type="checkbox" checked={s.ativo} onChange={(e) => set({ ativo: e.target.checked })} /> Card ativo na Home
      </label>
      {(
        [
          ['titulo', 'Título', 40],
          ['subtitulo', 'Subtítulo', 80],
          ['teaser', 'Texto para quem ainda não liberou', 240],
          ['tempo_resposta', 'Tempo de resposta mostrado', 40],
        ] as const
      ).map(([k, label, max]) => (
        <label key={k} className="cty-field">
          <span className="cty-label">{label}</span>
          <input type="text" maxLength={max} value={s[k]} onChange={(e) => set({ [k]: e.target.value })} />
        </label>
      ))}
      <label className="cty-field">
        <span className="cty-label">Posição entre os cards finos (0 = primeiro)</span>
        <input type="number" min={0} max={20} value={s.ordem} onChange={(e) => set({ ordem: Number(e.target.value) || 0 })} />
      </label>
      <label className="cty-field">
        <span className="cty-label">Lembrar a equipe após quantos dias sem resposta</span>
        <input type="number" min={1} max={30} value={s.lembrete_dias} onChange={(e) => set({ lembrete_dias: Number(e.target.value) || 3 })} />
      </label>
      <p className="cty-label">Ícone</p>
      <div className="cty-chips" role="radiogroup" aria-label="Ícone do card">
        {CAR_ICON_NAMES.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={s.icone === n} aria-label={n} className={`cty-chip${s.icone === n ? ' cty-chip--on' : ''}`} onClick={() => set({ icone: n })}>
            <CarIcon name={n} size={18} />
          </button>
        ))}
      </div>
      <ImageField value={s.imagem} spec="1600 × 800 px (2:1, horizontal). Aparece no topo da central do Carro em Dia." onChange={(u) => set({ imagem: u })} />
      <label className="cty-field">
        <span className="cty-label">Texto alternativo da imagem (obrigatório se houver imagem)</span>
        <input type="text" maxLength={160} value={s.imagem_alt ?? ''} onChange={(e) => set({ imagem_alt: e.target.value })} />
      </label>
      {msg && <p className="auth-success">{msg}</p>}
      <button type="button" className="water-primary" disabled={!!s.imagem && !(s.imagem_alt ?? '').trim()} onClick={() => void save()}>
        Salvar
      </button>
    </div>
  )
}

interface Rep {
  id: string
  question_id: string
  motivo: string
  resolvida: boolean
  criado_em: string
}

function Denuncias({ perguntas }: { perguntas: Q[] }) {
  const [rows, setRows] = useState<Rep[] | null>(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('car_reports').select('id, question_id, motivo, resolvida, criado_em').order('criado_em', { ascending: false })
    setRows((data ?? []) as Rep[])
  }, [])
  useEffect(() => {
    let cancelled = false
    void supabase
      .from('car_reports')
      .select('id, question_id, motivo, resolvida, criado_em')
      .order('criado_em', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setRows((data ?? []) as Rep[])
      })
    return () => {
      cancelled = true
    }
  }, [])
  return (
    <div className="cty-admin">
      {rows && rows.length === 0 && <p className="home-muted">Nenhuma denúncia.</p>}
      {rows?.map((r) => (
        <article key={r.id} className={`cty-admin-item${r.resolvida ? ' feedback-item--lido' : ''}`}>
          <p>
            <strong>{perguntas.find((p) => p.id === r.question_id)?.texto ?? 'Pergunta'}</strong>
          </p>
          <p className="feedback-text">{r.motivo}</p>
          <button type="button" className="cty-btn cty-btn--small" onClick={() => void supabase.from('car_reports').update({ resolvida: !r.resolvida }).eq('id', r.id).then(load)}>
            {r.resolvida ? 'Reabrir' : 'Marcar como resolvida'}
          </button>
        </article>
      ))}
    </div>
  )
}

export function CarroAdmin() {
  const [sub, setSub] = useState<Sub>('fila')
  const [perguntas, setPerguntas] = useState<Q[]>([])
  const [erro, setErro] = useState(false)
  const { cats } = useCategorias()
  const reload = useCallback(async () => {
    const { data, error } = await supabase.rpc('car_queue')
    if (error) setErro(true)
    else {
      setErro(false)
      setPerguntas((data ?? []) as Q[])
    }
  }, [])
  useEffect(() => {
    let cancelled = false
    void supabase.rpc('car_queue').then(({ data, error }) => {
      if (cancelled) return
      if (error) setErro(true)
      else setPerguntas((data ?? []) as Q[])
    })
    return () => {
      cancelled = true
    }
  }, [])
  return (
    <div className="cty-admin">
      <div className="cty-tabs" role="tablist" aria-label="Carro em Dia">
        {SUBS.map((s) => (
          <button key={s.key} type="button" role="tab" aria-selected={sub === s.key} className={`cty-tab${sub === s.key ? ' cty-tab--on' : ''}`} onClick={() => setSub(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
      {erro && (
        <p className="auth-error" role="alert">
          Você não tem permissão para responder, ou não foi possível carregar. Peça para entrar na aba Equipe.
        </p>
      )}
      {sub === 'fila' && <Fila perguntas={perguntas} cats={cats} reload={() => void reload()} soPublicadas={false} />}
      {sub === 'publicadas' && <Fila perguntas={perguntas} cats={cats} reload={() => void reload()} soPublicadas />}
      {sub === 'categorias' && <Categorias />}
      {sub === 'equipe' && <Equipe />}
      {sub === 'card' && <CardConfig />}
      {sub === 'denuncias' && <Denuncias perguntas={perguntas} />}
    </div>
  )
}
