import { useCallback, useEffect, useMemo, useState } from 'react'
import { CarroLivi } from './CarroLivi'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { CARRO_PLAN_KEY, CARRO_PRICES, hasSensitiveData, sendToCity, takeCarroRequest, useCarroHome } from '../lib/carro'
import type { CarroCategoria } from '../lib/carro'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { AddonCheckout } from './AddonCheckout'
import { CarIcon } from './CarIcon'
import { ImageField } from './CityGroupsAdmin'

// Carro em Dia: central de perguntas e respostas para ajudar mulheres a cuidar dos seus carros.
// Quem não liberou o avulso vê só os títulos (teaser). Quem liberou lê as respostas e pergunta.

interface Resposta {
  id: string
  texto: string
  resposta: string
  categoria_id: string | null
  respondido_em: string | null
  fixa: boolean
  util: number
  meu_util: boolean
  por_nome: string | null
  por_funcao: string | null
  foto: string | null
}

interface Minha {
  id: string
  texto: string
  status: 'aguardando' | 'mais_info' | 'respondida' | 'recusada'
  motivo: string | null
  resposta: string | null
  respondido_em: string | null
  por_nome: string | null
  por_funcao: string | null
  criado_em: string
}

const STATUS_LABEL: Record<Minha['status'], string> = {
  aguardando: 'Aguardando resposta',
  mais_info: 'Precisamos de mais informações',
  respondida: 'Respondida',
  recusada: 'Não publicada',
}

const ERRORS: Record<string, string> = {
  limite_diario: 'Você já enviou 5 perguntas hoje. Amanhã você pode enviar mais.',
  conteudo_bloqueado: 'Não foi possível enviar: o texto tem palavras que não são permitidas aqui.',
  texto_invalido: 'Conte um pouco mais. A pergunta precisa ter entre 8 e 1000 letras.',
}

function Aviso() {
  return (
    <p className="car-aviso" role="note">
      Orientações gerais, que não substituem a avaliação presencial de um mecânico. Em freio, direção, pneu ou superaquecimento, procure um profissional. Em emergência, ligue 190 (polícia), 192 (SAMU) ou 193 (bombeiros).
    </p>
  )
}

