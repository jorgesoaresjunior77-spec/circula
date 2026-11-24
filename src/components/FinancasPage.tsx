import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useFinancas } from '../hooks/useFinancas'
import type { NovoLancamento } from '../hooks/useFinancas'
import { useRobo } from '../hooks/useRobo'
import {
  FALAS,
  FALA_INVESTIU,
  FALA_VAZIO,
  acumuladoInvestido,
  chaveAtual,
  chaveMes,
  dataComDia,
  datasDasParcelas,
  diaPadrao,
  dividirParcelas,
  formatBrl,
  historico,
  nomeMes,
  ordenarPorDia,
  parcelasFuturas,
  parseBrl,
  reacaoDoLancamento,
  resumoDoMes,
  somarMeses,
  totaisPorCategoria,
} from '../lib/financas'
import type { FinCategoria, FinLancamento, FinTipo, RoboFinEstado } from '../lib/financas'
import { RoboGuia } from './RoboGuia'
import type { RoboCena } from './RoboGuia'
import { FIN_ICON_PICKER, FinIcon } from './FinIcon'
import { Barras, COR_GASTO, COR_INVEST, COR_RECEITA, Donut, Ondas } from './FinCharts'

// Finanças: registro pessoal de receitas, gastos e investimentos. Só registra e mostra números:
// nada de recomendar onde investir nem de prometer rendimento. Tudo é privado (cada pessoa só vê o que é seu).

type Aba = 'resumo' | 'receitas' | 'gastos' | 'investir' | 'historico'
const ABAS: { key: Aba; label: string }[] = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'receitas', label: 'Receitas' },
  { key: 'gastos', label: 'Gastos' },
  { key: 'investir', label: 'Investir' },
  { key: 'historico', label: 'Histórico' },
]
const TIPO_DA_ABA: Record<'receitas' | 'gastos' | 'investir', FinTipo> = { receitas: 'receita', gastos: 'gasto', investir: 'investimento' }
const ROTULO_DIA: Record<FinTipo, string> = { receita: 'Dia em que recebeu', gasto: 'Dia do pagamento ou vencimento', investimento: 'Dia' }

const CENA: Record<RoboFinEstado, RoboCena> = { repouso: 'neutro', 'repouso-devendo': 'pensando', feliz: 'feliz', triste: 'pedindo', devendo: 'oops' }
const REACAO_MS = 2500
const SEM_LANCAMENTOS: FinLancamento[] = []

