import { useEffect, useRef } from 'react'
import {
  ACESFilmicToneMapping,
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PMREMGenerator,
  PerspectiveCamera,
  Scene,
  Shape,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { easeToward } from '../lib/waterBottle3d'
import { BAND_WIDTH, HABIT_KEYS, dressProfile, grayMix, propTargets } from '../lib/doll3d'
import type { HabitPropKey } from '../lib/doll3d'
import { colorAmount } from '../lib/habits'
import type { ImcBand } from '../lib/imc'

// Boneca em 3D, toda de formas arredondadas (esferas, cápsulas e um vestido de
// revolução suavizado), com movimento: respira, balança, o cabelo e os braços
// acompanham, e ela gira com o arrasto do dedo. Dois usos:
//  • "habits" (Antes de Tudo): começa em preto e branco e ganha cor conforme os
//    hábitos do dia; cada hábito acende o seu adereço (sol, copo, tênis, livro,
//    aura da respiração, caderninho, coração);
//  • "imc": a silhueta sem adereços, com a cintura e o quadril acompanhando a
//    faixa do resultado. Só ilustração, sem rosto.
// Carregada sob demanda; libera tudo da GPU ao sair da tela.

interface Doll3DProps {
  mode: 'habits' | 'imc'
  /** Hábitos marcados hoje (modo "habits"). */
  done?: number
  checked?: ReadonlySet<string>
  /** Faixa do IMC (modo "imc"). */
  band?: ImcBand
  ariaLabel: string
  onFail?: () => void
}

const SKIN = 0xf1c7a4
const HAIR = 0x6b4226
const HAIR_FRONT = 0x55331c
const DRESS = 0xe58a8a
const IMC_DRESS = 0xd9b3a8
const IMC_SKIN = 0xe9c9c0

/** Mistura duas cores 0xRRGGBB (t = 0 a primeira, t = 1 a segunda). */
function lerpHex(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t))
  const ch = (shift: number) => Math.round(((a >> shift) & 255) + ((((b >> shift) & 255) - ((a >> shift) & 255)) * k))
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

