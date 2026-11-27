import { useEffect, useRef } from 'react'
import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  PCFSoftShadowMap,
  PlaneGeometry,
  ShadowMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import type { BufferGeometry, Material } from 'three'
import { mountScene } from '../lib/scene3d'
import { cycleMix, mixPose, motionFor } from '../lib/exercisePoses'
import type { Pose, Track } from '../lib/exercisePoses'

// A mulher 3D do Exercite Diário: corpo estilizado (cabelo preso em coque, top
// e legging nas cores do Círcula), articulações de verdade (quadril, joelho,
// tornozelo, ombro, cotovelo, coluna e pescoço) e a execução animada: posição
// inicial → desenvolvimento → retorno. A seta mostra o caminho da parte do
// corpo que mais se move. Cada pose é "assentada" no chão automaticamente.

const DEG = Math.PI / 180
const COLORS = { skin: 0xd7a387, top: 0x634838, legging: 0x382a23, hair: 0x2b1c15, shoe: 0xe6d9c8, mat: 0xd5bea4, wood: 0x917965, wall: 0xe9dfd2, bottle: 0x9cc7d8 }

interface Rig {
  root: Group
  body: Group
  spine: Group
  /** parte de cima da coluna (a curva das costas divide-se entre as duas) */
  upper: Group
  neck: Group
  head: Group
  lSh: Group
  rSh: Group
  lEl: Group
  rEl: Group
  lHip: Group
  rHip: Group
  lKn: Group
  rKn: Group
  lAn: Group
  rAn: Group
  lHand: Object3D
  rHand: Object3D
  samples: { obj: Object3D; local: Vector3; r: number }[]
}

