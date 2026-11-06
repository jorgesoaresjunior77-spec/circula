import type { NavKey } from '../components/PrimaryNav'

// ANTES DE TUDO — os 7 hábitos do ritual diário.
//
// `target`: para onde o toque no nome do hábito leva. Sem `target`, o
// toque no nome apenas marca/desmarca (luz natural e espiritualidade são
// marcadas direto no ritual; "movimento" ainda não tem orientações).

export type HabitKey =
  | 'luz'
  | 'agua'
  | 'exercicio'
  | 'leitura'
  | 'respiracao'
  | 'organizacao'
  | 'espiritualidade'

export interface Habit {
  key: HabitKey
  label: string
  hint: string
  target?: NavKey
  /** Rótulo do atalho para a tela do hábito. */
  targetLabel?: string
}

export const HABITS: Habit[] = [
  { key: 'luz', label: 'Luz da manhã', hint: 'Receba a luz natural logo cedo.' },
  {
    key: 'agua',
    label: 'Beber água',
    hint: 'Acompanhe sua meta do dia.',
    target: 'agua',
    targetLabel: 'Abrir a calculadora de água',
  },
  { key: 'exercicio', label: 'Exercício e movimento', hint: 'Mexa o corpo do seu jeito.' },
  {
    key: 'leitura',
    label: 'Leitura',
    hint: 'Algumas páginas já contam.',
    target: 'leitura',
    targetLabel: 'Abrir as dicas de leitura',
  },
  {
    key: 'respiracao',
    label: 'Respiração e meditação',
    hint: 'Uma pausa para desacelerar.',
    target: 'respiracao',
    targetLabel: 'Abrir respiração e meditação',
  },
  {
    key: 'organizacao',
    label: 'Organização do dia',
    hint: 'Veja seus compromissos de hoje.',
    target: 'agenda',
    targetLabel: 'Abrir a agenda',
  },
  {
    key: 'espiritualidade',
    label: 'Conexão com a espiritualidade',
    hint: 'Do seu jeito, na sua fé ou crença.',
  },
]

/** Quantos hábitos de hoje já foram marcados (só conta os conhecidos). */
export function countDone(checked: ReadonlySet<string>): number {
  return HABITS.filter((h) => checked.has(h.key)).length
}

/** Fração da ilustração que fica colorida: 0 (preto e branco) a 1 (colorida). */
export function colorAmount(done: number): number {
  return Math.min(1, Math.max(0, done / HABITS.length))
}