function Respostas({ categorias, inicialCat, onGoCity }: { categorias: CarroCategoria[]; inicialCat: string | null; onGoCity: (ids: string[]) => void }) {
  const [itens, setItens] = useState<Resposta[] | null>(null)
  const [erro, setErro] = useState(false)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | null>(inicialCat)
  const [ordem, setOrdem] = useState<'uteis' | 'novas'>('uteis')
  const [aberta, setAberta] = useState<string | null>(null)
  const [denuncia, setDenuncia] = useState<{ id: string; motivo: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('car_list')
    if (error) setErro(true)
    else {
      setErro(false)
      setItens((data ?? []) as Resposta[])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('car_list').then(({ data, error }) => {
      if (cancelled) return
      if (error) setErro(true)
      else setItens((data ?? []) as Resposta[])
    })
    return () => {
      cancelled = true
    }
  }, [])

  const catById = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])
  const lista = useMemo(() => {
    const term = q.trim().toLowerCase()
    const base = (itens ?? []).filter((i) => (!cat || i.categoria_id === cat) && (!term || i.texto.toLowerCase().includes(term) || i.resposta.toLowerCase().includes(term)))
    return [...base].sort((a, b) =>
      ordem === 'uteis' ? b.util - a.util || Number(b.fixa) - Number(a.fixa) : new Date(b.respondido_em ?? 0).getTime() - new Date(a.respondido_em ?? 0).getTime(),
    )
  }, [itens, q, cat, ordem])

  async function util(id: string) {
    await supabase.rpc('car_helpful_toggle', { p_id: id })
    await carregar()
  }
  async function compartilhar(i: Resposta) {
    const texto = `${i.texto}\n\n${i.resposta}\n\nDo Carro em Dia, no Círcula.`
    try {
      if (navigator.share) await navigator.share({ title: i.texto, text: texto })
      else {
        await navigator.clipboard.writeText(texto)
        setAviso('Resposta copiada. É só colar onde quiser.')
      }
    } catch {
      /* a pessoa fechou o compartilhamento */
    }
  }
  async function enviarDenuncia() {
    if (!denuncia) return
    const { error } = await supabase.rpc('car_report', { p_id: denuncia.id, p_motivo: denuncia.motivo })
    setAviso(error ? 'Conte o motivo com pelo menos 3 letras.' : 'Obrigada. A equipe vai olhar com carinho.')
    if (!error) setDenuncia(null)
  }

  return (
    <div className="car-respostas">
      <input type="search" className="cty-search" placeholder="Buscar uma pergunta" aria-label="Buscar uma pergunta" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="cty-chips car-chips" role="group" aria-label="Categorias">
        <button type="button" className={`cty-chip${!cat ? ' cty-chip--on' : ''}`} onClick={() => setCat(null)}>
          Todas
        </button>
        {categorias.map((c) => (
          <button key={c.id} type="button" className={`cty-chip${cat === c.id ? ' cty-chip--on' : ''}`} onClick={() => setCat(cat === c.id ? null : c.id)}>
            <CarIcon name={c.icone} size={16} /> {c.nome}
          </button>
        ))}
      </div>
      <div className="cty-chips" role="radiogroup" aria-label="Ordem">
        <button type="button" role="radio" aria-checked={ordem === 'uteis'} className={`cty-chip${ordem === 'uteis' ? ' cty-chip--on' : ''}`} onClick={() => setOrdem('uteis')}>
          Mais úteis
        </button>
        <button type="button" role="radio" aria-checked={ordem === 'novas'} className={`cty-chip${ordem === 'novas' ? ' cty-chip--on' : ''}`} onClick={() => setOrdem('novas')}>
          Novas respostas
        </button>
      </div>
      {aviso && (
        <p className="auth-success" role="status">
          {aviso}
        </p>
      )}
      {erro && (
        <p className="auth-error" role="alert">
          Não foi possível carregar agora. Confira a internet e tente de novo.
        </p>
      )}
      {!itens && !erro && <p className="home-muted">Carregando…</p>}
      {itens && lista.length === 0 && <p className="home-muted">Ainda não há respostas por aqui. Faça a sua pergunta na aba Perguntar.</p>}
      {lista.map((i) => {
        const c = i.categoria_id ? catById.get(i.categoria_id) : null
        const open = aberta === i.id
        return (
          <article key={i.id} className="car-card">
            <button type="button" className="car-card-q" aria-expanded={open} onClick={() => setAberta(open ? null : i.id)}>
              {c && <CarIcon name={c.icone} size={20} />}
              <span>{i.texto}</span>
            </button>
            {open && (
              <div className="car-card-a">
                <p className="car-answer">{i.resposta}</p>
                <p className="car-by">
                  Respondido e revisado por <strong>{i.por_nome ?? 'equipe do Círcula'}</strong>
                  {i.por_funcao ? `, ${i.por_funcao}` : ''}
                  {i.respondido_em ? ` · ${formatRelativeTime(i.respondido_em)}` : ''}
                </p>
                <Aviso />
                <div className="cty-actions">
                  <button type="button" className={`cty-btn cty-btn--small${i.meu_util ? ' cty-btn--primary' : ''}`} aria-pressed={i.meu_util} onClick={() => void util(i.id)}>
                    Foi útil · {i.util}
                  </button>
                  <button type="button" className="cty-btn cty-btn--small" onClick={() => void compartilhar(i)}>
                    Compartilhar
                  </button>
                  {c && c.cidade_categorias.length > 0 && (
                    <button type="button" className="cty-btn cty-btn--small" onClick={() => onGoCity(c.cidade_categorias)}>
                      Encontrar na minha cidade
                    </button>
                  )}
                  <button type="button" className="water-link" onClick={() => setDenuncia({ id: i.id, motivo: '' })}>
                    Denunciar
                  </button>
                </div>
                {denuncia?.id === i.id && (
                  <div className="car-report">
                    <label className="cty-field">
                      <span className="cty-label">O que há de errado com esta resposta?</span>
                      <textarea rows={3} maxLength={400} value={denuncia.motivo} onChange={(e) => setDenuncia({ id: i.id, motivo: e.target.value })} />
                    </label>
                    <div className="cty-actions">
                      <button type="button" className="water-primary" onClick={() => void enviarDenuncia()}>
                        Enviar denúncia
                      </button>
                      <button type="button" className="cty-btn" onClick={() => setDenuncia(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

function Perguntar({ categorias, tempo, onSent }: { categorias: CarroCategoria[]; tempo: string; onSent: () => void }) {
  const [texto, setTexto] = useState('')
  const [cat, setCat] = useState('')
  const [modelo, setModelo] = useState('')
  const [ano, setAno] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [anonima, setAnonima] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [parecidas, setParecidas] = useState<{ id: string; texto: string }[]>([])

  // perguntas parecidas já respondidas, enquanto digita
  useEffect(() => {
    if (texto.trim().length < 12) return
    const t = window.setTimeout(() => {
      void supabase.rpc('car_similar', { p_texto: texto }).then(({ data }) => setParecidas(((data ?? []) as { id: string; texto: string }[])))
    }, 500)
    return () => window.clearTimeout(t)
  }, [texto])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const anoNum = ano.trim() ? Number(ano) : null
    if (anoNum !== null && (!Number.isInteger(anoNum) || anoNum < 1950 || anoNum > 2100)) return setErro('Confira o ano do carro.')
    setBusy(true)
    const { error } = await supabase.rpc('car_ask', { p_texto: texto, p_categoria: cat || null, p_modelo: modelo || null, p_ano: anoNum, p_foto: foto, p_anonima: anonima })
    setBusy(false)
    if (error) {
      const code = Object.keys(ERRORS).find((k) => error.message.includes(k))
      return setErro(code ? ERRORS[code] : 'Não foi possível enviar agora. Tente de novo em instantes.')
    }
    setTexto('')
    setModelo('')
    setAno('')
    setFoto(null)
    setParecidas([])
    onSent()
  }

  const sensivel = hasSensitiveData(texto)
  return (
    <form className="car-form" onSubmit={(e) => void enviar(e)}>
      <p className="home-muted">Tempo esperado de resposta: {tempo}.</p>
      <label className="cty-field">
        <span className="cty-label">Sua pergunta</span>
        <textarea rows={5} maxLength={1000} required value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: acendeu uma luz amarela no painel do meu carro. Posso continuar dirigindo?" />
      </label>
      <p className="cty-note">Não coloque placa, CPF, telefone nem endereço. Se aparecerem, nós os removemos do texto.</p>
      {sensivel && (
        <p className="auth-error" role="alert">
          Parece que há uma placa, um telefone ou um CPF no texto. Vamos remover ao enviar, mas é melhor apagar agora.
        </p>
      )}
      {parecidas.length > 0 && (
        <div className="car-similar" role="note">
          <strong>Talvez já tenhamos respondido:</strong>
          <ul>
            {parecidas.map((p) => (
              <li key={p.id}>{p.texto}</li>
            ))}
          </ul>
          <p className="cty-note">Confira na aba Respostas antes de enviar.</p>
        </div>
      )}
      <label className="cty-field">
        <span className="cty-label">Categoria (opcional)</span>
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">A profissional escolhe</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      <div className="cty-photos">
        <label className="cty-field">
          <span className="cty-label">Modelo (opcional)</span>
          <input type="text" maxLength={60} value={modelo} onChange={(e) => setModelo(e.target.value)} />
        </label>
        <label className="cty-field">
          <span className="cty-label">Ano (opcional)</span>
          <input type="text" inputMode="numeric" maxLength={4} value={ano} onChange={(e) => setAno(e.target.value.replace(/\D/g, ''))} />
        </label>
      </div>
      <ImageField value={foto} spec="uma foto do painel ou da peça, se ajudar. Só aparece depois que a profissional aprovar." onChange={setFoto} />
      <label className="car-check">
        <input type="checkbox" checked={anonima} onChange={(e) => setAnonima(e.target.checked)} /> Perguntar sem mostrar o meu nome
      </label>
      {erro && (
        <p className="auth-error" role="alert">
          {erro}
        </p>
      )}
      <button type="submit" className="water-primary" disabled={busy || texto.trim().length < 8}>
        {busy ? 'Enviando…' : 'Enviar pergunta'}
      </button>
    </form>
  )
}

function Minhas({ refreshKey }: { refreshKey: number }) {
  const [itens, setItens] = useState<Minha[] | null>(null)
  const [erro, setErro] = useState(false)
  useEffect(() => {
    let cancelled = false
    void supabase.rpc('car_my').then(({ data, error }) => {
      if (cancelled) return
      if (error) setErro(true)
      else setItens((data ?? []) as Minha[])
    })
    return () => {
      cancelled = true
    }
  }, [refreshKey])
  return (
    <div className="car-respostas">
      {erro && (
        <p className="auth-error" role="alert">
          Não foi possível carregar agora.
        </p>
      )}
      {!itens && !erro && <p className="home-muted">Carregando…</p>}
      {itens && itens.length === 0 && <p className="home-muted">Você ainda não fez nenhuma pergunta.</p>}
      {itens?.map((i) => (
        <article key={i.id} className="car-card">
          <div className="car-card-a">
            <p>
              <strong>{i.texto}</strong>
            </p>
            <p className={`car-status car-status--${i.status}`}>{STATUS_LABEL[i.status]}</p>
            {i.motivo && (i.status === 'mais_info' || i.status === 'recusada') && <p className="home-muted">{i.motivo}</p>}
            {i.status === 'respondida' && i.resposta && (
              <>
                <p className="car-answer">{i.resposta}</p>
                <p className="car-by">
                  Respondido e revisado por <strong>{i.por_nome ?? 'equipe do Círcula'}</strong>
                  {i.por_funcao ? `, ${i.por_funcao}` : ''}
                </p>
                <Aviso />
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

export function CarroPage({ communityId, profileId, onOpenCity }: { communityId: string | null; profileId: string; onOpenCity: () => void }) {
  const { home, error, reload } = useCarroHome()
  const [tab, setTab] = useState<'livi' | 'respostas' | 'perguntar' | 'minhas'>('respostas')
  const [minhasKey, setMinhasKey] = useState(0)
  const [enviada, setEnviada] = useState(false)
  const [inicialCat] = useState<string | null>(() => takeCarroRequest())

  if (error) {
    return (
      <p className="auth-error" role="alert">
        Não foi possível carregar o Carro em Dia agora. Confira a internet e tente de novo.
      </p>
    )
  }
  if (!home) return <p className="home-muted">Carregando…</p>
  const s = home.settings

  return (
    <section className="car-page">
      <header className="car-head">
        {s.imagem && <img className="car-hero" src={s.imagem} alt={s.imagem_alt ?? ''} loading="lazy" />}
        <h2>
          <CarIcon name={s.icone} size={30} /> {s.titulo}
        </h2>
        <p className="home-muted">{s.subtitulo}</p>
      </header>

      {!home.acesso ? (
        <div className="car-locked">
          <p className="plans-text">{s.teaser}</p>
          <ul className="car-teaser" aria-label="Algumas perguntas">
            {home.teaser.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="car-price">
            Carro em Dia · <strong>R$ 5,10</strong> por mês
          </p>
          <AddonCheckout planKey={CARRO_PLAN_KEY} communityId={communityId} prices={CARRO_PRICES} owned={false} profileId={profileId} onCheckoutStarted={() => undefined} />
          <button type="button" className="water-link" onClick={() => void reload()}>
            Já paguei: atualizar
          </button>
          <Aviso />
        </div>
      ) : (
        <>
          <div className="cty-tabs" role="tablist" aria-label="Carro em Dia">
            {(
              [
                ['respostas', 'Respostas'],
                ['livi', 'Livi'],
                ['perguntar', 'Perguntar'],
                ['minhas', 'Minhas perguntas'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={`cty-tab${tab === k ? ' cty-tab--on' : ''}`} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'livi' && (
            <CarroLivi
              onGoCity={(ids) => {
                sendToCity(ids)
                onOpenCity()
              }}
            />
          )}
          {tab === 'respostas' && (
            <Respostas
              categorias={home.categorias}
              inicialCat={inicialCat}
              onGoCity={(ids) => {
                sendToCity(ids)
                onOpenCity()
              }}
            />
          )}
          {tab === 'perguntar' && (
            <>
              {enviada && (
                <p className="auth-success" role="status">
                  Pergunta enviada. Avisamos você no sino quando for respondida.
                </p>
              )}
              <Perguntar
                categorias={home.categorias}
                tempo={s.tempo_resposta}
                onSent={() => {
                  setEnviada(true)
                  setMinhasKey((n) => n + 1)
                  setTab('minhas')
                }}
              />
            </>
          )}
          {tab === 'minhas' && <Minhas refreshKey={minhasKey} />}
          {enviada && tab === 'minhas' && (
            <p className="auth-success" role="status">
              Pergunta enviada. Avisamos você no sino quando for respondida.
            </p>
          )}
          <Aviso />
        </>
      )}
    </section>
  )
}
