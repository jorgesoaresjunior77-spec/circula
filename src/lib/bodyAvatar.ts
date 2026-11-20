// Geometria do avatar corporal feminino (SVG, sem IA e sem arquivo 3D externo).
//
// O desenho nasce das MEDIDAS: cada circunferência (cm) vira a largura do corpo
// naquela altura, tratando o corte do corpo como uma elipse (aproximação de
// Ramanujan para o perímetro). Na vista de frente usa-se o semi-eixo largo; na
// vista de lado, o semi-eixo de profundidade. Altura e proporções de cada nível
// seguem as proporções médias de estatura (fração da altura medida do chão).
// Sem circunferências, usa proporções médias; com peso e altura, elas são
// escaladas pelo IMC (a circunferência cresce com a raiz do peso).

export interface AvatarMeasures {
  heightCm: number
  weightKg?: number | null
  neckCm?: number | null
  bustCm?: number | null
  waistCm?: number | null
  hipCm?: number | null
  armCm?: number | null
  thighCm?: number | null
  calfCm?: number | null
}

export type AvatarView = 'front' | 'side' | 'back'

/** Semi-eixos (a = largura, b = profundidade) de uma elipse com a circunferência dada. */
export function ellipseAxes(circumferenceCm: number, ratio: number): { a: number; b: number } {
  const b = circumferenceCm / (Math.PI * (3 * (ratio + 1) - Math.sqrt((3 * ratio + 1) * (ratio + 3))))
  return { a: ratio * b, b }
}

// Proporções médias (fração da altura) usadas quando a medida não foi informada.
const DEFAULT_RATIO = { neck: 0.194, bust: 0.545, waist: 0.424, hip: 0.582, arm: 0.17, thigh: 0.34, calf: 0.218 }
const REFERENCE_BMI = 21.5

export interface ResolvedMeasures {
  heightCm: number
  neck: number
  bust: number
  waist: number
  hip: number
  arm: number
  thigh: number
  calf: number
  /** Quais medidas foram realmente informadas (as outras são estimadas pelas proporções médias). */
  provided: Record<'neck' | 'bust' | 'waist' | 'hip' | 'arm' | 'thigh' | 'calf', boolean>
}

export function resolveMeasures(m: AvatarMeasures): ResolvedMeasures {
  const h = m.heightCm > 100 ? m.heightCm : 165
  const bmi = m.weightKg && m.weightKg > 25 ? m.weightKg / (h / 100) ** 2 : null
  const k = bmi ? Math.min(1.45, Math.max(0.82, Math.sqrt(bmi / REFERENCE_BMI))) : 1
  const pick = (v: number | null | undefined, ratio: number, scaled: boolean) => (v && v > 5 ? v : ratio * h * (scaled ? k : 1))
  return {
    heightCm: h,
    neck: pick(m.neckCm, DEFAULT_RATIO.neck, false),
    bust: pick(m.bustCm, DEFAULT_RATIO.bust, true),
    waist: pick(m.waistCm, DEFAULT_RATIO.waist, true),
    hip: pick(m.hipCm, DEFAULT_RATIO.hip, true),
    arm: pick(m.armCm, DEFAULT_RATIO.arm, true),
    thigh: pick(m.thighCm, DEFAULT_RATIO.thigh, true),
    calf: pick(m.calfCm, DEFAULT_RATIO.calf, true),
    provided: {
      neck: !!(m.neckCm && m.neckCm > 5),
      bust: !!(m.bustCm && m.bustCm > 5),
      waist: !!(m.waistCm && m.waistCm > 5),
      hip: !!(m.hipCm && m.hipCm > 5),
      arm: !!(m.armCm && m.armCm > 5),
      thigh: !!(m.thighCm && m.thighCm > 5),
      calf: !!(m.calfCm && m.calfCm > 5),
    },
  }
}

type Pt = [number, number]

/** Curva suave (Catmull-Rom) por uma lista de pontos, como comandos de caminho SVG (sem o "M" inicial). */
export function smoothThrough(points: Pt[], tension = 0.5): string {
  if (points.length < 2) return ''
  let d = ''
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) * tension) / 3 * 2 * 0.5 * 1, p1[1] + ((p2[1] - p0[1]) * tension) / 3 * 2 * 0.5 * 1]
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) * tension) / 3 * 2 * 0.5 * 1, p2[1] - ((p3[1] - p1[1]) * tension) / 3 * 2 * 0.5 * 1]
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