function buildWoman(track: <T extends BufferGeometry | Material>(x: T) => T, bottles: boolean): Rig {
  const mat = (color: number, rough = 0.6, sheen = 0.3) => track(new MeshPhysicalMaterial({ color, roughness: rough, sheen, sheenRoughness: 0.6, clearcoat: 0.05 }))
  const skin = mat(COLORS.skin, 0.55, 0.5)
  const top = mat(COLORS.top, 0.75, 0.6)
  const legging = mat(COLORS.legging, 0.6, 0.5)
  const hair = mat(COLORS.hair, 0.5, 0.8)
  const shoe = mat(COLORS.shoe, 0.5)
  const cap = (r: number, len: number) => track(new CapsuleGeometry(r, len, 6, 14))
  const sph = (r: number) => track(new SphereGeometry(r, 22, 16))
  const mesh = (g: BufferGeometry, m: Material, x = 0, y = 0, z = 0) => {
    const me = new Mesh(g, m)
    me.position.set(x, y, z)
    me.castShadow = true
    return me
  }
  const grp = (x = 0, y = 0, z = 0) => {
    const g = new Group()
    g.position.set(x, y, z)
    return g
  }

  const root = new Group()
  const body = new Group()
  root.add(body)

  // quadril (pelve) — mais largo, feminino
  const hips = mesh(sph(0.16), legging)
  hips.scale.set(1.12, 0.78, 0.86)
  body.add(hips)

  // pernas
  const leg = (side: 1 | -1) => {
    const hip = grp(0.092 * side, -0.05, 0)
    const thigh = mesh(cap(0.074, 0.3), legging, 0, -0.21, 0)
    hip.add(thigh)
    const knee = grp(0, -0.43, 0)
    hip.add(knee)
    knee.add(mesh(cap(0.056, 0.3), legging, 0, -0.19, 0))
    const ankle = grp(0, -0.41, 0)
    knee.add(ankle)
    const foot = mesh(cap(0.04, 0.12), shoe, 0, -0.035, 0.055)
    foot.rotation.x = Math.PI / 2
    ankle.add(foot)
    body.add(hip)
    return { hip, knee, ankle }
  }
  const L = leg(1)
  const R = leg(-1)

  // tronco
  const spine = grp(0, 0.05, 0)
  body.add(spine)
  const waist = mesh(cap(0.105, 0.1), top, 0, 0.1, 0)
  waist.scale.set(1, 1, 0.82)
  spine.add(waist)
  const upper = grp(0, 0.15, 0)
  spine.add(upper)
  const chest = mesh(sph(0.155), top, 0, 0.12, 0)
  chest.scale.set(1.05, 1.08, 0.78)
  upper.add(chest)
  for (const s of [1, -1]) upper.add(mesh(sph(0.062), top, 0.062 * s, 0.1, 0.085))

  const neck = grp(0, 0.26, 0)
  upper.add(neck)
  neck.add(mesh(cap(0.043, 0.05), skin, 0, 0.03, 0))
  const head = grp(0, 0.08, 0)
  neck.add(head)
  const skull = mesh(sph(0.1), skin, 0, 0.075, 0.005)
  skull.scale.set(0.92, 1.06, 1)
  head.add(skull)
  const hairCap = mesh(sph(0.106), hair, 0, 0.09, -0.012)
  hairCap.scale.set(0.96, 1.04, 1)
  head.add(hairCap)
  head.add(mesh(sph(0.055), hair, 0, 0.16, -0.085))

  // braços
  const arm = (side: 1 | -1) => {
    const sh = grp(0.178 * side, 0.21, 0)
    upper.add(sh)
    sh.add(mesh(sph(0.052), top, 0, 0, 0))
    sh.add(mesh(cap(0.043, 0.2), skin, 0, -0.14, 0))
    const el = grp(0, -0.28, 0)
    sh.add(el)
    el.add(mesh(cap(0.036, 0.19), skin, 0, -0.13, 0))
    const hand = mesh(sph(0.042), skin, 0, -0.27, 0.005)
    hand.scale.set(0.85, 1.15, 0.7)
    el.add(hand)
    if (bottles) {
      const b = mesh(track(new CylinderGeometry(0.033, 0.033, 0.2, 14)), track(new MeshPhysicalMaterial({ color: COLORS.bottle, roughness: 0.15, transmission: 0, transparent: true, opacity: 0.85, clearcoat: 1 })), 0, -0.28, 0.0)
      b.rotation.x = Math.PI / 2
      el.add(b)
    }
    return { sh, el, hand }
  }
  const LA = arm(1)
  const RA = arm(-1)

  const v = (x: number, y: number, z: number) => new Vector3(x, y, z)
  const samples = [
    { obj: L.ankle, local: v(0, -0.07, -0.03), r: 0.01 },
    { obj: L.ankle, local: v(0, -0.07, 0.14), r: 0.01 },
    { obj: R.ankle, local: v(0, -0.07, -0.03), r: 0.01 },
    { obj: R.ankle, local: v(0, -0.07, 0.14), r: 0.01 },
    { obj: L.knee, local: v(0, 0, 0), r: 0.058 },
    { obj: R.knee, local: v(0, 0, 0), r: 0.058 },
    { obj: L.knee, local: v(0, -0.2, 0), r: 0.056 },
    { obj: R.knee, local: v(0, -0.2, 0), r: 0.056 },
    { obj: LA.hand, local: v(0, 0, 0), r: 0.04 },
    { obj: RA.hand, local: v(0, 0, 0), r: 0.04 },
    { obj: LA.el, local: v(0, 0, 0), r: 0.038 },
    { obj: RA.el, local: v(0, 0, 0), r: 0.038 },
    { obj: body, local: v(0, -0.02, 0), r: 0.13 },
    { obj: upper, local: v(0, 0.12, 0), r: 0.125 },
    { obj: spine, local: v(0, 0.12, 0), r: 0.1 },
    { obj: head, local: v(0, 0.075, 0), r: 0.105 },
    { obj: LA.sh, local: v(0, 0, 0), r: 0.055 },
    { obj: RA.sh, local: v(0, 0, 0), r: 0.055 },
  ]
  return { root, body, spine, upper, neck, head, lSh: LA.sh, rSh: RA.sh, lEl: LA.el, rEl: RA.el, lHip: L.hip, rHip: R.hip, lKn: L.knee, rKn: R.knee, lAn: L.ankle, rAn: R.ankle, lHand: LA.hand, rHand: RA.hand, samples }
}