// ---------------------------------------------------------------- robô
function FinRobo({ estado, fala, vazio, onToque }: { estado: RoboFinEstado; fala: string; vazio: boolean; onToque: () => void }) {
  const { mudo, alternarMudo } = useRobo()
  const texto = estado === 'repouso' && vazio ? FALA_VAZIO : fala
  return (
    <section className={`fin-robo fin-robo--${estado}`} aria-label="Círculo Robô">
      <button type="button" className="fin-robo-corpo" onClick={onToque} aria-label="Círculo Robô. Toque para ouvir o robô">
        <RoboGuia cena={CENA[estado]} tamanho={92} mudo />
        {estado === 'devendo' && (
          <span className="fin-robo-selo" aria-hidden="true">
            !
          </span>
        )}
      </button>
      <div className="fin-robo-lado">
        <p className="fin-robo-balao" aria-live="polite">
          {texto}
        </p>
        <button type="button" className="fin-robo-som" aria-pressed={!mudo} onClick={alternarMudo}>
          {mudo ? 'Som desligado · ligar' : 'Som ligado · desligar'}
        </button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- folha de lançamento
interface Sheet {
  tipo: FinTipo
  categoria: string
  editando: FinLancamento | null
}

function FolhaLancamento({
  sheet,
  mes,
  categorias,
  onClose,
  onSave,
}: {
  sheet: Sheet
  mes: string
  categorias: FinCategoria[]
  onClose: () => void
  onSave: (rows: NovoLancamento[], edit: { id: string; patch: Partial<NovoLancamento> } | null) => Promise<string | null>
}) {
  const e = sheet.editando
  const [categoria, setCategoria] = useState(sheet.categoria)
  const [valor, setValor] = useState(e ? (e.valor_centavos / 100).toFixed(2).replace('.', ',') : '')
  const [dia, setDia] = useState(String(e ? Number(e.data.slice(8, 10)) : diaPadrao(mes)))
  const [obs, setObs] = useState(e?.observacao ?? '')
  const [movimento, setMovimento] = useState<'aplicar' | 'resgatar'>(e?.movimento ?? 'aplicar')
  const [parcelada, setParcelada] = useState(false)
  const [nParcelas, setNParcelas] = useState('3')
  const [inicio, setInicio] = useState<'este' | 'proximo'>('este')
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const cat = categorias.find((c) => c.id === categoria)
  const centavos = parseBrl(valor)
  const n = Number(nParcelas)
  const nOk = Number.isInteger(n) && n >= 2 && n <= 48
  const previa = parcelada && centavos && nOk ? dividirParcelas(centavos, n) : null

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    setErro(null)
    if (!centavos) return setErro('Informe um valor maior que zero.')
    const d = Number(dia)
    if (!Number.isInteger(d) || d < 1 || d > 31) return setErro('O dia precisa ser de 1 a 31.')
    const [ano, mm] = (e ? chaveMes(e.data) : mes).split('-').map(Number)
    const observacao = obs.trim() || null
    const mov = sheet.tipo === 'investimento' ? movimento : null
    setBusy(true)
    let r: string | null
    if (e) {
      r = await onSave([], { id: e.id, patch: { categoria, valor_centavos: centavos, data: dataComDia(ano, mm, d), observacao, movimento: mov } })
    } else if (parcelada && sheet.tipo === 'gasto') {
      if (!nOk) {
        setBusy(false)
        return setErro('O número de parcelas vai de 2 a 48.')
      }
      const grupo = crypto.randomUUID()
      const valores = dividirParcelas(centavos, n)
      const datas = datasDasParcelas(inicio === 'este' ? mes : somarMeses(mes, 1), d, n)
      r = await onSave(
        valores.map((v, i) => ({ tipo: 'gasto', categoria, valor_centavos: v, data: datas[i], observacao, movimento: null, parcela_grupo: grupo, parcela_n: i + 1, parcela_total: n })),
        null,
      )
    } else {
      r = await onSave([{ tipo: sheet.tipo, categoria, valor_centavos: centavos, data: dataComDia(ano, mm, d), observacao, movimento: mov, parcela_grupo: null, parcela_n: null, parcela_total: null }], null)
    }
    setBusy(false)
    if (r) setErro(r)
    else onClose()
  }

  return (
    <div className="fin-sheet-backdrop" role="presentation" onClick={onClose}>
      <form className="fin-sheet" role="dialog" aria-modal="true" aria-label={e ? 'Editar lançamento' : 'Novo lançamento'} onClick={(x) => x.stopPropagation()} onSubmit={(x) => void submit(x)}>
        <h3 className="fin-sheet-titulo">
          {cat && <FinIcon name={cat.icone} size={26} />} {e ? 'Editar' : cat?.nome}
        </h3>
        {e?.parcela_grupo && <p className="fin-aviso">Esta edição vale só para esta parcela ({e.parcela_n}/{e.parcela_total}).</p>}
        {e && (
          <div className="fin-chips" role="radiogroup" aria-label="Categoria">
            {categorias.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={categoria === c.id} className={`fin-chip${categoria === c.id ? ' fin-chip--on' : ''}`} onClick={() => setCategoria(c.id)}>
                <FinIcon name={c.icone} size={18} /> {c.nome}
              </button>
            ))}
          </div>
        )}
        {sheet.tipo === 'investimento' && (
          <div className="fin-chips" role="radiogroup" aria-label="Movimento">
            {(['aplicar', 'resgatar'] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={movimento === m} className={`fin-chip${movimento === m ? ' fin-chip--on' : ''}`} onClick={() => setMovimento(m)}>
                {m === 'aplicar' ? 'Aplicar' : 'Resgatar'}
              </button>
            ))}
          </div>
        )}
        <label className="fin-campo">
          <span>{parcelada && !e ? 'Valor total' : 'Valor'}</span>
          <input type="text" inputMode="decimal" autoComplete="off" placeholder="0,00" value={valor} onChange={(x) => setValor(x.target.value)} autoFocus />
        </label>
        <label className="fin-campo">
          <span>{ROTULO_DIA[sheet.tipo]}</span>
          <input type="text" inputMode="numeric" maxLength={2} value={dia} onChange={(x) => setDia(x.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="fin-campo">
          <span>Observação (opcional)</span>
          <input type="text" maxLength={200} value={obs} onChange={(x) => setObs(x.target.value)} />
        </label>
        {sheet.tipo === 'gasto' && !e && (
          <>
            <label className="fin-check">
              <input type="checkbox" checked={parcelada} onChange={(x) => setParcelada(x.target.checked)} /> Compra parcelada
            </label>
            {parcelada && (
              <div className="fin-parcelas">
                <label className="fin-campo">
                  <span>Número de parcelas (2 a 48)</span>
                  <input type="text" inputMode="numeric" maxLength={2} value={nParcelas} onChange={(x) => setNParcelas(x.target.value.replace(/\D/g, ''))} />
                </label>
                <div className="fin-chips" role="radiogroup" aria-label="Primeira parcela">
                  <button type="button" role="radio" aria-checked={inicio === 'este'} className={`fin-chip${inicio === 'este' ? ' fin-chip--on' : ''}`} onClick={() => setInicio('este')}>
                    1ª parcela neste mês
                  </button>
                  <button type="button" role="radio" aria-checked={inicio === 'proximo'} className={`fin-chip${inicio === 'proximo' ? ' fin-chip--on' : ''}`} onClick={() => setInicio('proximo')}>
                    1ª parcela no mês seguinte
                  </button>
                </div>
                {previa && (
                  <p className="fin-previa">
                    {n}x de {formatBrl(previa[0])}
                    {previa[n - 1] !== previa[0] ? ` (a última: ${formatBrl(previa[n - 1])})` : ''}
                  </p>
                )}
              </div>
            )}
          </>
        )}
        {erro && (
          <p className="auth-error" role="alert">
            {erro}
          </p>
        )}
        <div className="fin-sheet-acoes">
          <button type="submit" className="water-primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" className="cty-btn" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

function FolhaNovaCategoria({ tipo, onClose, onCreate }: { tipo: FinTipo; onClose: () => void; onCreate: (nome: string, icone: string) => Promise<string | null> }) {
  const [nome, setNome] = useState('')
  const [icone, setIcone] = useState('estrela')
  const [erro, setErro] = useState<string | null>(null)
  async function submit(ev: FormEvent) {
    ev.preventDefault()
    if (!nome.trim()) return setErro('Dê um nome para a categoria.')
    const r = await onCreate(nome, icone)
    if (r) setErro(r)
    else onClose()
  }
  return (
    <div className="fin-sheet-backdrop" role="presentation" onClick={onClose}>
      <form className="fin-sheet" role="dialog" aria-modal="true" aria-label="Nova categoria" onClick={(x) => x.stopPropagation()} onSubmit={(x) => void submit(x)}>
        <h3 className="fin-sheet-titulo">Nova categoria de {tipo === 'receita' ? 'receita' : tipo === 'gasto' ? 'gasto' : 'investimento'}</h3>
        <label className="fin-campo">
          <span>Nome (até 20 letras)</span>
          <input type="text" maxLength={20} value={nome} onChange={(x) => setNome(x.target.value)} autoFocus />
        </label>
        <div className="fin-chips" role="radiogroup" aria-label="Ícone">
          {FIN_ICON_PICKER.map((i) => (
            <button key={i} type="button" role="radio" aria-checked={icone === i} aria-label={`Ícone ${i}`} className={`fin-chip fin-chip--icone${icone === i ? ' fin-chip--on' : ''}`} onClick={() => setIcone(i)}>
              <FinIcon name={i} size={22} />
            </button>
          ))}
        </div>
        {erro && (
          <p className="auth-error" role="alert">
            {erro}
          </p>
        )}
        <div className="fin-sheet-acoes">
          <button type="submit" className="water-primary">
            Criar
          </button>
          <button type="button" className="cty-btn" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

function ConfirmarApagar({ item, onClose, onApagar }: { item: FinLancamento; onClose: () => void; onApagar: (escopo: 'esta' | 'proximas' | 'todas') => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  async function go(escopo: 'esta' | 'proximas' | 'todas') {
    setBusy(true)
    await onApagar(escopo)
    setBusy(false)
    onClose()
  }
  return (
    <div className="fin-sheet-backdrop" role="presentation" onClick={onClose}>
      <div className="fin-sheet" role="alertdialog" aria-modal="true" aria-label="Apagar lançamento" onClick={(x) => x.stopPropagation()}>
        <h3 className="fin-sheet-titulo">Apagar este lançamento?</h3>
        <p className="home-muted">{formatBrl(item.valor_centavos)}. Não dá para desfazer.</p>
        <div className="fin-sheet-acoes fin-sheet-acoes--coluna">
          {item.parcela_grupo ? (
            <>
              <button type="button" className="question-delete-button" disabled={busy} onClick={() => void go('esta')}>
                Só esta parcela
              </button>
              <button type="button" className="question-delete-button" disabled={busy} onClick={() => void go('proximas')}>
                Esta e as próximas
              </button>
              <button type="button" className="question-delete-button" disabled={busy} onClick={() => void go('todas')}>
                Todas as parcelas da compra
              </button>
            </>
          ) : (
            <button type="button" className="question-delete-button" disabled={busy} onClick={() => void go('esta')}>
              Apagar
            </button>
          )}
          <button type="button" className="cty-btn" onClick={onClose}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- aba de lançamentos (receitas, gastos, investir)
function AbaLancamentos({
  tipo,
  mes,
  lancs,
  categorias,
  onAbrir,
  onNovaCategoria,
  onEditar,
  onApagar,
  onExcluirCategoria,
}: {
  tipo: FinTipo
  mes: string
  lancs: FinLancamento[]
  categorias: FinCategoria[]
  onAbrir: (categoria: string) => void
  onNovaCategoria: () => void
  onEditar: (l: FinLancamento) => void
  onApagar: (l: FinLancamento) => void
  onExcluirCategoria: (id: string) => void
}) {
  const totais = useMemo(() => totaisPorCategoria(lancs, mes, tipo), [lancs, mes, tipo])
  const acumulado = useMemo(() => acumuladoInvestido(lancs), [lancs])
  const doMes = useMemo(() => ordenarPorDia(lancs.filter((l) => l.tipo === tipo && chaveMes(l.data) === mes)), [lancs, mes, tipo])
  const nomes = new Map(categorias.map((c) => [c.id, c]))
  return (
    <div className="fin-aba">
      {tipo === 'gasto' && (
        <div className="fin-cartao fin-cartao--fino">
          <span>Parcelas nos próximos meses</span>
          <strong>{formatBrl(parcelasFuturas(lancs, mes, 4))}</strong>
        </div>
      )}
      <div className="fin-grade">
        {categorias.map((c) => {
          const valor = tipo === 'investimento' ? (acumulado.get(c.id) ?? 0) : (totais.get(c.id) ?? 0)
          return (
            <div key={c.id} className="fin-cat-wrap">
              <button type="button" className="fin-cat" onClick={() => onAbrir(c.id)} aria-label={`${c.nome}, ${formatBrl(valor)}. Lançar`}>
                <span className="fin-cat-icone">
                  <FinIcon name={c.icone} size={34} />
                </span>
                <span className="fin-cat-nome">{c.nome}</span>
                <span className="fin-cat-valor">{formatBrl(valor)}</span>
              </button>
              {!c.padrao && (
                <button type="button" className="fin-cat-x" aria-label={`Excluir a categoria ${c.nome}`} onClick={() => onExcluirCategoria(c.id)}>
                  ×
                </button>
              )}
            </div>
          )
        })}
        <button type="button" className="fin-cat fin-cat--nova" onClick={onNovaCategoria}>
          <span className="fin-cat-icone">+</span>
          <span className="fin-cat-nome">Nova categoria</span>
        </button>
      </div>
      <h3 className="fin-subtitulo">{tipo === 'receita' ? 'Receitas' : tipo === 'gasto' ? 'Gastos' : 'Investimentos'} do mês</h3>
      {doMes.length === 0 && <p className="home-muted">Nada lançado neste mês.</p>}
      <ul className="fin-lista">
        {doMes.map((l) => {
          const c = nomes.get(l.categoria)
          const detalhe = [l.parcela_grupo ? `Parcela ${l.parcela_n}/${l.parcela_total}` : null, l.observacao].filter(Boolean).join(' · ')
          return (
            <li key={l.id} className="fin-item">
              <span className="fin-item-icone">
                <FinIcon name={c?.icone ?? 'estrela'} size={24} />
              </span>
              <span className="fin-item-texto">
                <strong>{c?.nome ?? 'Categoria'}</strong>
                <small>
                  dia {Number(l.data.slice(8, 10))}
                  {detalhe ? ` · ${detalhe}` : ''}
                  {l.movimento ? ` · ${l.movimento === 'aplicar' ? 'Aplicou' : 'Resgatou'}` : ''}
                </small>
              </span>
              <span className="fin-item-valor">{formatBrl(l.valor_centavos)}</span>
              <button type="button" className="fin-icone-btn" aria-label="Editar lançamento" onClick={() => onEditar(l)}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
                  <path d="m13.500 6.500 4 4" />
                </svg>
              </button>
              <button type="button" className="fin-icone-btn" aria-label="Apagar lançamento" onClick={() => onApagar(l)}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13M10 11v6M14 11v6" />
                </svg>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- página
export function FinancasPage() {
  const fin = useFinancas()
  const { falar } = useRobo()
  const [mes, setMes] = useState(chaveAtual())
  const [aba, setAba] = useState<Aba>('resumo')
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [novaCat, setNovaCat] = useState<FinTipo | null>(null)
  const [apagando, setApagando] = useState<FinLancamento | null>(null)
  const [meses, setMeses] = useState<6 | 12>(6)
  const [aviso, setAviso] = useState<string | null>(null)
  const [reacao, setReacao] = useState<{ estado: RoboFinEstado; fala: string } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const lancs = fin.lancs ?? SEM_LANCAMENTOS
  const resumo = useMemo(() => resumoDoMes(lancs, mes), [lancs, mes])
  const vazio = !lancs.some((l) => chaveMes(l.data) === mes)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function reagir(estado: RoboFinEstado, fala: string) {
    window.clearTimeout(timer.current)
    setReacao({ estado, fala })
    falar(undefined, estado === 'feliz' ? 'moedas' : estado === 'triste' ? 'conta' : 'alarme')
    timer.current = window.setTimeout(() => setReacao(null), REACAO_MS)
  }

  // repouso recalculado a cada mudança (se o mês deixa de estar devendo, o robô deixa de ficar preocupado)
  const repouso: RoboFinEstado = resumo.devendo ? 'repouso-devendo' : 'repouso'
  const estado = reacao?.estado ?? repouso
  const fala = reacao?.fala ?? FALAS[repouso]

  function toqueNoRobo() {
    if (resumo.devendo) reagir('devendo', FALAS.devendo)
    else falar('feliz', undefined)
  }

  async function salvar(rows: NovoLancamento[], edit: { id: string; patch: Partial<NovoLancamento> } | null): Promise<string | null> {
    if (edit) return fin.editar(edit.id, edit.patch) // editar não dispara reação do robô
    const erro = await fin.adicionar(rows)
    if (erro) return erro
    const primeira = rows[0]
    const devendoDepois = resumoDoMes([...lancs, ...rows.map((r, i) => ({ ...r, id: `novo-${i}` }))], mes).devendo
    const r = reacaoDoLancamento(primeira.tipo, primeira.movimento, devendoDepois)
    if (r) reagir(r, r === 'feliz' && primeira.tipo === 'investimento' ? FALA_INVESTIU : FALAS[r])
    return null
  }

  async function apagar(escopo: 'esta' | 'proximas' | 'todas') {
    if (!apagando) return
    const alvo = apagando
    let ids = [alvo.id]
    if (alvo.parcela_grupo && escopo !== 'esta') {
      ids = lancs.filter((l) => l.parcela_grupo === alvo.parcela_grupo && (escopo === 'todas' || l.data >= alvo.data)).map((l) => l.id)
    }
    const erro = await fin.apagar(ids)
    setAviso(erro)
  }

  const tipoAba = aba === 'receitas' || aba === 'gastos' || aba === 'investir' ? TIPO_DA_ABA[aba] : null
  const hist = useMemo(() => historico(lancs, somarMeses(mes, 0), meses), [lancs, mes, meses])
  const sel = hist.find((p) => p.chave === mes) ?? hist[hist.length - 1]
  const gastosPorCat = useMemo(() => {
    const t = totaisPorCategoria(lancs, mes, 'gasto')
    return [...t.entries()]
      .map(([chave, valor]) => ({ chave, valor, nome: fin.todasCategorias.find((c) => c.id === chave)?.nome ?? 'Categoria' }))
      .sort((a, b) => b.valor - a.valor)
  }, [lancs, mes, fin.todasCategorias])
  const acumulado = useMemo(() => acumuladoInvestido(lancs), [lancs])

  if (fin.error) {
    return (
      <p className="auth-error" role="alert">
        {fin.error}
      </p>
    )
  }
  if (!fin.lancs) return <p className="home-muted">Carregando…</p>

  return (
    <section className="fin-page">
      <FinRobo estado={estado} fala={fala} vazio={vazio} onToque={toqueNoRobo} />

      <div className="fin-mes" role="group" aria-label="Mês">
        <button type="button" aria-label="Mês anterior" onClick={() => setMes(somarMeses(mes, -1))}>
          ‹
        </button>
        <strong>{nomeMes(mes)}</strong>
        <button type="button" aria-label="Próximo mês" onClick={() => setMes(somarMeses(mes, 1))}>
          ›
        </button>
      </div>

      <div className="fin-abas" role="tablist" aria-label="Finanças">
        {ABAS.map((a) => (
          <button key={a.key} type="button" role="tab" aria-selected={aba === a.key} className={`fin-aba-btn${aba === a.key ? ' fin-aba-btn--on' : ''}`} onClick={() => setAba(a.key)}>
            {a.label}
          </button>
        ))}
      </div>

      {aviso && (
        <p className="auth-error" role="alert">
          {aviso}
        </p>
      )}

      {aba === 'resumo' && (
        <div className="fin-aba">
          <div className="fin-cartao">
            <span>Sobrou este mês</span>
            <strong className="fin-grande">{formatBrl(resumo.sobrou)}</strong>
            <div className="fin-tres">
              <div>
                <small>Receitas</small>
                <b style={{ color: COR_RECEITA }}>{formatBrl(resumo.receitas)}</b>
              </div>
              <div>
                <small>Gastos</small>
                <b style={{ color: COR_GASTO }}>{formatBrl(resumo.gastos)}</b>
              </div>
              <div>
                <small>Investido</small>
                <b style={{ color: COR_INVEST }}>{formatBrl(resumo.investido)}</b>
              </div>
            </div>
          </div>
          <h3 className="fin-subtitulo">Gastos por categoria</h3>
          <Donut fatias={gastosPorCat} />
          <h3 className="fin-subtitulo">Neste mês</h3>
          <Barras
            itens={[
              { nome: 'Receitas', valor: resumo.receitas, cor: COR_RECEITA },
              { nome: 'Gastos', valor: resumo.gastos, cor: COR_GASTO },
              { nome: 'Investido', valor: resumo.investido, cor: COR_INVEST },
            ]}
          />
          <h3 className="fin-subtitulo">Investimentos acumulados</h3>
          {[...acumulado.entries()].filter(([, v]) => v !== 0).length === 0 ? (
            <p className="home-muted">Nenhum investimento registrado ainda.</p>
          ) : (
            <Barras
              itens={[...acumulado.entries()]
                .filter(([, v]) => v !== 0)
                .map(([k, v]) => ({ nome: fin.todasCategorias.find((c) => c.id === k)?.nome ?? 'Categoria', valor: v, cor: COR_INVEST }))}
            />
          )}
        </div>
      )}

      {tipoAba && (
        <AbaLancamentos
          tipo={tipoAba}
          mes={mes}
          lancs={lancs}
          categorias={fin.categorias(tipoAba)}
          onAbrir={(categoria) => setSheet({ tipo: tipoAba, categoria, editando: null })}
          onNovaCategoria={() => setNovaCat(tipoAba)}
          onEditar={(l) => setSheet({ tipo: l.tipo, categoria: l.categoria, editando: l })}
          onApagar={setApagando}
          onExcluirCategoria={(id) => void fin.excluirCategoria(id).then(setAviso)}
        />
      )}

      {aba === 'historico' && (
        <div className="fin-aba">
          <div className="fin-chips" role="radiogroup" aria-label="Período">
            {([6, 12] as const).map((n) => (
              <button key={n} type="button" role="radio" aria-checked={meses === n} className={`fin-chip${meses === n ? ' fin-chip--on' : ''}`} onClick={() => setMeses(n)}>
                {n} meses
              </button>
            ))}
          </div>
          <Ondas pontos={hist} selecionado={mes} onPick={setMes} />
          {sel && (
            <div className="fin-tres" aria-live="polite">
              <div>
                <small>Receitas</small>
                <b style={{ color: COR_RECEITA }}>{formatBrl(sel.receitas)}</b>
              </div>
              <div>
                <small>Gastos</small>
                <b style={{ color: COR_GASTO }}>{formatBrl(sel.gastos)}</b>
              </div>
              <div>
                <small>Sobrou</small>
                <b>{formatBrl(sel.saldo)}</b>
              </div>
            </div>
          )}
          <h3 className="fin-subtitulo">Mês a mês</h3>
          <ul className="fin-lista">
            {[...hist].reverse().map((p) => (
              <li key={p.chave}>
                <button
                  type="button"
                  className="fin-item fin-item--botao"
                  onClick={() => {
                    setMes(p.chave)
                    setAba('resumo')
                  }}
                >
                  <span className="fin-item-texto">
                    <strong>{nomeMes(p.chave)}</strong>
                    <small>
                      Receitas {formatBrl(p.receitas)} · Gastos {formatBrl(p.gastos)}
                    </small>
                  </span>
                  <span className="fin-item-valor">{formatBrl(p.saldo)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheet && (
        <FolhaLancamento key={`${sheet.editando?.id ?? 'novo'}-${sheet.categoria}`} sheet={sheet} mes={mes} categorias={fin.categorias(sheet.tipo)} onClose={() => setSheet(null)} onSave={salvar} />
      )}
      {novaCat && <FolhaNovaCategoria tipo={novaCat} onClose={() => setNovaCat(null)} onCreate={(nome, icone) => fin.criarCategoria(novaCat, nome, icone)} />}
      {apagando && <ConfirmarApagar item={apagando} onClose={() => setApagando(null)} onApagar={apagar} />}
    </section>
  )
}