// Alturas de cada nível, como fração da altura medida a partir do chão.
export const LEVEL = {
  crown: 1,
  chin: 0.868,
  neckBase: 0.826,
  shoulder: 0.812,
  armpit: 0.735,
  bust: 0.72,
  underbust: 0.678,
  waist: 0.622,
  abdomen: 0.575,
  hip: 0.515,
  thigh: 0.45,
  crotch: 0.47,
  knee: 0.285,
  calf: 0.19,
  ankle: 0.045,
  sole: 0,
  elbow: 0.62,
  wrist: 0.46,
  fingertip: 0.375,
}

export interface Station {
  key: 'neck' | 'bust' | 'waist' | 'hip' | 'arm' | 'thigh' | 'calf'
  label: string
  /** Posição vertical no desenho (px). */
  y: number
  /** x do ponto de onde a linha de chamada sai (borda do corpo, lado direito). */
  edgeX: number
  valueCm: number
  /** false = valor estimado pelas proporções médias (a chamada não é mostrada). */
  measured: boolean
}

export interface AvatarGeometry {
  width: number
  height: number
  cx: number
  top: number
  /** px por cm. */
  scale: number
  /** Caminho do corpo (tronco + pernas), fechado. */
  body: string
  neck: string
  arms: string[]
  head: { cx: number; cy: number; rx: number; ry: number }
  hair: string
  stations: Station[]
}

const CANVAS_W = 320
const CANVAS_H = 660
const TOP = 26
const BODY_PX = 600