function applyPose(rig: Rig, p: Pose, flatFeet: boolean) {
  const g = (k: keyof Pose) => (p[k] ?? 0) * DEG
  rig.body.rotation.set(g('pitch'), 0, g('roll'))
  rig.spine.rotation.set(g('spine') * 0.45, g('twist') * 0.5, 0)
  rig.upper.rotation.set(g('spine') * 0.55, g('twist') * 0.5, 0)
  rig.neck.rotation.set(g('neck') * 0.5, 0, 0)
  rig.head.rotation.set(g('neck') * 0.5, 0, 0)
  rig.lSh.rotation.set(-g('lShFlex'), 0, g('lShAbd'), 'ZXY')
  rig.rSh.rotation.set(-g('rShFlex'), 0, -g('rShAbd'), 'ZXY')
  rig.lEl.rotation.set(-g('lElbow'), 0, 0)
  rig.rEl.rotation.set(-g('rElbow'), 0, 0)
  rig.lHip.rotation.set(-g('lHipFlex'), 0, g('lHipAbd'), 'ZXY')
  rig.rHip.rotation.set(-g('rHipFlex'), 0, -g('rHipAbd'), 'ZXY')
  rig.lKn.rotation.set(g('lKnee'), 0, 0)
  rig.rKn.rotation.set(g('rKnee'), 0, 0)
  // pé apoiado no chão nos exercícios em pé (o tornozelo compensa a inclinação da perna)
  const flat = (hip: number, knee: number) => (flatFeet ? -(g('pitch') - hip + knee) : 0)
  rig.lAn.rotation.set(flat(g('lHipFlex'), g('lKnee')) + g('lAnkle'), 0, 0)
  rig.rAn.rotation.set(flat(g('rHipFlex'), g('rKnee')) + g('rAnkle'), 0, 0)
}

const tmp = new Vector3()
function worldOf(o: Object3D, local: Vector3, out = new Vector3()) {
  return out.copy(local).applyMatrix4(o.matrixWorld)
}

/** Assenta a pose no chão e mantém o ponto de apoio (pés, mãos, joelhos ou quadril) no lugar. */
function ground(rig: Rig, anchor: string) {
  rig.root.position.set(0, 0, 0)
  rig.root.updateMatrixWorld(true)
  let minY = Infinity
  for (const s of rig.samples) {
    worldOf(s.obj, s.local, tmp)
    minY = Math.min(minY, tmp.y - s.r)
  }
  const pts: Vector3[] =
    anchor === 'feet'
      ? [worldOf(rig.lAn, new Vector3()), worldOf(rig.rAn, new Vector3())]
      : anchor === 'hands'
        ? [worldOf(rig.lHand, new Vector3()), worldOf(rig.rHand, new Vector3())]
        : anchor === 'knees'
          ? [worldOf(rig.lKn, new Vector3()), worldOf(rig.rKn, new Vector3())]
          : [worldOf(rig.body, new Vector3())]
  // o grupo de cima só gira em Y: a altura vale igual; x/z vão para o espaço dele
  const parent = rig.root.parent
  const local = pts.map((p) => (parent ? parent.worldToLocal(p) : p))
  const ax = local.reduce((s, p) => s + p.x, 0) / local.length
  const az = local.reduce((s, p) => s + p.z, 0) / local.length
  rig.root.position.set(-ax, -minY, -az)
  rig.root.updateMatrixWorld(true)
}

function trackPoint(rig: Rig, t: Track): Vector3 {
  const o =
    t === 'pelvis' ? rig.body : t === 'lHand' ? rig.lHand : t === 'rHand' ? rig.rHand : t === 'lFoot' ? rig.lAn : t === 'rFoot' ? rig.rAn : t === 'head' ? rig.head : t === 'chest' ? rig.upper : t === 'lKnee' ? rig.lKn : rig.rKn
  const local = t === 'head' ? new Vector3(0, 0.08, 0) : t === 'chest' ? new Vector3(0, 0.12, 0.1) : new Vector3()
  return worldOf(o, local)
}

const YAW = { side: -82, three: -42, front: -14 }

