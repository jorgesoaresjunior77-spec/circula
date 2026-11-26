import { useMemo, useState } from 'react'
import { calcularRacha } from '../lib/rachei'
import { desenharCartao, enviarCartao } from '../lib/racheiCard'
import type { CartaoRachei } from '../lib/racheiCard'
import { formatBrl, parseBrl } from '../lib/financas'
import { DividirPage } from './DividirPage'

// Rachei $: a conta do restaurante, do churrasco ou da viagem dividida sem briga.
// Calculadora rápida (sem cadastro) + grupos com várias despesas. O app só calcula e monta o cartão
// de envio: nunca move dinheiro.

type Aba = 'calculadora' | 'grupos'
const GORJETAS = [0, 5, 10, 12]

interface Pessoa {
  id: string
  nome: string
}

let seq = 0
const novaPessoa = (nome = ''): Pessoa => ({ id: `p${++seq}`, nome })

function Calculadora() {
  const [conta, setConta] = useState('')
  const [gorjeta, setGorjeta] = useState(0)
  const [titulo, setTitulo] = useState('')
  const [pessoas, setPessoas] = useState<Pessoa[]>(() => [novaPessoa(), novaPessoa()])
  const [pagador, setPagador] = useState<string>('')
  const [pix, setPix] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)

  const nomeDe = (p: Pessoa, i: number) => p.nome.trim() || `Pessoa ${i + 1}`
  const nomeados = useMemo(() => pessoas.map((p, i) => ({ id: p.id, nome: nomeDe(p, i) })), [pessoas])
  const centavos = parseBrl(conta) ?? 0
  const r = useMemo(() => calcularRacha(centavos, gorjeta, nomeados, pagador || null), [centavos, gorjeta, nomeados, pagador])
  const pronto = centavos > 0 && nomeados.length >= 2

  const cartao: CartaoRachei | null = useMemo(() => {
    if (!pronto) return null
    const quem = pagador ? nomeados.find((n) => n.id === pagador)?.nome : null
    return {
      titulo: titulo.trim() || 'Nossa conta',
      subtitulo: gorjeta > 0 ? `com ${gorjeta}% de serviço` : undefined,
      totalTexto: `Total ${formatBrl(r.total)} · ${nomeados.length} pessoas`,
      linhas: r.partes.map((p) => ({
        nome: p.nome,
        valor: formatBrl(p.valor),
        detalhe: quem ? (p.id === pagador ? 'pagou a conta' : `paga para ${quem}`) : undefined,
      })),
      rodape: pix.trim() ? `Pix: ${pix.trim()}` : undefined,
    }
  }, [pronto, titulo, gorjeta, r, nomeados, pagador, pix])

  const previa = useMemo(() => (cartao ? (desenharCartao(cartao)?.toDataURL('image/png') ?? null) : null), [cartao])

  async function enviar() {
    if (!cartao) return
    const res = await enviarCartao(cartao)
    setAviso(res === 'baixado' ? 'Imagem salva no aparelho. Anexe na conversa do WhatsApp.' : null)
  }

  return (
    <div className="fin-aba">
      <p className="home-muted">Digite a conta, marque quem estava e pronto: cada uma vê quanto paga. Depois é só mandar o cartão no WhatsApp.</p>
      <label className="fin-campo">
        <span>Nome do racha (opcional)</span>
        <input type="text" maxLength={40} value={titulo} onChange={(x) => setTitulo(x.target.value)} placeholder="Jantar de sábado" />
      </label>
      <label className="fin-campo">
        <span>Valor da conta</span>
        <input type="text" inputMode="decimal" placeholder="0,00" value={conta} onChange={(x) => setConta(x.target.value)} />
      </label>
      <p className="home-muted">Serviço / gorjeta:</p>
      <div className="fin-chips" role="radiogroup" aria-label="Serviço">
        {GORJETAS.map((g) => (
          <button key={g} type="button" role="radio" aria-checked={gorjeta === g} className={`fin-chip${gorjeta === g ? ' fin-chip--on' : ''}`} onClick={() => setGorjeta(g)}>
            {g === 0 ? 'Sem' : `${g}%`}
          </button>
        ))}
      </div>

      <h3 className="fin-subtitulo">Quem dividiu</h3>
      <ul className="fin-lista">
        {pessoas.map((p, i) => (
          <li key={p.id} className="fin-item">
            <input
              type="text"
              maxLength={24}
              aria-label={`Nome da pessoa ${i + 1}`}
              placeholder={`Pessoa ${i + 1}`}
              value={p.nome}
              onChange={(x) => setPessoas(pessoas.map((q) => (q.id === p.id ? { ...q, nome: x.target.value } : q)))}
            />
            {pessoas.length > 2 && (
              <button type="button" className="fin-icone-btn" aria-label={`Remover ${nomeDe(p, i)}`} onClick={() => setPessoas(pessoas.filter((q) => q.id !== p.id))}>
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="cty-btn" disabled={pessoas.length >= 20} onClick={() => setPessoas([...pessoas, novaPessoa()])}>
        + Adicionar pessoa
      </button>

      <p className="home-muted">Alguém pagou a conta toda? (opcional)</p>
      <div className="fin-chips" role="radiogroup" aria-label="Quem pagou a conta">
        <button type="button" role="radio" aria-checked={pagador === ''} className={`fin-chip${pagador === '' ? ' fin-chip--on' : ''}`} onClick={() => setPagador('')}>
          Ninguém
        </button>
        {nomeados.map((n) => (
          <button key={n.id} type="button" role="radio" aria-checked={pagador === n.id} className={`fin-chip${pagador === n.id ? ' fin-chip--on' : ''}`} onClick={() => setPagador(n.id)}>
            {n.nome}
          </button>
        ))}
      </div>
      {pagador && (
        <label className="fin-campo">
          <span>Chave Pix para receber (opcional, vai no cartão)</span>
          <input type="text" maxLength={60} value={pix} onChange={(x) => setPix(x.target.value)} placeholder="e-mail, telefone ou chave aleatória" />
        </label>
      )}

      <h3 className="fin-subtitulo">Resultado</h3>
      {!pronto ? (
        <p className="home-muted">Informe o valor da conta e pelo menos duas pessoas.</p>
      ) : (
        <>
          <div className="fin-cartao fin-cartao--fino">
            <span>Total{gorjeta > 0 ? ` com ${gorjeta}%` : ''}</span>
            <strong>{formatBrl(r.total)}</strong>
          </div>
          <ul className="fin-lista">
            {r.partes.map((p) => (
              <li key={p.id} className="fin-item">
                <span className="fin-item-texto">
                  <strong>{p.nome}</strong>
                  {pagador && <small>{p.id === pagador ? 'pagou a conta' : `passa para ${nomeados.find((n) => n.id === pagador)?.nome}`}</small>}
                </span>
                <span className="fin-item-valor">{formatBrl(p.valor)}</span>
              </li>
            ))}
          </ul>
          {previa && <img className="rachei-previa" src={previa} alt="Prévia do cartão do Rachei $" />}
          <button type="button" className="water-primary" onClick={() => void enviar()}>
            Enviar no WhatsApp
          </button>
          {aviso && (
            <p className="home-muted" role="status">
              {aviso}
            </p>
          )}
        </>
      )}
    </div>
  )
}

export function RacheiPage() {
  const [aba, setAba] = useState<Aba>('calculadora')
  return (
    <section className="fin-page rachei-page">
      <header className="rachei-head">
        <h2 className="rachei-titulo">Rachei $</h2>
        <p>A conta dividida sem confusão.</p>
      </header>
      <div className="fin-abas" role="tablist" aria-label="Rachei $">
        <button type="button" role="tab" aria-selected={aba === 'calculadora'} className={`fin-aba-btn${aba === 'calculadora' ? ' fin-aba-btn--on' : ''}`} onClick={() => setAba('calculadora')}>
          Calculadora
        </button>
        <button type="button" role="tab" aria-selected={aba === 'grupos'} className={`fin-aba-btn${aba === 'grupos' ? ' fin-aba-btn--on' : ''}`} onClick={() => setAba('grupos')}>
          Grupos
        </button>
      </div>
      {aba === 'calculadora' ? <Calculadora /> : <DividirPage />}
    </section>
  )
}
