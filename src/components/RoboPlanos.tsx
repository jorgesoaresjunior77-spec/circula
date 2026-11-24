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
          <strong>Minha dica:</strong> no plano {usaAnual ? 'anual' : 'semestral'} do {nome} você economiza <strong>{formatBrl(economia)}</strong> em relação a pagar mês a mês. Você escolhe o que for melhor para você.
        </p>
      </div>
    </aside>
  )
}

/** O robô dentro da assinatura: insiste, com carinho e com a economia real em reais, nos planos maiores. Sem som. */
export function RoboInsiste({ cycle, prices, onPick }: { cycle: PlanCycle; prices: Record<PlanCycle, number>; onPick: (c: PlanCycle) => void }) {
  const anual = Math.max(0, prices.monthly * 12 - prices.annual)
  const semestral = Math.max(0, prices.monthly * 6 - prices.semiannual)
  if (anual <= 0 && semestral <= 0) return null
  const cena: RoboCena = cycle === 'annual' ? 'feliz' : 'pedindo'
  return (
    <div className="robo-insiste" role="note" aria-label="Dica do robô">
      <RoboGuia cena={cena} tamanho={64} mudo />
      <div className="robo-insiste-balao">
        {cycle === 'annual' && (
          <p>
            <strong>Ótima escolha!</strong> No anual você economiza {formatBrl(anual)} em relação a pagar mês a mês.
          </p>
        )}
        {cycle === 'semiannual' && (
          <>
            <p>
              O semestral já economiza {formatBrl(semestral)}. Mas no <strong>anual</strong> a economia é de <strong>{formatBrl(anual)}</strong>. Que tal o anual?
            </p>
            <div className="robo-insiste-acoes">
              <button type="button" className="water-primary" onClick={() => onPick('annual')}>
                Quero o anual
              </button>
            </div>
          </>
        )}
        {cycle === 'monthly' && (
          <>
            <p>
              Pagando mês a mês você gasta mais. No <strong>semestral</strong> você economiza {formatBrl(semestral)} e no <strong>anual</strong>, {formatBrl(anual)}.
            </p>
            <div className="robo-insiste-acoes">
              <button type="button" className="water-primary" onClick={() => onPick('annual')}>
                Quero o anual
              </button>
              <button type="button" className="water-link" onClick={() => onPick('semiannual')}>
                Prefiro o semestral
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const PETALAS = Array.from({ length: 22 }, (_, i) => ({
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
