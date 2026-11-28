import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { RoboGuia } from './RoboGuia'
import type { RoboCena } from './RoboGuia'
import { RoboMudo } from './RoboMudo'
import { falar } from '../hooks/useRobo'
import { CYCLE_LABEL, formatBrl } from '../lib/plansCatalog'
import type { PlanCycle } from '../lib/plansCatalog'

// O robô nos Planos: consultor (recomenda o plano maior, com a economia real em reais) e
// comemoração quando a assinatura é CONFIRMADA (o acesso foi liberado pelo servidor).

const CHAVE_CELEBRADAS = 'circula:robo-celebrou'

export function jaCelebrou(chave: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(CHAVE_CELEBRADAS) ?? '[]') as string[]).includes(chave)
  } catch {
    return false
  }
}
export function marcarCelebrou(chave: string) {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE_CELEBRADAS) ?? '[]') as string[]
    if (!lista.includes(chave)) localStorage.setItem(CHAVE_CELEBRADAS, JSON.stringify([...lista, chave].slice(-50)))
  } catch {
    /* sem storage: só não lembra */
  }
}

/** Economia real (em centavos) do plano anual em relação a pagar 12 meses no mensal. */
export function economiaAnual(prices: Record<PlanCycle, number>): number {
  return Math.max(0, prices.monthly * 12 - prices.annual)
}

/** Dica do topo da página de Planos: recomenda o anual (ou o semestral, se o anual não compensa). Sem robô e sem som: o robô só aparece quando a pessoa assina. */
export function RoboConsultor({ economiaAnualCents, economiaSemestralCents, nome }: { economiaAnualCents: number; economiaSemestralCents: number; nome: string }) {
  const usaAnual = economiaAnualCents > 0
  const economia = usaAnual ? economiaAnualCents : economiaSemestralCents
  if (economia <= 0) return null
  return (
    <aside className="robo-consultor" aria-label="Dica de plano">
      <div className="robo-consultor-balao">
        <p>
          <strong>Dica da Livi:</strong> no plano {usaAnual ? 'anual' : 'semestral'} do {nome} você economiza <strong>{formatBrl(economia)}</strong> em relação a pagar mês a mês. Você escolhe o que for melhor para você.
        </p>
      </div>
    </aside>
  )
}

/** A Livi dentro da assinatura: apresenta SEMPRE o plano imediatamente acima do escolhido, com a economia real em reais.
 *  Argumentos diferentes a cada degrau, uma só vez por escolha: se a pessoa recusar, a Livi respeita e some. Sem som. */
