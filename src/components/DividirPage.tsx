import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useDividirGrupo, useDividirGrupos } from '../hooks/useDividir'
import { calcularSaldos, sugerirTransferencias, totalDoGrupo } from '../lib/dividir'
import type { DivDespesa } from '../lib/dividir'
import { formatBrl, parseBrl } from '../lib/financas'
import { enviarCartao } from '../lib/racheiCard'

// Dividir: quem pagou o quê, quem participou, e quem deve pagar quem (o mínimo de transferências).
// Só registro e conta: o app não move dinheiro. "Pago" é uma marcação feita pela dona do grupo.

const hoje = () => new Date().toISOString().slice(0, 10)

function FolhaDespesa({
  ativos,
  todos,
  editando,
  onClose,
  onSave,
}: {
  ativos: { id: string; nome: string }[]
  todos: { id: string; nome: string }[]
  editando: DivDespesa | null
  onClose: () => void
  onSave: (d: Omit<DivDespesa, 'id'>, id?: string) => Promise<string | null>
}) {
  const [descricao, setDescricao] = useState(editando?.descricao ?? '')
  const [valor, setValor] = useState(editando ? (editando.valor_centavos / 100).toFixed(2).replace('.', ',') : '')
  const [pagador, setPagador] = useState(editando?.pagador_id ?? ativos[0]?.id ?? '')
  const [quem, setQuem] = useState<string[]>(editando?.participantes ?? ativos.map((a) => a.id))
  const [erro, setErro] = useState<string | null>(null)
  const lista = editando ? todos : ativos
  async function submit(ev: FormEvent) {
    ev.preventDefault()
    const centavos = parseBrl(valor)
    if (!descricao.trim()) return setErro('Diga o que foi pago.')
    if (!centavos) return setErro('Informe um valor maior que zero.')
    if (!pagador) return setErro('Escolha quem pagou.')
    if (quem.length === 0) return setErro('Marque quem participou desta despesa.')
    const r = await onSave({ descricao: descricao.trim(), valor_centavos: centavos, pagador_id: pagador, participantes: quem, data: editando?.data ?? hoje() }, editando?.id)
    if (r) setErro(r)
    else onClose()
  }
  return (
    <div className="fin-sheet-backdrop" role="presentation" onClick={onClose}>
      <form className="fin-sheet" role="dialog" aria-modal="true" aria-label={editando ? 'Editar despesa' : 'Nova despesa'} onClick={(x) => x.stopPropagation()} onSubmit={(x) => void submit(x)}>
        <h3 className="fin-sheet-titulo">{editando ? 'Editar despesa' : 'Nova despesa'}</h3>
        <label className="fin-campo">
          <span>O que foi pago?</span>
          <input type="text" maxLength={60} value={descricao} onChange={(x) => setDescricao(x.target.value)} autoFocus />
        </label>
        <label className="fin-campo">
          <span>Valor</span>
          <input type="text" inputMode="decimal" placeholder="0,00" value={valor} onChange={(x) => setValor(x.target.value)} />
        </label>
        <p className="home-muted">Quem pagou:</p>
        <div className="fin-chips" role="radiogroup" aria-label="Quem pagou">
          {lista.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={pagador === p.id} className={`fin-chip${pagador === p.id ? ' fin-chip--on' : ''}`} onClick={() => setPagador(p.id)}>
              {p.nome}
            </button>
          ))}
        </div>
        <p className="home-muted">Quem participou (a conta é dividida igualmente entre os marcados):</p>
        <div className="fin-chips" role="group" aria-label="Quem participou">
          {lista.map((p) => {
            const on = quem.includes(p.id)
            return (
              <button key={p.id} type="button" aria-pressed={on} className={`fin-chip${on ? ' fin-chip--on' : ''}`} onClick={() => setQuem(on ? quem.filter((q) => q !== p.id) : [...quem, p.id])}>
                {p.nome}
              </button>
            )
          })}
        </div>
        {erro && (
          <p className="auth-error" role="alert">
            {erro}
          </p>
        )}
        <div className="fin-sheet-acoes">
          <button type="submit" className="water-primary">
            Salvar
          </button>
          <button type="button" className="cty-btn" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

