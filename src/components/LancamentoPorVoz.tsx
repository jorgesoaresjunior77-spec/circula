import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { interpretarFala } from '../lib/falaFinanceira'
import { formatBrl, parseBrl } from '../lib/financas'
import type { FinCategoria, FinTipo } from '../lib/financas'
import type { NovoLancamento } from '../hooks/useFinancas'

// Lançamento por voz: a pessoa fala, a Livi transcreve e propõe (tipo, valor, categoria, data, descrição).
// NADA é salvo sem a confirmação dela, e tudo pode ser corrigido antes. Usa o reconhecimento de voz do aparelho,
// que pede permissão do microfone; sem suporte, dá para escrever a frase.

interface RecLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type RecCtor = new () => RecLike

function getRec(): RecCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const TIPOS: { id: FinTipo; label: string }[] = [
  { id: 'receita', label: 'Receita' },
  { id: 'gasto', label: 'Gasto' },
  { id: 'investimento', label: 'Investimento' },
]

interface Proposta {
  tipo: FinTipo
  valor: string
  categoria: string
  data: string
  descricao: string
}

export function LancamentoPorVoz({
  categorias,
  todas,
  onSalvar,
}: {
  categorias: (tipo: FinTipo) => FinCategoria[]
  todas: FinCategoria[]
  onSalvar: (rows: NovoLancamento[]) => Promise<string | null>
}) {
  const [aberto, setAberto] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  const [frase, setFrase] = useState('')
  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const rec = useRef<RecLike | null>(null)
  const suporta = typeof window !== 'undefined' && !!getRec()

  useEffect(() => () => rec.current?.stop(), [])

  function entender(texto: string) {
    const f = interpretarFala(texto, todas.filter((c) => !c.padrao))
    if (!f.valorCentavos) {
      setProposta(null)
      return setErro('Não consegui entender o valor. Tente de novo, por exemplo: "gastei 85 reais no mercado".')
    }
    setErro(null)
    const tipo = f.tipo ?? 'gasto'
    const cats = categorias(tipo)
    setProposta({
      tipo,
      valor: (f.valorCentavos / 100).toFixed(2).replace('.', ','),
      categoria: f.categoria && cats.some((c) => c.id === f.categoria) ? f.categoria : (cats[0]?.id ?? ''),
      data: f.data,
      descricao: f.descricao,
    })
  }

  function ouvir() {
    const Ctor = getRec()
    if (!Ctor) return
    setErro(null)
    const r = new Ctor()
    r.lang = 'pt-BR'
    r.interimResults = false
    r.maxAlternatives = 1
    r.onresult = (e) => {
      const texto = e.results[0]?.[0]?.transcript ?? ''
      setFrase(texto)
      entender(texto)
    }
    r.onerror = (e) => {
      setOuvindo(false)
      setErro(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'O microfone está bloqueado. Libere a permissão do microfone nas configurações do aparelho, ou escreva a frase abaixo.'
          : e.error === 'no-speech'
            ? 'Não ouvi nada. Toque no microfone e fale de novo.'
            : 'Não foi possível ouvir agora. Você pode escrever a frase abaixo.',
      )
    }
    r.onend = () => setOuvindo(false)
    rec.current = r
    setOuvindo(true)
    r.start()
  }

  function mudarTipo(tipo: FinTipo) {
    if (!proposta) return
    const cats = categorias(tipo)
    setProposta({ ...proposta, tipo, categoria: cats.some((c) => c.id === proposta.categoria) ? proposta.categoria : (cats[0]?.id ?? '') })
  }

  async function confirmar(ev: FormEvent) {
    ev.preventDefault()
    if (!proposta) return
    const centavos = parseBrl(proposta.valor)
    if (!centavos) return setErro('Informe um valor maior que zero.')
    if (!proposta.categoria) return setErro('Escolha uma categoria.')
    setBusy(true)
    const r = await onSalvar([
      {
        tipo: proposta.tipo,
        categoria: proposta.categoria,
        valor_centavos: centavos,
        data: proposta.data,
        observacao: proposta.descricao.trim().slice(0, 200) || null,
        movimento: proposta.tipo === 'investimento' ? 'aplicar' : null,
        parcela_grupo: null,
        parcela_n: null,
        parcela_total: null,
      },
    ])
    setBusy(false)
    if (r) return setErro(r)
    setProposta(null)
    setFrase('')
    setAberto(false)
  }

  if (!aberto) {
    return (
      <button type="button" className="fin-voz-abrir" onClick={() => setAberto(true)} aria-label="Lançar falando com a Livi">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        <span>Falar um lançamento</span>
      </button>
    )
  }

  const cats = proposta ? categorias(proposta.tipo) : []
  return (
    <section className="fin-voz" aria-label="Lançamento por voz">
      <p className="fin-voz-fala">
        <strong>Livi:</strong> fale como se estivesse conversando, por exemplo "hoje gastei 85 reais no supermercado".
      </p>
      <div className="fin-voz-acoes">
        {suporta && (
          <button type="button" className={`fin-voz-mic${ouvindo ? ' fin-voz-mic--on' : ''}`} onClick={ouvindo ? () => rec.current?.stop() : ouvir} aria-pressed={ouvindo} aria-label={ouvindo ? 'Parar de ouvir' : 'Começar a falar'}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
        )}
        <span className="home-muted" role="status">
          {ouvindo ? 'Ouvindo…' : suporta ? 'Toque no microfone e fale.' : 'Seu aparelho não tem reconhecimento de voz: escreva a frase.'}
        </span>
      </div>
      <form
        className="fin-campo"
        onSubmit={(ev) => {
          ev.preventDefault()
          if (frase.trim()) entender(frase)
        }}
      >
        <span>{suporta ? 'Ou escreva a frase' : 'Frase'}</span>
        <input type="text" maxLength={200} value={frase} onChange={(x) => setFrase(x.target.value)} placeholder="Recebi 250 reais de uma consulta" />
        <button type="submit" className="cty-btn">
          Entender
        </button>
      </form>
      {erro && (
        <p className="auth-error" role="alert">
          {erro}
        </p>
      )}
      {proposta && (
        <form className="fin-voz-previa" onSubmit={(x) => void confirmar(x)} aria-label="Confira o lançamento">
          <p className="fin-previa">
            <strong>Confira antes de salvar:</strong> {proposta.tipo === 'receita' ? 'receita' : proposta.tipo === 'gasto' ? 'gasto' : 'investimento'} de {formatBrl(parseBrl(proposta.valor) ?? 0)}
          </p>
          <div className="fin-chips" role="radiogroup" aria-label="Tipo">
            {TIPOS.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={proposta.tipo === t.id} className={`fin-chip${proposta.tipo === t.id ? ' fin-chip--on' : ''}`} onClick={() => mudarTipo(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <label className="fin-campo">
            <span>Valor</span>
            <input type="text" inputMode="decimal" value={proposta.valor} onChange={(x) => setProposta({ ...proposta, valor: x.target.value })} />
          </label>
          <div className="fin-chips" role="radiogroup" aria-label="Categoria">
            {cats.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={proposta.categoria === c.id} className={`fin-chip${proposta.categoria === c.id ? ' fin-chip--on' : ''}`} onClick={() => setProposta({ ...proposta, categoria: c.id })}>
                {c.nome}
              </button>
            ))}
          </div>
          <label className="fin-campo">
            <span>Data</span>
            <input type="date" value={proposta.data} onChange={(x) => setProposta({ ...proposta, data: x.target.value })} />
          </label>
          <label className="fin-campo">
            <span>Descrição</span>
            <input type="text" maxLength={200} value={proposta.descricao} onChange={(x) => setProposta({ ...proposta, descricao: x.target.value })} />
          </label>
          <div className="fin-sheet-acoes">
            <button type="submit" className="water-primary" disabled={busy}>
              {busy ? 'Salvando…' : 'Confirmar e salvar'}
            </button>
          </div>
        </form>
      )}
      <button
        type="button"
        className="cty-btn"
        onClick={() => {
          rec.current?.stop()
          setAberto(false)
          setProposta(null)
          setErro(null)
        }}
      >
        Fechar
      </button>
    </section>
  )
}