export function RoboInsiste({ cycle, prices, onPick }: { cycle: PlanCycle; prices: Record<PlanCycle, number>; onPick: (c: PlanCycle) => void }) {
  const [recusou, setRecusou] = useState<PlanCycle[]>([])
  const anual = Math.max(0, prices.monthly * 12 - prices.annual)
  const semestral = Math.max(0, prices.monthly * 6 - prices.semiannual)
  if (anual <= 0 && semestral <= 0) return null
  if (recusou.includes(cycle)) return null
  const cena: RoboCena = cycle === 'annual' ? 'feliz' : 'pedindo'
  const recusar = () => setRecusou((r) => [...r, cycle])
  return (
    <div className="robo-insiste" role="note" aria-label="Dica da Livi">
      <RoboGuia cena={cena} tamanho={64} mudo />
      <div className="robo-insiste-balao">
        {cycle === 'annual' && (
          <p>
            <strong>Ótima escolha!</strong> Sou a Livi, e no anual você economiza {formatBrl(anual)} em relação a pagar mês a mês. É o melhor custo-benefício do Círcula.
          </p>
        )}
        {cycle === 'semiannual' && (
          <>
            <p>
              <strong>Boa escolha!</strong> Sou a Livi. O semestral já economiza {formatBrl(semestral)}. Se você pretende ficar mais tempo, o <strong>anual</strong> economiza <strong>{formatBrl(anual)}</strong>, a maior economia, e você não precisa se preocupar com renovação o ano todo.
            </p>
            <div className="robo-insiste-acoes">
              <button type="button" className="water-primary" onClick={() => onPick('annual')}>
                Quero o anual
              </button>
              <button type="button" className="water-link" onClick={recusar}>
                Continuar no semestral
              </button>
            </div>
          </>
        )}
        {cycle === 'monthly' && (
          <>
            <p>
              Oi, sou a Livi! Pagando mês a mês é mais flexível. Só que no <strong>semestral</strong> você economiza <strong>{formatBrl(semestral)}</strong> e ganha seis meses sem se preocupar com a cobrança.
            </p>
            <div className="robo-insiste-acoes">
              <button type="button" className="water-primary" onClick={() => onPick('semiannual')}>
                Quero o semestral
              </button>
              <button type="button" className="water-link" onClick={recusar}>
                Continuar no mensal
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** A Livi na hora de cancelar o Premium: lembra do que ela perde e oferece ficar só no plano básico. Sem som. */
export function RoboRetencao({
  busy,
  podeCancelarTudo,
  onManter,
  onBasico,
  onTudo,
}: {
  busy: boolean
  podeCancelarTudo: boolean
  onManter: () => void
  onBasico: () => void
  onTudo: () => void
}) {
  return (
    <div className="robo-insiste robo-retencao" role="note" aria-label="Antes de cancelar o Premium">
      <RoboGuia cena="pedindo" tamanho={64} mudo />
      <div className="robo-insiste-balao">
        <p>
          <strong>Antes de ir…</strong> O Premium leva todos os conteúdos do Círcula. Se cancelar, o acesso a eles termina agora, na hora. Que tal ficar só com o <strong>plano básico, R$ 14,90 por mês</strong>? Você mantém o Círcula e pode assinar os conteúdos que quiser, um por um.
        </p>
        <div className="robo-insiste-acoes">
          <button type="button" className="water-primary" onClick={onManter} disabled={busy}>
            Manter meu Premium
          </button>
          <button type="button" className="water-link" onClick={onBasico} disabled={busy}>
            {busy ? 'Cancelando…' : 'Cancelar o Premium e ficar no básico'}
          </button>
          {podeCancelarTudo && (
            <button type="button" className="question-delete-button" onClick={onTudo} disabled={busy}>
              Cancelar tudo
            </button>
          )}
        </div>
        {podeCancelarTudo && <p className="home-muted">“Cancelar tudo” encerra o Círcula inteiro, inclusive o plano básico. Para voltar, é preciso assinar de novo.</p>}
      </div>
    </div>
  )
}

const PETALAS =Array.from({ length: 22 }, (_, i) => ({
  esq: (i * 37) % 100,
  atraso: ((i * 53) % 18) / 10,
  dur: 2.6 + ((i * 29) % 14) / 10,
  tam: 8 + ((i * 17) % 9),
  giro: (i % 2 ? 1 : -1) * (120 + ((i * 13) % 200)),
}))

/** Comemoração da assinatura confirmada: comemora, depois coração, balão de obrigada e chuva de pétalas. */
export function RoboCelebracao({ ciclo, onFechar }: { ciclo?: PlanCycle | null; onFechar: () => void }) {
  const [cena, setCena] = useState<RoboCena>('comemora')
  useEffect(() => {
    falar('comemora', 'comemoracao')
    const t = window.setTimeout(() => {
      setCena('coracao')
      falar('coracao', 'obrigado')
    }, 2200)
    return () => window.clearTimeout(t)
  }, [])
  return createPortal(
    <div className="robo-celebracao" role="dialog" aria-modal="true" aria-label="Assinatura ativa">
      <div className="robo-petalas" aria-hidden="true">
        {PETALAS.map((p, i) => (
          <span key={i} style={{ left: `${p.esq}%`, animationDelay: `${p.atraso}s`, animationDuration: `${p.dur}s`, width: p.tam, height: p.tam, ['--giro' as string]: `${p.giro}deg` }} />
        ))}
      </div>
      <div className="robo-celebracao-corpo">
        <RoboGuia cena={cena} tamanho={150} />
        <RoboMudo />
        <div className="robo-celebracao-balao">
          <p>
            <strong>Obrigada! Sua assinatura está ativa</strong>
            {ciclo ? ` (${CYCLE_LABEL[ciclo].toLowerCase()})` : ''}. Aproveite o Círcula.
          </p>
          <button type="button" className="onboarding-next" onClick={onFechar}>
            Continuar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** "Por que assinar?": a Livi responde as três perguntas que mais aparecem, com os valores reais do catálogo
 *  (Premium, semestral e anual). Sem som; cada resposta abre ao tocar. */
export function LiviPorQue({
  premium,
  separadoMensalCents,
  totalItens,
  promo,
}: {
  /** Preços vigentes do Premium por ciclo. */
  premium: Record<PlanCycle, number>
  /** Quanto custaria por mês assinar tudo separado (Círcula + todos os avulsos). */
  separadoMensalCents: number
  /** Quantos conteúdos e ferramentas o Premium junta. */
  totalItens: number
  /** Ainda no preço de lançamento (até 30/11/2026). */
  promo: boolean
}) {
  const offMensal = Math.round((1 - premium.monthly / separadoMensalCents) * 100)
  const semestreCheio = premium.monthly * 6
  const anoCheio = premium.monthly * 12
  const pct = (cheio: number, pago: number) => Math.round((1 - pago / cheio) * 100)
  return (
    <aside className="livi-porque" aria-label="Por que assinar? Respostas da Livi">
      <div className="livi-porque-head">
        <RoboGuia cena="feliz" tamanho={64} mudo />
        <p>
          <strong>Sou a Livi.</strong> Separei as dúvidas que mais recebo sobre os planos:
        </p>
      </div>
      <details>
        <summary>Por que assinar o Premium?</summary>
        <p>
          Porque ele junta o Círcula e os {totalItens} conteúdos e ferramentas numa assinatura só. Separado, tudo custaria{' '}
          <strong>{formatBrl(separadoMensalCents)}</strong> por mês; no Premium sai por <strong>{formatBrl(premium.monthly)}</strong>, {offMensal}% a
          menos. Você não precisa escolher o que assinar nem pagar cada um: está tudo liberado.
          {promo && <> Assinando até 30/11/2026, você garante o preço de lançamento.</>}
        </p>
      </details>
      <details>
        <summary>Por que assinar o plano semestral?</summary>
        <p>
          Porque você paga 6 meses de uma vez e paga menos: o Premium semestral sai por <strong>{formatBrl(premium.semiannual)}</strong> em vez de{' '}
          {formatBrl(semestreCheio)} (6 vezes o mensal), {pct(semestreCheio, premium.semiannual)}% a menos. Nos avulsos, o semestral tem 16% de
          desconto. E dá para parcelar em até 6x no cartão, numa contratação só.
        </p>
      </details>
      <details>
        <summary>Por que assinar o plano anual?</summary>
        <p>
          Porque é a maior economia do Círcula: o Premium anual sai por <strong>{formatBrl(premium.annual)}</strong> em vez de {formatBrl(anoCheio)}{' '}
          (12 vezes o mensal), {pct(anoCheio, premium.annual)}% a menos, ou seja, <strong>{formatBrl(anoCheio - premium.annual)}</strong> no bolso. Nos
          avulsos, o anual tem 33% de desconto. Dá para parcelar em até 12x no cartão, e você passa o ano inteiro sem pensar em renovação.
        </p>
      </details>
    </aside>
  )
}
