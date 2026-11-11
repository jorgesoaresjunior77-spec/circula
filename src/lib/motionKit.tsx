// Base das animações com Motion (motion.dev) no Círcula.
//
// - <MotionRoot> carrega só o pacote leve de recursos (domAnimation) e manda
//   o Motion respeitar "reduzir movimento" do aparelho: com ele ligado, os
//   deslocamentos e escalas somem e fica só a troca de opacidade.
// - Os componentes usam `m.*` (versão enxuta de `motion.*`) com os conjuntos
//   de propriedades daqui, para a linguagem de movimento ser uma só.
// - Regra: nada de transform em elemento que contém tela cheia/position:fixed
//   (leitor da revista, detalhe de produto) — nesses, só opacidade.

import type { ReactNode } from 'react'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import type { Transition, Variants } from 'motion/react'

export { m, AnimatePresence } from 'motion/react'

export const SPRING_SOFT: Transition = { type: 'spring', stiffness: 220, damping: 26, mass: 0.9 }
export const SPRING_TAP: Transition = { type: 'spring', stiffness: 420, damping: 28 }

/** Entra subindo de leve, com fade. */
export const riseVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: SPRING_SOFT },
}

/** Só fade (para blocos que contêm telas cheias / position: fixed). */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5, ease: 'easeOut' } },
}

/** Pai que solta os filhos um depois do outro. */
export function staggerVariants(stagger = 0.08, delay = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  }
}

/** Propriedades de "aparecer ao entrar na tela" (uma vez só). */
export const inViewOnce = {
  initial: 'hidden',
  whileInView: 'show',
  viewport: { once: true, margin: '0px 0px -8% 0px' },
} as const

/** Toque: o elemento cede um pouco e volta com mola. */
export const tapPress = {
  whileTap: { scale: 0.96 },
  transition: SPRING_TAP,
} as const

export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}
