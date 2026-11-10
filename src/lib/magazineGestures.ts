// Gestos do leitor da revista: virada de página que acompanha o dedo e zoom
// por pinça (dois dedos). Só contas, sem DOM, para poder testar.

export const MAG_MIN_ZOOM = 1
export const MAG_MAX_ZOOM = 4
/** Zoom do toque duplo. */
export const MAG_DOUBLE_TAP_ZOOM = 2.5
/** Quanto a folha gira até sair de vista (graus). */
export const MAG_TURN_DEG = 170

export interface MagView {
  z: number
  tx: number
  ty: number
}

export const MAG_VIEW_RESET: MagView = { z: 1, tx: 0, ty: 0 }

export function clampZoom(z: number): number {
  return Math.min(MAG_MAX_ZOOM, Math.max(MAG_MIN_ZOOM, z))
}

export function pointDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Novo enquadramento depois de mudar o zoom segurando um ponto da página.
 * (mx, my) é o ponto do dedo relativo ao CENTRO da área da página; `anchor`
 * é o ponto da página que estava sob o dedo quando o gesto começou. A página
 * fica sob o dedo enquanto amplia e acompanha o movimento dele.
 */
export function viewForPinch(start: MagView, startMid: { x: number; y: number }, nextZ: number, mid: { x: number; y: number }): MagView {
  const z = clampZoom(nextZ)
  const cx = (startMid.x - start.tx) / start.z
  const cy = (startMid.y - start.ty) / start.z
  return { z, tx: mid.x - cx * z, ty: mid.y - cy * z }
}

/** Impede de arrastar a página para fora da área; menor que a área, fica centrada. */
export function clampView(view: MagView, sheetW: number, sheetH: number, boxW: number, boxH: number): MagView {
  const limitX = Math.max(0, (sheetW * view.z - boxW) / 2)
  const limitY = Math.max(0, (sheetH * view.z - boxH) / 2)
  return {
    z: view.z,
    tx: Math.min(limitX, Math.max(-limitX, view.tx)),
    ty: Math.min(limitY, Math.max(-limitY, view.ty)),
  }
}

/** Perto demais de 1, vira exatamente 1 (sem sobra de arrasto). */
export function snapView(view: MagView): MagView {
  return view.z < 1.05 ? MAG_VIEW_RESET : view
}

export type TurnDir = 'next' | 'prev'

/**
 * Progresso VISUAL da folha: 0 = deitada sobre a página, 1 = virada por
 * completo. Ao avançar a folha sai de 0 e vai a 1; ao voltar, a folha da
 * página anterior sai de 1 (já virada) e vem até 0.
 * `fraction` é quanto o dedo andou na direção da virada (0 a 1).
 */
export function turnProgress(dir: TurnDir, fraction: number): number {
  const f = Math.min(1, Math.max(0, fraction))
  return dir === 'next' ? f : 1 - f
}

export function dragFraction(dir: TurnDir, dx: number, width: number): number {
  if (width <= 0) return 0
  const moved = dir === 'next' ? -dx : dx
  return Math.min(1, Math.max(0, moved / width))
}

/** Solta o dedo: completa a virada se foi longe ou rápido o bastante. */
export function shouldComplete(fraction: number, velocityTowardTurn: number): boolean {
  return fraction > 0.32 || velocityTowardTurn > 0.45
}

export function flapAngle(p: number): number {
  return -p * MAG_TURN_DEG
}

/** Escurece a folha conforme ela se vira. */
export function flapShade(p: number): number {
  return Math.min(1, p * 1.3) * 0.7
}

/** A sombra que a folha lança na página de baixo é maior no meio da virada. */
export function castShade(p: number): number {
  const c = Math.min(1, Math.max(0, p))
  return Math.sin(c * Math.PI) * 0.55
}

/** Duração para terminar a virada: curta e proporcional ao que falta. */
export function settleMs(fromP: number, toP: number): number {
  return Math.round(Math.min(460, Math.max(220, Math.abs(toP - fromP) * 460)))
}