export function avatarGeometry(input: AvatarMeasures, view: AvatarView): AvatarGeometry {
  const m = resolveMeasures(input)
  const s = BODY_PX / m.heightCm // px por cm
  const cx = CANVAS_W / 2
  const Y = (f: number) => TOP + (1 - f) * BODY_PX

  const neck = ellipseAxes(m.neck, 1.0)
  const bust = ellipseAxes(m.bust, 1.5)
  const waist = ellipseAxes(m.waist, 1.55)
  const hip = ellipseAxes(m.hip, 1.42)
  const thigh = ellipseAxes(m.thigh, 1.0)
  const arm = ellipseAxes(m.arm, 1.0)
  const calf = ellipseAxes(m.calf, 1.0)

  const side = view === 'side'
  // Largura (frente/costas) ou profundidade (lado) de cada nível, em px.
  const W = (axes: { a: number; b: number }) => (side ? axes.b : axes.a) * s
  const shoulderHalf = (side ? 0.07 : 0.222) * m.heightCm * s * (side ? 1 : 0.5) * (side ? 1 : 1)

  const stations: Station[] = []
  let body = ''
  const arms: string[] = []

  if (!side) {
    // ---- frente / costas: contorno do lado direito, espelhado no esquerdo ----
    const nHalf = neck.a * s
    const bHalf = W(bust)
    const wHalf = W(waist)
    const hHalf = W(hip)
    const legC = hHalf * 0.52 // eixo da perna (distância do centro)
    const tHalf = thigh.a * s
    const kHalf = tHalf * 0.72
    const cHalf = calf.a * s
    const aHalf = cHalf * 0.5

    const right: Pt[] = [
      [nHalf * 1.0, Y(LEVEL.chin) - 8],
      [nHalf * 1.06, (Y(LEVEL.chin) + Y(LEVEL.neckBase)) / 2],
      [nHalf * 1.5, Y(LEVEL.neckBase) + 3],
      [shoulderHalf * 0.64, Y(LEVEL.shoulder) + 3],
      [shoulderHalf * 0.9, Y(LEVEL.shoulder) + 10],
      [Math.max(bHalf * 1.02, shoulderHalf * 0.82), Y(LEVEL.armpit) - 6],
      [bHalf * 0.99, Y(LEVEL.armpit)],
      [bHalf, Y(LEVEL.bust)],
      [(bHalf + wHalf) * 0.5 * 0.99, Y(LEVEL.underbust)],
      [wHalf, Y(LEVEL.waist)],
      [(wHalf + hHalf) * 0.5 * 1.02, Y(LEVEL.abdomen)],
      [hHalf, Y(LEVEL.hip)],
      [legC + tHalf, Y(LEVEL.thigh)],
      [legC * 0.97 + tHalf * 0.84, Y(0.37)],
      [legC * 0.9 + kHalf, Y(LEVEL.knee)],
      [legC * 0.87 + cHalf * 0.92, Y(0.235)],
      [legC * 0.84 + cHalf, Y(LEVEL.calf)],
      [legC * 0.81 + cHalf * 0.62, Y(0.11)],
      [legC * 0.8 + aHalf, Y(LEVEL.ankle)],
      [legC * 0.8 + aHalf * 1.7, Y(0.012)],
    ]
    const inner: Pt[] = [
      [legC * 0.8 - aHalf * 1.1, Y(0.012)],
      [legC * 0.8 - aHalf, Y(LEVEL.ankle)],
      [legC * 0.81 - cHalf * 0.6, Y(0.11)],
      [legC * 0.84 - cHalf * 0.85, Y(LEVEL.calf)],
      [legC * 0.88 - kHalf * 0.95, Y(0.24)],
      [legC * 0.9 - kHalf * 0.9, Y(LEVEL.knee)],
      [Math.max(2.5, legC * 0.95 - tHalf * 0.86), Y(0.37)],
      [Math.max(1.5, legC - tHalf * 0.95), Y(LEVEL.thigh + 0.04)],
      [0.6, Y(LEVEL.crotch)],
    ]
    const mirror = (pts: Pt[]) => pts.map(([x, y]) => [-x, y] as Pt)

    const rightPts = right
    const leftOuterUp = mirror(right).reverse()
    const leftInner = mirror(inner)

    const R = (p: Pt): Pt => [cx + p[0], p[1]]
    const first = R(rightPts[0])
    body = `M${first[0].toFixed(1)} ${first[1].toFixed(1)}`
    body += smoothThrough(rightPts.map(R))
    // pé direito (arredondado) e subida pela perna interna direita
    const footR = R(rightPts[rightPts.length - 1])
    const footRIn = R(inner[0])
    body += ` Q${((footR[0] + footRIn[0]) / 2).toFixed(1)} ${(footR[1] + 14).toFixed(1)} ${footRIn[0].toFixed(1)} ${footRIn[1].toFixed(1)}`
    body += smoothThrough(inner.map(R))
    // virilha -> perna interna esquerda
    const crotch = R(inner[inner.length - 1])
    const innerL = leftInner.slice().reverse().map(R)
    body += ` L${crotch[0].toFixed(1)} ${crotch[1].toFixed(1)}`
    body += smoothThrough([crotch, ...innerL.slice(1)])
    const footLIn = innerL[innerL.length - 1]
    const footLOut = R(leftOuterUp[0])
    body += ` Q${((footLIn[0] + footLOut[0]) / 2).toFixed(1)} ${(footLIn[1] + 14).toFixed(1)} ${footLOut[0].toFixed(1)} ${footLOut[1].toFixed(1)}`
    body += smoothThrough(leftOuterUp.map(R))
    body += ' Z'

    // braços: afastados do tronco, cônicos (ombro -> cotovelo -> punho -> mão)
    const armHalfTop = arm.a * s * 1.0
    const armHalfElbow = arm.a * s * 0.8
    const armHalfWrist = arm.a * s * 0.55
    const sh = shoulderHalf * 0.93
    const dx = bHalf * 0.55 + 14 // afastamento do braço
    const drawArm = (sign: 1 | -1): string => {
      const p = (x: number, y: number): Pt => [cx + sign * x, y]
      const top = p(sh, Y(LEVEL.shoulder) + 10)
      const elbow = p(sh + dx * 0.45, Y(LEVEL.elbow))
      const wrist = p(sh + dx * 0.8, Y(LEVEL.wrist))
      const hand = p(sh + dx * 0.95, Y(LEVEL.fingertip))
      const outer: Pt[] = [
        [top[0] + sign * armHalfTop, top[1]],
        [elbow[0] + sign * armHalfElbow, elbow[1]],
        [wrist[0] + sign * armHalfWrist, wrist[1]],
        [hand[0] + sign * armHalfWrist * 0.9, hand[1] - 8],
      ]
      const innerA: Pt[] = [
        [hand[0] - sign * armHalfWrist * 0.9, hand[1] - 8],
        [wrist[0] - sign * armHalfWrist, wrist[1]],
        [elbow[0] - sign * armHalfElbow, elbow[1]],
        [top[0] - sign * armHalfTop * 0.9, top[1] + 4],
      ]
      const cap = armHalfTop * 1.18
      let d = `M${(top[0] - sign * armHalfTop * 0.95).toFixed(1)} ${(top[1] + 6).toFixed(1)}`
      d += ` Q${(top[0] - sign * armHalfTop * 0.4).toFixed(1)} ${(top[1] - cap * 0.9).toFixed(1)} ${outer[0][0].toFixed(1)} ${(outer[0][1] + 2).toFixed(1)}`
      d += smoothThrough(outer)
      d += ` Q${hand[0].toFixed(1)} ${(hand[1] + 6).toFixed(1)} ${innerA[0][0].toFixed(1)} ${innerA[0][1].toFixed(1)}`
      d += smoothThrough(innerA)
      d += ' Z'
      return d
    }
    arms.push(drawArm(1), drawArm(-1))

    stations.push(
      { key: 'neck', label: 'Pescoço', y: Y(LEVEL.chin) + 12, edgeX: cx + nHalf * 1.1, valueCm: m.neck, measured: m.provided.neck },
      { key: 'bust', label: 'Busto', y: Y(LEVEL.bust), edgeX: cx + bHalf, valueCm: m.bust, measured: m.provided.bust },
      { key: 'waist', label: 'Cintura', y: Y(LEVEL.waist), edgeX: cx + wHalf, valueCm: m.waist, measured: m.provided.waist },
      { key: 'hip', label: 'Quadril', y: Y(LEVEL.hip), edgeX: cx + hHalf, valueCm: m.hip, measured: m.provided.hip },
      { key: 'arm', label: 'Braço', y: Y(0.74), edgeX: cx - (sh + armHalfTop * 0.6), valueCm: m.arm, measured: m.provided.arm },
      { key: 'thigh', label: 'Coxa', y: Y(LEVEL.thigh), edgeX: cx + legC + tHalf, valueCm: m.thigh, measured: m.provided.thigh },
      { key: 'calf', label: 'Panturrilha', y: Y(LEVEL.calf), edgeX: cx + legC * 0.84 + cHalf, valueCm: m.calf, measured: m.provided.calf },
    )
  } else {
    // ---- lado: perfil com curvas anterior e posterior ----
    const lvl = (f: number) => Y(f)
    const ant = (axes: { a: number; b: number }, front: number) => axes.b * 2 * s * front
    const post = (axes: { a: number; b: number }, front: number) => axes.b * 2 * s * (1 - front)
    const rows: { f: number; axes: { a: number; b: number }; front: number; shift: number }[] = [
      { f: LEVEL.chin, axes: neck, front: 0.55, shift: 2 },
      { f: LEVEL.neckBase, axes: neck, front: 0.5, shift: 1 },
      { f: 0.815, axes: { a: (neck.a + bust.a * 0.74) / 2, b: (neck.b * 1.15 + bust.b * 0.74) / 2 }, front: 0.5, shift: 1 },
      { f: 0.79, axes: { a: bust.a * 0.74, b: bust.b * 0.74 }, front: 0.5, shift: 1 },
      { f: LEVEL.armpit, axes: bust, front: 0.62, shift: 0 },
      { f: LEVEL.bust, axes: bust, front: 0.66, shift: 0 },
      { f: LEVEL.underbust, axes: waist, front: 0.58, shift: 0 },
      { f: LEVEL.waist, axes: waist, front: 0.52, shift: -1 },
      { f: LEVEL.abdomen, axes: waist, front: 0.6, shift: -2 },
      { f: LEVEL.hip, axes: hip, front: 0.4, shift: -3 },
      { f: LEVEL.thigh, axes: thigh, front: 0.45, shift: -2 },
      { f: LEVEL.knee, axes: { a: thigh.a * 0.72, b: thigh.b * 0.72 }, front: 0.5, shift: 0 },
      { f: LEVEL.calf, axes: calf, front: 0.42, shift: 1 },
      { f: LEVEL.ankle, axes: { a: calf.a * 0.5, b: calf.b * 0.5 }, front: 0.5, shift: 1 },
    ]
    const front: Pt[] = rows.map((r) => [cx + r.shift + ant(r.axes, r.front), lvl(r.f)])
    const back: Pt[] = rows.map((r) => [cx + r.shift - post(r.axes, r.front), lvl(r.f)])
    const last = rows[rows.length - 1]
    const toeX = cx + last.shift + ant(last.axes, last.front) + 26
    body = `M${front[0][0].toFixed(1)} ${front[0][1].toFixed(1)}`
    body += smoothThrough(front)
    body += ` L${front[front.length - 1][0].toFixed(1)} ${(Y(0.012)).toFixed(1)} Q${toeX.toFixed(1)} ${(Y(0.012) + 10).toFixed(1)} ${(toeX - 6).toFixed(1)} ${(Y(0) + 2).toFixed(1)}`
    body += ` L${back[back.length - 1][0].toFixed(1)} ${(Y(0) + 2).toFixed(1)} L${back[back.length - 1][0].toFixed(1)} ${(Y(0.012)).toFixed(1)}`
    body += smoothThrough([...back].reverse())
    body += ' Z'

    // braço de lado, caído junto ao corpo
    const armW = arm.b * s
    const ax = cx - 2
    const aTop = Y(LEVEL.shoulder) + 8
    const aElbow = Y(LEVEL.elbow)
    const aWrist = Y(LEVEL.wrist)
    const aHand = Y(LEVEL.fingertip)
    arms.push(
      `M${(ax - armW).toFixed(1)} ${aTop.toFixed(1)}` +
        smoothThrough([
          [ax - armW, aTop],
          [ax - armW * 0.85, aElbow],
          [ax - armW * 0.58, aWrist],
          [ax - armW * 0.5, aHand - 8],
        ]) +
        ` Q${ax.toFixed(1)} ${(aHand + 5).toFixed(1)} ${(ax + armW * 0.5).toFixed(1)} ${(aHand - 8).toFixed(1)}` +
        smoothThrough([
          [ax + armW * 0.5, aHand - 8],
          [ax + armW * 0.58, aWrist],
          [ax + armW * 0.85, aElbow],
          [ax + armW, aTop],
        ]) +
        ' Z',
    )
    stations.push(
      { key: 'neck', label: 'Pescoço', y: Y(LEVEL.chin) + 12, edgeX: cx + 2 + ant(neck, 0.55), valueCm: m.neck, measured: m.provided.neck },
      { key: 'bust', label: 'Busto', y: Y(LEVEL.bust), edgeX: cx + ant(bust, 0.66), valueCm: m.bust, measured: m.provided.bust },
      { key: 'waist', label: 'Cintura', y: Y(LEVEL.waist), edgeX: cx - 1 + ant(waist, 0.52), valueCm: m.waist, measured: m.provided.waist },
      { key: 'hip', label: 'Quadril', y: Y(LEVEL.hip), edgeX: cx - 3 + ant(hip, 0.4), valueCm: m.hip, measured: m.provided.hip },
      { key: 'thigh', label: 'Coxa', y: Y(LEVEL.thigh), edgeX: cx - 2 + ant(thigh, 0.45), valueCm: m.thigh, measured: m.provided.thigh },
      { key: 'calf', label: 'Panturrilha', y: Y(LEVEL.calf), edgeX: cx + 1 + ant(calf, 0.42), valueCm: m.calf, measured: m.provided.calf },
    )
  }

  // cabeça e pescoço
  const headH = (LEVEL.crown - LEVEL.chin) * BODY_PX
  const head = { cx: cx + (side ? 3 : 0), cy: TOP + headH * 0.5, rx: headH * (side ? 0.4 : 0.36), ry: headH * 0.5 }
  const neckTop = Y(LEVEL.chin) - 8
  const neckBottom = Y(LEVEL.neckBase) + 4
  const nW = neck.a * s * (side ? 0.8 : 1)
  const neckPath = `M${(cx + (side ? 2 : 0) - nW).toFixed(1)} ${neckTop.toFixed(1)} L${(cx + (side ? 2 : 0) + nW).toFixed(1)} ${neckTop.toFixed(1)} L${(cx + (side ? 2 : 0) + nW * 1.12).toFixed(1)} ${neckBottom.toFixed(1)} L${(cx + (side ? 2 : 0) - nW * 1.12).toFixed(1)} ${neckBottom.toFixed(1)} Z`
  // coque simples no alto da cabeça (identidade feminina sem rosto)
  const hair = `M${(head.cx - head.rx * 1.0).toFixed(1)} ${(head.cy - head.ry * 0.2).toFixed(1)} C${(head.cx - head.rx * 1.1).toFixed(1)} ${(head.cy - head.ry * 1.15).toFixed(1)} ${(head.cx + head.rx * 1.1).toFixed(1)} ${(head.cy - head.ry * 1.15).toFixed(1)} ${(head.cx + head.rx * 1.0).toFixed(1)} ${(head.cy - head.ry * 0.2).toFixed(1)} C${(head.cx + head.rx * 0.7).toFixed(1)} ${(head.cy - head.ry * 0.62).toFixed(1)} ${(head.cx - head.rx * 0.7).toFixed(1)} ${(head.cy - head.ry * 0.62).toFixed(1)} ${(head.cx - head.rx * 1.0).toFixed(1)} ${(head.cy - head.ry * 0.2).toFixed(1)} Z`

  return { width: CANVAS_W, height: CANVAS_H, cx, top: TOP, scale: s, body, neck: neckPath, arms, head, hair, stations }
}