function roundedRect(w: number, h: number, r: number): Shape {
  const x = -w / 2
  const y = -h / 2
  const s = new Shape()
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

function heartShape(): Shape {
  const s = new Shape()
  s.moveTo(0, -0.5)
  s.bezierCurveTo(-0.15, -0.35, -0.55, -0.1, -0.5, 0.2)
  s.bezierCurveTo(-0.46, 0.5, -0.1, 0.6, 0, 0.32)
  s.bezierCurveTo(0.1, 0.6, 0.46, 0.5, 0.5, 0.2)
  s.bezierCurveTo(0.55, -0.1, 0.15, -0.35, 0, -0.5)
  return s
}

/** Pontos suavizados (curva de Catmull-Rom) do vestido: linhas bem arredondadas. */
function smoothDress(f: number): Vector2[] {
  const pts = dressProfile(f).map(([r, y]) => new Vector3(r, y, 0))
  return new CatmullRomCurve3(pts, false, 'catmullrom', 0.5).getPoints(64).map((p) => new Vector2(Math.max(0.01, p.x), p.y))
}

interface Tint {
  mat: MeshStandardMaterial | MeshBasicMaterial
  base: number
}

export default function Doll3D({ mode, done = 0, checked, band = 'referencia', ariaLabel, onFail }: Doll3DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef({ done, checked: checked ?? new Set<string>(), band })
  const failRef = useRef(onFail)

  useEffect(() => {
    targetRef.current = { done, checked: checked ?? new Set<string>(), band }
  }, [done, checked, band])
  useEffect(() => {
    failRef.current = onFail
  }, [onFail])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const habits = mode === 'habits'

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      failRef.current?.()
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.setClearColor(0x000000, 0)
    const canvas = renderer.domElement
    canvas.className = 'doll3d-canvas'
    host.appendChild(canvas)

    const scene = new Scene()
    const camera = new PerspectiveCamera(28, 1, 0.1, 60)
    camera.position.set(0, habits ? 1.3 : 1.35, habits ? 10.4 : 7.6)
    camera.lookAt(0, habits ? 1.25 : 1.3, 0)

    const pmrem = new PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const envTarget = pmrem.fromScene(room, 0.04)
    scene.environment = envTarget.texture
    const key = new DirectionalLight(0xfff1e0, 1.5)
    key.position.set(2.5, 4, 5)
    scene.add(key)

    // ---- registro do que precisa ser liberado e do que ganha cor ----
    const geoms: BufferGeometry[] = []
    const mats: Material[] = []
    const tints: Tint[] = []
    const geo = <T extends BufferGeometry>(g: T): T => {
      geoms.push(g)
      return g
    }
    const std = (color: number, extra: { transparent?: boolean; roughness?: number; metalness?: number } = {}) => {
      const m = new MeshStandardMaterial({ color, roughness: extra.roughness ?? 0.55, metalness: extra.metalness ?? 0.02, transparent: extra.transparent ?? false })
      mats.push(m)
      tints.push({ mat: m, base: color })
      return m
    }
    const basic = (color: number, opacity = 1) => {
      const m = new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
      mats.push(m)
      tints.push({ mat: m, base: color })
      return m
    }

    const root = new Group()
    scene.add(root)

    // ---- corpo ----
    const skinColor = habits ? SKIN : IMC_SKIN
    const skin = std(skinColor)
    const dressMat = std(habits ? DRESS : IMC_DRESS, { roughness: 0.5 })
    const hairMat = std(HAIR, { roughness: 0.6 })
    const fringeMat = std(HAIR_FRONT, { roughness: 0.6 })

    const head = new Group()
    head.position.set(0, 2.62, 0)
    root.add(head)
    const headMesh = new Mesh(geo(new SphereGeometry(0.34, 40, 32)), skin)
    headMesh.scale.set(1, 1.08, 1)
    head.add(headMesh)
    if (habits) {
      const hairBack = new Mesh(geo(new SphereGeometry(0.385, 40, 32)), hairMat)
      hairBack.scale.set(1, 1.12, 0.95)
      hairBack.position.set(0, 0.03, -0.07)
      head.add(hairBack)
      const fringe = new Mesh(geo(new SphereGeometry(0.352, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.46)), fringeMat)
      fringe.position.set(0, 0.04, 0.025)
      fringe.rotation.x = 0.3
      head.add(fringe)
    }
    const hairLong = new Group()
    if (habits) {
      const longHair = new Mesh(geo(new CapsuleGeometry(0.22, 0.5, 8, 24)), hairMat)
      longHair.position.set(0, -0.42, -0.17)
      hairLong.add(longHair)
      head.add(hairLong)
    }

    const neck = new Mesh(geo(new CylinderGeometry(0.1, 0.12, 0.26, 24)), skin)
    neck.position.set(0, 2.27, 0)
    root.add(neck)

    // vestido: sólido de revolução suavizado; a largura muda com a faixa do IMC
    let dressGeo = geo(new LatheGeometry(smoothDress(1), 72))
    const dress = new Mesh(dressGeo, dressMat)
    dressMat.side = DoubleSide
    root.add(dress)
    let builtF = 1

    // braços, mãos e pernas (cápsulas)
    const armGeo = geo(new CapsuleGeometry(0.085, 0.6, 8, 20))
    const handGeo = geo(new SphereGeometry(0.095, 24, 20))
    const legGeo = geo(new CapsuleGeometry(0.1, 0.52, 8, 20))
    const arms: Group[] = []
    for (const side of [-1, 1]) {
      const arm = new Group()
      arm.position.set(side * 0.43, 1.93, 0)
      const limb = new Mesh(armGeo, skin)
      limb.position.set(0, -0.36, 0)
      arm.add(limb)
      const hand = new Mesh(handGeo, skin)
      hand.position.set(0, -0.72, 0)
      arm.add(hand)
      arm.rotation.z = -side * 0.3
      root.add(arm)
      arms.push(arm)
    }
    const legs: Mesh[] = []
    for (const side of [-1, 1]) {
      const leg = new Mesh(legGeo, skin)
      leg.position.set(side * 0.16, 0.1, 0)
      root.add(leg)
      legs.push(leg)
    }

    // tênis
    const shoeMat = std(0x4f9a57, { roughness: 0.45 })
    const shoeGeo = geo(new SphereGeometry(0.15, 28, 20))
    const shoes: Mesh[] = []
    for (const side of [-1, 1]) {
      const shoe = new Mesh(shoeGeo, habits ? shoeMat : skin)
      shoe.scale.set(1, 0.55, 1.55)
      shoe.position.set(side * 0.17, -0.32, 0.07)
      root.add(shoe)
      shoes.push(shoe)
    }

    // ---- adereços dos hábitos ----
    interface PropState {
      group: Group
      mats: Material[]
      appear: number
      boost: number
      was: number
      home: Vector3
    }
    const props = {} as Record<HabitPropKey, PropState>
    function addProp(keyName: HabitPropKey, group: Group, pm: Material[], home: Vector3) {
      group.position.copy(home)
      root.add(group)
      for (const m of pm) (m as MeshStandardMaterial).transparent = true
      props[keyName] = { group, mats: pm, appear: 0, boost: 0, was: 0, home }
    }

    if (habits) {
      // luz da manhã: sol com raios
      {
        const g = new Group()
        const sunMat = basic(0xf6c945, 1)
        g.add(new Mesh(geo(new SphereGeometry(0.2, 28, 22)), sunMat))
        const rayGeo = geo(new CapsuleGeometry(0.035, 0.13, 6, 12))
        const rays = new Group()
        for (let i = 0; i < 8; i += 1) {
          const a = (i * Math.PI) / 4
          const ray = new Mesh(rayGeo, sunMat)
          ray.position.set(Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0)
          ray.rotation.z = a + Math.PI / 2
          rays.add(ray)
        }
        rays.name = 'rays'
        g.add(rays)
        addProp('luz', g, [sunMat], new Vector3(1.3, 3.05, 0))
      }
      // espiritualidade: coração arredondado sobre a cabeça
      {
        const g = new Group()
        const heartMat = std(0xe4577a, { roughness: 0.35 })
        const hg = geo(
          new ExtrudeGeometry(heartShape(), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.08, bevelSegments: 8, curveSegments: 28 }),
        )
        hg.center()
        const heart = new Mesh(hg, heartMat)
        heart.scale.setScalar(0.4)
        g.add(heart)
        addProp('espiritualidade', g, [heartMat], new Vector3(0, 3.4, 0))
      }
      // água: copo na mão
      {
        const g = new Group()
        const glassMat = std(0xeaf4f8, { transparent: true, roughness: 0.1 })
        ;(glassMat as MeshStandardMaterial).opacity = 0.7
        const waterMat = std(0x6cb6d6, { roughness: 0.2 })
        const cup = new Mesh(geo(new CylinderGeometry(0.115, 0.085, 0.3, 28)), glassMat)
        const water = new Mesh(geo(new CylinderGeometry(0.098, 0.08, 0.17, 28)), waterMat)
        water.position.y = -0.055
        g.add(cup, water)
        g.rotation.z = 0.08
        addProp('agua', g, [glassMat, waterMat], new Vector3(-0.78, 1.15, 0.12))
      }
      // leitura: livro arredondado na outra mão
      {
        const g = new Group()
        const bookMat = std(0xb8453d, { roughness: 0.5 })
        const pageMat = std(0xf4e3df, { roughness: 0.7 })
        const bg = geo(new ExtrudeGeometry(roundedRect(0.34, 0.26, 0.04), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 5 }))
        bg.center()
        g.add(new Mesh(bg, bookMat))
        const pg = geo(new ExtrudeGeometry(roundedRect(0.3, 0.2, 0.02), { depth: 0.02, bevelEnabled: false }))
        pg.center()
        const pages = new Mesh(pg, pageMat)
        pages.position.z = 0.055
        g.add(pages)
        g.rotation.set(0.2, -0.4, -0.12)
        addProp('leitura', g, [bookMat, pageMat], new Vector3(0.8, 1.15, 0.14))
      }
      // organização: caderninho flutuando
      {
        const g = new Group()
        const noteMat = std(0xf2b35e, { roughness: 0.5 })
        const lineMat = std(0xffffff, { roughness: 0.6 })
        const ng = geo(new ExtrudeGeometry(roundedRect(0.4, 0.48, 0.06), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 5 }))
        ng.center()
        g.add(new Mesh(ng, noteMat))
        const lg = geo(new CapsuleGeometry(0.012, 0.22, 4, 8))
        for (let i = 0; i < 3; i += 1) {
          const l = new Mesh(lg, lineMat)
          l.rotation.z = Math.PI / 2
          l.scale.x = i === 2 ? 0.6 : 1
          l.position.set(i === 2 ? -0.05 : 0, 0.1 - i * 0.1, 0.08)
          g.add(l)
        }
        g.rotation.set(0.1, 0.35, -0.12)
        addProp('organizacao', g, [noteMat, lineMat], new Vector3(-1.2, 2.25, 0.1))
      }
      // respiração: aura suave atrás dela
      {
        const g = new Group()
        const auraMat = basic(0xd6ecec, 0.5)
        const aura = new Mesh(geo(new SphereGeometry(1.75, 40, 32)), auraMat)
        aura.position.z = -0.9
        g.add(aura)
        addProp('respiracao', g, [auraMat], new Vector3(0, 1.3, 0))
      }
      // exercício: o tênis acende (cor) — sem grupo próprio
      props.exercicio = { group: new Group(), mats: [shoeMat], appear: 0, boost: 0, was: 0, home: new Vector3() }
    }

    // ---- tamanho ----
    function resize() {
      const w = Math.max(1, host!.clientWidth)
      const h = Math.max(1, host!.clientHeight)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)

    // ---- arrastar para girar ----
    let dragging = false
    let dragStartX = 0
    let dragYaw = 0
    function onDown(e: PointerEvent) {
      dragging = true
      dragStartX = e.clientX - dragYaw * 110
      try {
        host!.setPointerCapture(e.pointerId)
      } catch {
        // sem captura: o arrasto segue pelos eventos normais
      }
    }
    function onMove(e: PointerEvent) {
      if (dragging) dragYaw = Math.max(-1.7, Math.min(1.7, (e.clientX - dragStartX) / 110))
    }
    function onUp() {
      dragging = false
    }
    host.addEventListener('pointerdown', onDown)
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerup', onUp)
    host.addEventListener('pointercancel', onUp)

    // ---- laço ----
    const reducedMotion = (() => {
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
      } catch {
        return false
      }
    })()
    let color = habits ? colorAmount(targetRef.current.done) : 1
    let widthF = BAND_WIDTH[targetRef.current.band]
    let time = 0
    let raf = 0
    let last = performance.now()
    let visible = true
    let disposed = false

    const shoeTint = tints.find((t) => t.mat === shoeMat)
    function applyColor() {
      for (const t of tints) t.mat.color.setHex(grayMix(t.base, color))
    }
    applyColor()

    function rebuildDress(f: number) {
      dressGeo.dispose()
      dressGeo = new LatheGeometry(smoothDress(f), 72)
      dress.geometry = dressGeo
      builtF = f
    }

    function draw(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      time += dt
      const t = reducedMotion ? 0 : time
      const { done: d, checked: c, band: b } = targetRef.current

      // cor aos poucos (só nos hábitos)
      if (habits) color = easeToward(color, colorAmount(d), dt, 0.5)
      if (shoeTint) shoeTint.base = habits ? lerpHex(0x9a9a9a, 0x4f9a57, props.exercicio.appear) : SKIN
      applyColor()

      // largura do corpo por faixa do IMC (suave)
      const wantF = habits ? 1 : BAND_WIDTH[b]
      widthF = easeToward(widthF, wantF, dt, 0.4)
      if (Math.abs(widthF - builtF) > 0.004) rebuildDress(widthF)
      const legX = 0.16 * (0.82 + 0.18 * widthF)
      legs[0].position.x = -legX
      legs[1].position.x = legX
      shoes[0].position.x = -legX - 0.01
      shoes[1].position.x = legX + 0.01

      // respiração, balanço e flutuação
      const breathe = Math.sin(t * 1.6)
      dress.scale.set(1 + breathe * 0.006, 1 + breathe * 0.012, 1 + breathe * 0.006)
      head.position.y = 2.62 + breathe * 0.012
      head.rotation.z = Math.sin(t * 0.9) * 0.045
      head.rotation.y = Math.sin(t * 0.6) * 0.12
      hairLong.rotation.x = Math.sin(t * 1.1) * 0.05
      arms[0].rotation.z = 0.3 + Math.sin(t * 1.3) * 0.04
      arms[1].rotation.z = -0.3 - Math.sin(t * 1.3 + 0.8) * 0.04
      root.position.y = Math.sin(t * 1.2) * 0.04
      if (!dragging) dragYaw = easeToward(dragYaw, 0, dt, 0.7)
      root.rotation.y = Math.sin(t * 0.5) * 0.3 + dragYaw

      // adereços dos hábitos: surgem com um pequeno pulo e depois flutuam de leve
      if (habits) {
        const targets = propTargets(c)
        for (const k of HABIT_KEYS) {
          const p = props[k]
          const goal = targets[k]
          if (goal === 1 && p.was === 0) p.boost = 0.28
          p.was = goal
          p.appear = easeToward(p.appear, goal, dt, 0.22)
          p.boost = easeToward(p.boost, 0, dt, 0.25)
          if (k === 'exercicio') continue
          // Apagado, o adereço aparece só como um contorno fantasma; ao marcar o hábito, acende.
          const opacity = 0.2 + 0.8 * p.appear
          p.mats.forEach((m, i) => {
            const mat = m as MeshStandardMaterial
            if (k === 'respiracao') mat.opacity = 0.08 + 0.42 * p.appear
            else if (k === 'agua' && i === 0) mat.opacity = opacity * 0.7
            else mat.opacity = opacity
          })
          const s = (0.86 + 0.14 * p.appear) * (1 + p.boost)
          p.group.scale.setScalar(s)
        }
        const rays = props.luz.group.getObjectByName('rays')
        if (rays) rays.rotation.z = t * 0.6
        props.luz.group.position.y = props.luz.home.y + Math.sin(t * 1.1) * 0.05
        props.espiritualidade.group.scale.multiplyScalar(1 + Math.max(0, Math.sin(t * 3.2)) * 0.1)
        props.espiritualidade.group.rotation.y = Math.sin(t * 0.7) * 0.4
        props.organizacao.group.position.y = props.organizacao.home.y + Math.sin(t * 1.4 + 1) * 0.07
        props.agua.group.rotation.z = 0.08 + Math.sin(t * 1.5) * 0.03
        props.respiracao.group.scale.setScalar((0.86 + 0.14 * props.respiracao.appear) * (1 + Math.sin(t * 1.2) * 0.04 * props.respiracao.appear))
      }

      renderer.render(scene, camera)
    }

    function frame(now: number) {
      raf = 0
      if (disposed || !visible || document.hidden) return
      try {
        draw(now)
      } catch {
        disposed = true
        failRef.current?.()
        return
      }
      raf = requestAnimationFrame(frame)
    }
    function wake() {
      if (disposed || raf || !visible || document.hidden) return
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const intersection = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting
      if (visible) wake()
    })
    intersection.observe(host)
    document.addEventListener('visibilitychange', wake)

    function onContextLost(e: Event) {
      e.preventDefault()
      failRef.current?.()
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    wake()

    return () => {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      intersection.disconnect()
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', wake)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      host.removeEventListener('pointerdown', onDown)
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerup', onUp)
      host.removeEventListener('pointercancel', onUp)
      for (const g of geoms) g.dispose()
      dressGeo.dispose()
      for (const m of mats) m.dispose()
      envTarget.dispose()
      pmrem.dispose()
      room.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    }
  }, [mode])

  return <div ref={hostRef} className={`doll3d doll3d--${mode}`} role="img" aria-label={ariaLabel} />
}