function Grupo({ id, nome, onVoltar }: { id: string; nome: string; onVoltar: () => void }) {
  const g = useDividirGrupo(id)
  const [novo, setNovo] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{ editando: DivDespesa | null } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const ps = useMemo(() => g.participantes ?? [], [g.participantes])
  const ativos = ps.filter((p) => p.ativo)
  const nomeDe = useMemo(() => new Map(ps.map((p) => [p.id, p.nome])), [ps])
  const saldos = useMemo(() => calcularSaldos(ps, g.despesas, g.acertos), [ps, g.despesas, g.acertos])
  const transferencias = useMemo(() => sugerirTransferencias(saldos), [saldos])

  if (g.error) {
    return (
      <p className="auth-error" role="alert">
        {g.error}
      </p>
    )
  }
  if (!g.participantes) return <p className="home-muted">Carregando…</p>

  async function addParticipante(ev: FormEvent) {
    ev.preventDefault()
    if (!novo.trim()) return
    const r = await g.adicionarParticipante(novo)
    setAviso(r)
    if (!r) setNovo('')
  }

  async function compartilhar() {
    const linhas =
      transferencias.length > 0
        ? transferencias.map((t) => ({ nome: nomeDe.get(t.de) ?? '?', valor: formatBrl(t.valor), detalhe: `paga para ${nomeDe.get(t.para) ?? '?'}` }))
        : saldos.map((s) => ({ nome: nomeDe.get(s.id) ?? '?', valor: formatBrl(s.pagou), detalhe: 'está quite' }))
    const res = await enviarCartao({
      titulo: nome,
      subtitulo: transferencias.length > 0 ? 'Como acertar' : 'Tudo certo, ninguém deve nada',
      totalTexto: `Total gasto ${formatBrl(totalDoGrupo(g.despesas))}`,
      linhas,
    })
    setMsg(res === 'baixado' ? 'Imagem salva no aparelho. Anexe na conversa do WhatsApp.' : null)
  }

  return (
    <div className="fin-aba">
      <button type="button" className="cty-btn" onClick={onVoltar}>
        ‹ Meus grupos
      </button>
      <h3 className="fin-subtitulo">{nome}</h3>
      <div className="fin-cartao fin-cartao--fino">
        <span>Total gasto</span>
        <strong>{formatBrl(totalDoGrupo(g.despesas))}</strong>
      </div>
      {aviso && (
        <p className="auth-error" role="alert">
          {aviso}
        </p>
      )}
      {msg && (
        <p className="home-muted" role="status">
          {msg}
        </p>
      )}

      <h3 className="fin-subtitulo">Participantes</h3>
      <ul className="fin-lista">
        {ps.map((p) => (
          <li key={p.id} className="fin-item">
            <span className="fin-item-texto">
              <strong>{p.nome}</strong>
              {!p.ativo && <small>Saiu do grupo (o histórico fica)</small>}
            </span>
            {p.ativo ? (
              <button type="button" className="fin-icone-btn" aria-label={`Remover ${p.nome}`} onClick={() => void g.removerParticipante(p.id).then(setAviso)}>
                ×
              </button>
            ) : (
              <button type="button" className="cty-btn" onClick={() => void g.reativarParticipante(p.id).then(setAviso)}>
                Voltar
              </button>
            )}
          </li>
        ))}
      </ul>
      <form className="fin-campo" onSubmit={(x) => void addParticipante(x)}>
        <span>Adicionar participante</span>
        <input type="text" maxLength={30} value={novo} onChange={(x) => setNovo(x.target.value)} placeholder="Nome" />
        <button type="submit" className="water-primary">
          Adicionar
        </button>
      </form>

      <h3 className="fin-subtitulo">Despesas</h3>
      <button type="button" className="water-primary" disabled={ativos.length === 0} onClick={() => setSheet({ editando: null })}>
        Nova despesa
      </button>
      {ativos.length === 0 && <p className="home-muted">Adicione pelo menos um participante para lançar despesas.</p>}
      <ul className="fin-lista">
        {g.despesas.map((d) => (
          <li key={d.id} className="fin-item">
            <span className="fin-item-texto">
              <strong>{d.descricao}</strong>
              <small>
                {nomeDe.get(d.pagador_id) ?? '?'} pagou · {d.participantes.length} {d.participantes.length === 1 ? 'pessoa' : 'pessoas'}
              </small>
            </span>
            <span className="fin-item-valor">{formatBrl(d.valor_centavos)}</span>
            <button type="button" className="fin-icone-btn" aria-label={`Editar ${d.descricao}`} onClick={() => setSheet({ editando: d })}>
              ✎
            </button>
            <button type="button" className="fin-icone-btn" aria-label={`Apagar ${d.descricao}`} onClick={() => void g.apagarDespesa(d.id).then(setAviso)}>
              ×
            </button>
          </li>
        ))}
      </ul>

      <h3 className="fin-subtitulo">Resultado</h3>
      {g.despesas.length === 0 ? (
        <p className="home-muted">Quando houver despesas, o resultado aparece aqui.</p>
      ) : (
        <>
          <ul className="fin-lista">
            {saldos.map((s) => (
              <li key={s.id} className="fin-item">
                <span className="fin-item-texto">
                  <strong>{nomeDe.get(s.id)}</strong>
                  <small>
                    Pagou {formatBrl(s.pagou)} · deveria ter pago {formatBrl(s.devia)}
                  </small>
                </span>
                <span className="fin-item-valor" style={{ color: s.saldo < 0 ? '#b3382c' : s.saldo > 0 ? '#2f7a4a' : undefined }}>
                  {s.saldo > 0 ? `Recebe ${formatBrl(s.saldo)}` : s.saldo < 0 ? `Paga ${formatBrl(-s.saldo)}` : 'Quite'}
                </span>
              </li>
            ))}
          </ul>
          <h3 className="fin-subtitulo">Como acertar</h3>
          {transferencias.length === 0 ? (
            <p className="home-muted">Tudo certo: ninguém deve nada.</p>
          ) : (
            <ul className="fin-lista">
              {transferencias.map((t) => (
                <li key={`${t.de}-${t.para}`} className="fin-item">
                  <span className="fin-item-texto">
                    <strong>
                      {nomeDe.get(t.de)} paga {formatBrl(t.valor)}
                    </strong>
                    <small>para {nomeDe.get(t.para)}</small>
                  </span>
                  <button type="button" className="water-primary" onClick={() => void g.marcarPago(t.de, t.para, t.valor).then(setAviso)}>
                    Marcar como pago
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="cty-btn" onClick={() => void compartilhar()}>
            Enviar cartão no WhatsApp
          </button>
        </>
      )}

      {g.acertos.length > 0 && (
        <>
          <h3 className="fin-subtitulo">Pagamentos feitos</h3>
          <ul className="fin-lista">
            {g.acertos.map((a) => (
              <li key={a.id} className="fin-item">
                <span className="fin-item-texto">
                  <strong>
                    {nomeDe.get(a.de_id)} pagou {formatBrl(a.valor_centavos)}
                  </strong>
                  <small>
                    para {nomeDe.get(a.para_id)} · {new Date(a.feito_em).toLocaleDateString('pt-BR')}
                  </small>
                </span>
                <button type="button" className="fin-icone-btn" aria-label="Desfazer pagamento" onClick={() => void g.desfazerPagamento(a.id).then(setAviso)}>
                  ↺
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {sheet && <FolhaDespesa ativos={ativos} todos={ps} editando={sheet.editando} onClose={() => setSheet(null)} onSave={g.salvarDespesa} />}
    </div>
  )
}

export function DividirPage() {
  const { grupos, error, criar, apagar } = useDividirGrupos()
  const [nome, setNome] = useState('')
  const [aberto, setAberto] = useState<{ id: string; nome: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [apagando, setApagando] = useState<string | null>(null)

  if (error) {
    return (
      <p className="auth-error" role="alert">
        {error}
      </p>
    )
  }
  if (!grupos) return <p className="home-muted">Carregando…</p>
  if (aberto) return <Grupo id={aberto.id} nome={aberto.nome} onVoltar={() => setAberto(null)} />

  async function novoGrupo(ev: FormEvent) {
    ev.preventDefault()
    if (!nome.trim()) return setAviso('Dê um nome ao grupo, por exemplo "Viagem para a praia".')
    const r = await criar(nome)
    setAviso(r)
    if (!r) setNome('')
  }

  return (
    <div className="fin-aba">
      <p className="home-muted">Viagem, churrasco, festa: lance quem pagou o quê e o Círcula calcula quem deve pagar quem, com o mínimo de transferências.</p>
      <form className="fin-campo" onSubmit={(x) => void novoGrupo(x)}>
        <span>Novo grupo</span>
        <input type="text" maxLength={40} value={nome} onChange={(x) => setNome(x.target.value)} placeholder="Viagem para a praia" />
        <button type="submit" className="water-primary">
          Criar grupo
        </button>
      </form>
      {aviso && (
        <p className="auth-error" role="alert">
          {aviso}
        </p>
      )}
      <ul className="fin-lista">
        {grupos.length === 0 && <li className="home-muted">Nenhum grupo ainda.</li>}
        {grupos.map((g) => (
          <li key={g.id} className="fin-item">
            <button type="button" className="fin-item fin-item--botao" onClick={() => setAberto(g)}>
              <span className="fin-item-texto">
                <strong>{g.nome}</strong>
              </span>
            </button>
            {apagando === g.id ? (
              <button
                type="button"
                className="question-delete-button"
                onClick={() =>
                  void apagar(g.id).then((r) => {
                    setAviso(r)
                    setApagando(null)
                  })
                }
              >
                Apagar tudo
              </button>
            ) : (
              <button type="button" className="fin-icone-btn" aria-label={`Apagar o grupo ${g.nome}`} onClick={() => setApagando(g.id)}>
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