export default function ExerciseWoman3D({ slug, playing = true, still, onFail }: { slug: string; playing?: boolean; /** Pose parada (0 = início, 1 = fim), para conferência. */ still?: number; onFail?: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const dotRef = useRef<SVGCircleElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const playingRef = useRef(playing)
  useEffect(() => {
    playingRef.current = playing
  }, [playing])
  const failRef = useRef(onFail)
  useEffect(() => {
    failRef.current = onFail
  }, [onFail])
  const { motion } = motionFor(slug)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const { motion: mo } = motionFor(slug)
    const flatFeet = mo.anchor === 'feet'
    return mountScene(
      host,
      { fov: 28, position: [0, 1, 6], look: [0, 0.8, 0], className: 'exw-canvas', exposure: 1.05, envIntensity: 0.8 },
      ({ scene, camera, renderer, track }) => {
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = PCFSoftShadowMap
        scene.add(new HemisphereLight(0xfff4e8, 0x9b8370, 0.65))
        const sun = new DirectionalLight(0xffffff, 1.6)
        sun.position.set(-2.2, 5, 3)
        sun.castShadow = true
        sun.shadow.mapSize.set(1024, 1024)
        sun.shadow.radius = 4
        sun.shadow.camera.left = -2.5
        sun.shadow.camera.right = 2.5
        sun.shadow.camera.top = 2.5
        sun.shadow.camera.bottom = -2.5
        scene.add(sun)

        const world = new Group()
        world.rotation.y = YAW[mo.view] * DEG
        scene.add(world)
        const floor = new Mesh(track(new PlaneGeometry(8, 8)), track(new ShadowMaterial({ opacity: 0.16 })))
        floor.rotation.x = -Math.PI / 2
        floor.receiveShadow = true
        scene.add(floor)

        const rig = buildWoman(track, !!mo.props?.includes('bottles'))
        world.add(rig.root)

        // poses A e B assentadas: limites para enquadrar a câmera e o caminho da seta
        const bounds = { minX: Infinity, maxX: -Infinity, minY: 0, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity }
        const arrowA = new Vector3()
        const arrowB = new Vector3()
        for (const [pose, out] of [
          [mo.a, arrowA],
          [mo.b, arrowB],
        ] as const) {
          applyPose(rig, pose, flatFeet)
          ground(rig, mo.anchor)
          scene.updateMatrixWorld(true)
          for (const s of rig.samples) {
            worldOf(s.obj, s.local, tmp)
            world.worldToLocal(tmp)
            bounds.minX = Math.min(bounds.minX, tmp.x - s.r)
            bounds.maxX = Math.max(bounds.maxX, tmp.x + s.r)
            bounds.maxY = Math.max(bounds.maxY, tmp.y + s.r)
            bounds.minZ = Math.min(bounds.minZ, tmp.z - s.r)
            bounds.maxZ = Math.max(bounds.maxZ, tmp.z + s.r)
          }
          if (mo.track) out.copy(trackPoint(rig, mo.track))
        }

        // objetos de apoio
        const propMat = (c: number) => track(new MeshPhysicalMaterial({ color: c, roughness: 0.7 }))
        const addLocal = (m: Mesh) => {
          m.castShadow = true
          m.receiveShadow = true
          world.add(m)
          return m
        }
        const ctr = new Vector3()
        if (mo.props?.includes('mat')) {
          const matMesh = addLocal(new Mesh(track(new BoxGeometry(0.7, 0.012, 1.9)), propMat(COLORS.mat)))
          applyPose(rig, mo.a, flatFeet)
          ground(rig, mo.anchor)
          worldOf(rig.body, new Vector3(), ctr)
          world.worldToLocal(ctr)
          matMesh.position.set(ctr.x, 0.006, ctr.z)
          matMesh.rotation.y = 0
          // o tapete segue o comprimento do corpo
          const head = world.worldToLocal(trackPoint(rig, 'head'))
          matMesh.rotation.y = Math.atan2(head.x - ctr.x, head.z - ctr.z)
        }
        if (mo.props?.includes('chair')) {
          applyPose(rig, mo.a, flatFeet)
          ground(rig, mo.anchor)
          const wood = propMat(COLORS.wood)
          // sentar: assento sob o quadril; tríceps: mãos no assento atrás; flexão inclinada: mãos no assento à frente
          const handsMode = (mo.a.lShFlex ?? 0) < 0 ? 'behind' : (mo.a.pitch ?? 0) > 0 ? 'front' : null
          let seatY = 0.45
          let seatZ = 0
          let seatX = 0
          if (handsMode) {
            worldOf(rig.lHand, new Vector3(), ctr)
            const r2 = worldOf(rig.rHand, new Vector3())
            ctr.add(r2).multiplyScalar(0.5)
            world.worldToLocal(ctr)
            seatY = Math.max(0.3, ctr.y - 0.06)
            seatZ = ctr.z + (handsMode === 'behind' ? -0.1 : 0.1)
            seatX = ctr.x
          } else {
            worldOf(rig.body, new Vector3(), ctr)
            world.worldToLocal(ctr)
            seatY = Math.max(0.3, ctr.y - 0.14)
            seatZ = ctr.z - 0.05
            seatX = ctr.x
          }
          const backSide = handsMode === 'front' ? 1 : -1
          const seat = addLocal(new Mesh(track(new BoxGeometry(0.42, 0.04, 0.42)), wood))
          seat.position.set(seatX, seatY, seatZ)
          const back = addLocal(new Mesh(track(new BoxGeometry(0.42, 0.42, 0.035)), wood))
          back.position.set(seatX, seatY + 0.23, seatZ + 0.2 * backSide)
          const ctrX = seatX
          const ctrZ = seatZ
          ctr.set(ctrX, 0, ctrZ)
          const zOff = 0
          for (const [dx, dz] of [
            [0.18, 0.18],
            [-0.18, 0.18],
            [0.18, -0.18],
            [-0.18, -0.18],
          ]) {
            const legM = addLocal(new Mesh(track(new BoxGeometry(0.03, seatY, 0.03)), wood))
            legM.position.set(ctr.x + dx, seatY / 2, ctr.z + zOff + dz)
          }
        }
        if (mo.props?.includes('step')) {
          const st = addLocal(new Mesh(track(new BoxGeometry(0.5, 0.18, 0.35)), propMat(COLORS.wood)))
          st.position.set(0.09, 0.09, 0.28)
        }
        const wallFront = mo.props?.includes('wall-front')
        if (wallFront || mo.props?.includes('wall-back')) {
          const wall = addLocal(new Mesh(track(new BoxGeometry(1.6, 2.2, 0.05)), propMat(COLORS.wall)))
          const reach = wallFront ? bounds.maxZ + 0.03 : bounds.minZ - 0.03
          wall.position.set(0, 1.1, reach + (wallFront ? 0.025 : -0.025))
        }

        // enquadramento: centro e distância pelo tamanho do movimento todo
        const cx = (bounds.minX + bounds.maxX) / 2
        const cz = (bounds.minZ + bounds.maxZ) / 2
        const center = new Vector3(cx, (bounds.minY + bounds.maxY) / 2, cz)
        world.localToWorld(center)
        const span = Math.max(bounds.maxY - bounds.minY, Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) * 0.98, 1.1)
        const dist = (span * 1.12) / (2 * Math.tan((28 * DEG) / 2))
        camera.position.set(center.x, center.y + span * 0.22, center.z + dist)
        camera.lookAt(center.x, center.y - span * 0.04, center.z)

        let phase = 0
        const proj = new Vector3()
        const toScreen = (p: Vector3) => {
          proj.copy(p).project(camera)
          return [((proj.x + 1) / 2) * host.clientWidth, ((1 - proj.y) / 2) * host.clientHeight] as const
        }
        const period = mo.period ?? (mo.hold ? 5 : 3.4)

        return {
          update(_t, dt) {
            if (playingRef.current) phase = (phase + dt / period) % 1
            const mix = still ?? cycleMix(phase, mo.hold)
            applyPose(rig, mixPose(mo.a, mo.b, mix), flatFeet)
            ground(rig, mo.anchor)
            // seta do movimento: de A até B, com o ponto andando junto
            if (mo.track && pathRef.current && dotRef.current && svgRef.current) {
              const a = toScreen(arrowA)
              const b = toScreen(arrowB)
              const mx = (a[0] + b[0]) / 2
              const my = (a[1] + b[1]) / 2
              const dx = b[0] - a[0]
              const dy = b[1] - a[1]
              const len = Math.hypot(dx, dy) || 1
              // curva para fora do corpo, ao lado do caminho
              const off = Math.min(46, len * 0.32)
              const cxp = mx + (-dy / len) * off
              const cyp = my + (dx / len) * off
              svgRef.current.setAttribute('viewBox', `0 0 ${host.clientWidth} ${host.clientHeight}`)
              pathRef.current.setAttribute('d', `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${cxp.toFixed(1)},${cyp.toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`)
              const u = mix
              const qx = (1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * cxp + u * u * b[0]
              const qy = (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * cyp + u * u * b[1]
              dotRef.current.setAttribute('cx', qx.toFixed(1))
              dotRef.current.setAttribute('cy', qy.toFixed(1))
              svgRef.current.style.opacity = len > 14 ? '1' : '0'
            }
          },
        }
      },
      () => failRef.current?.(),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  return (
    <div className="exw" ref={hostRef}>
      {motion.track && (
        <svg className="exw-arrow" ref={svgRef} aria-hidden="true">
          <defs>
            <marker id={`exw-head-${slug}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
            </marker>
          </defs>
          <path ref={pathRef} className="exw-arrow-path" markerStart={`url(#exw-head-${slug})`} markerEnd={`url(#exw-head-${slug})`} />
          <circle ref={dotRef} r="5" className="exw-arrow-dot" />
        </svg>
      )}
      {motion.hold && <span className="exw-hold">Segure a posição</span>}
    </div>
  )
}
