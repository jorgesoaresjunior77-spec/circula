import { useEffect, useRef } from 'react'
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PMREMGenerator,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  Vector2,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  INNER_PROFILE,
  OUTER_PROFILE,
  WATER_BOTTOM_Y,
  easeToward,
  innerRadiusAt,
  stepSlosh,
  waterTopY,
} from '../lib/waterBottle3d'
import type { Slosh } from '../lib/waterBottle3d'

// Garrafa de água em 3D (Three.js): vidro transparente com reflexos naturais,
// água com ondulação suave e pequenas bolhas, e uma comemoração discreta ao
// atingir a meta. O NÍVEL vem só do dado real (`progress` = ml registrados ÷
// meta do dia): nada é inventado aqui.
//
// Este arquivo é pesado e só é carregado sob demanda (ver WaterBottleView).
// Ao sair da tela libera tudo (geometrias, materiais, texturas, contexto).

interface WaterBottle3DProps {
  /** Fração da meta do dia, de 0 a 1. */
  progress: number
  /** Meta atingida: dispara a comemoração quando passa a ser verdadeiro. */
  celebrating?: boolean
  /** Se o WebGL falhar (ou o contexto for perdido), o chamador volta ao SVG. */
  onFail?: () => void
}

const BUBBLES = 16
const SPARKS = 44
const CELEBRATE_SECONDS = 1.6
const DISC_RINGS = 9
const DISC_SEGMENTS = 40

/** Disco de raio 1 em anéis; só a altura (y) das ondas muda a cada quadro. */
function buildWaterDisc() {
  const positions: number[] = [0, 0, 0]
  const index: number[] = []
  for (let r = 1; r <= DISC_RINGS; r += 1) {
    const radius = r / DISC_RINGS
    for (let s = 0; s < DISC_SEGMENTS; s += 1) {
      const a = (s / DISC_SEGMENTS) * Math.PI * 2
      positions.push(Math.cos(a) * radius, 0, Math.sin(a) * radius)
    }
  }
  for (let s = 0; s < DISC_SEGMENTS; s += 1) {
    index.push(0, 1 + ((s + 1) % DISC_SEGMENTS), 1 + s)
  }
  for (let r = 1; r < DISC_RINGS; r += 1) {
    const inner = 1 + (r - 1) * DISC_SEGMENTS
    const outer = 1 + r * DISC_SEGMENTS
    for (let s = 0; s < DISC_SEGMENTS; s += 1) {
      const n = (s + 1) % DISC_SEGMENTS
      index.push(inner + s, inner + n, outer + s, inner + n, outer + n, outer + s)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  const base = Float32Array.from(positions)
  return { geometry, base }
}

/** Pontos (raio, altura) do corpo da água, do fundo até a superfície. */
function waterPoints(top: number): Vector2[] {
  // Sempre com 2 pontos ou mais (com 0% de água só sobra o fundo): o sólido de
  // revolução do Three.js não aceita menos que isso.
  const pts: Vector2[] = []
  for (const [r, y] of INNER_PROFILE) {
    if (y > top) break
    pts.push(new Vector2(Math.max(0, r - 0.006), y))
  }
  pts.push(new Vector2(Math.max(0, innerRadiusAt(top) - 0.006), top))
  return pts
}

export default function WaterBottle3D({ progress, celebrating = false, onFail }: WaterBottle3DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef({ progress, celebrating })
  const failRef = useRef(onFail)

  useEffect(() => {
    targetRef.current = { progress, celebrating }
  }, [progress, celebrating])
  useEffect(() => {
    failRef.current = onFail
  }, [onFail])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

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
    canvas.className = 'water-bottle3d-canvas'
    host.appendChild(canvas)

    const scene = new Scene()
    const camera = new PerspectiveCamera(30, 1, 0.1, 50)
    camera.position.set(0, 0.05, 5.7)
    camera.lookAt(0, 0, 0)

    // Reflexos naturais sem arquivo externo: ambiente de estúdio gerado na hora.
    const pmrem = new PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const envTarget = pmrem.fromScene(room, 0.04)
    scene.environment = envTarget.texture
    const key = new DirectionalLight(0xfff1e0, 1.4)
    key.position.set(2.5, 3, 4)
    scene.add(key)

    const group = new Group()
    scene.add(group)

    // ---- vidro ----
    const glassMaterial = new MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.05,
      transparent: true,
      opacity: 0.2,
      envMapIntensity: 2.2,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      side: DoubleSide,
      depthWrite: false,
    })
    const outerGeometry = new LatheGeometry(OUTER_PROFILE.map(([r, y]) => new Vector2(r, y)), 72)
    const outer = new Mesh(outerGeometry, glassMaterial)
    outer.renderOrder = 4
    group.add(outer)
    const innerGeometry = new LatheGeometry(INNER_PROFILE.map(([r, y]) => new Vector2(r, y)), 72)
    const innerGlass = new Mesh(innerGeometry, glassMaterial)
    innerGlass.renderOrder = 3
    group.add(innerGlass)

    // ---- tampa ----
    const capMaterial = new MeshStandardMaterial({ color: 0x5a463a, roughness: 0.45, metalness: 0.15 })
    const capGeometry = new CylinderGeometry(0.31, 0.31, 0.24, 40)
    const cap = new Mesh(capGeometry, capMaterial)
    cap.position.y = 1.3
    group.add(cap)
    const ringMaterial = new MeshStandardMaterial({ color: 0xc8b8a8, roughness: 0.3, metalness: 0.6 })
    const ringGeometry = new CylinderGeometry(0.315, 0.315, 0.035, 40)
    const ring = new Mesh(ringGeometry, ringMaterial)
    ring.position.y = 1.19
    group.add(ring)

    // ---- água ----
    const waterMaterial = new MeshPhysicalMaterial({
      color: new Color(0x3f9fcd),
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.86,
      envMapIntensity: 1.4,
      clearcoat: 0.6,
      clearcoatRoughness: 0.08,
      side: DoubleSide,
      depthWrite: false,
    })
    let waterGeometry = new LatheGeometry(waterPoints(WATER_BOTTOM_Y + 0.01), 64)
    const waterBody = new Mesh(waterGeometry, waterMaterial)
    waterBody.renderOrder = 1
    group.add(waterBody)

    const disc = buildWaterDisc()
    const surfaceMaterial = new MeshPhysicalMaterial({
      color: new Color(0x7cc4e4),
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.8,
      envMapIntensity: 2,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      side: DoubleSide,
      depthWrite: false,
    })
    const surface = new Mesh(disc.geometry, surfaceMaterial)
    surface.renderOrder = 2
    group.add(surface)

    // ---- bolhas ----
    const bubbleGeometry = new SphereGeometry(1, 10, 8)
    const bubbleMaterial = new MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.05,
      transparent: true,
      opacity: 0.55,
      envMapIntensity: 2.4,
      depthWrite: false,
    })
    const bubbles = new InstancedMesh(bubbleGeometry, bubbleMaterial, BUBBLES)
    bubbles.renderOrder = 2
    group.add(bubbles)
    const bubbleState = Array.from({ length: BUBBLES }, (_, i) => ({
      angle: Math.random() * Math.PI * 2,
      rho: Math.random() * 0.75,
      phase: Math.random() * 10,
      speed: 0.14 + Math.random() * 0.2,
      size: 0.011 + Math.random() * 0.02,
      y: WATER_BOTTOM_Y + 0.05 + (i / BUBBLES) * 1.5,
    }))
    const dummy = new Object3D()

    // ---- brilhos da comemoração ----
    const sparkPositions = new Float32Array(SPARKS * 3)
    const sparkVelocity = new Float32Array(SPARKS * 3)
    const sparkGeometry = new BufferGeometry()
    sparkGeometry.setAttribute('position', new Float32BufferAttribute(sparkPositions, 3))
    const sparkMaterial = new PointsMaterial({
      color: 0xffe6b0,
      size: 0.075,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const sparks = new Points(sparkGeometry, sparkMaterial)
    sparks.renderOrder = 6
    sparks.frustumCulled = false
    sparks.visible = false
    group.add(sparks)

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

    // ---- arrastar para girar (o dedo/mouse gira a garrafa e ela volta) ----
    let dragging = false
    let dragStartX = 0
    let dragYaw = 0
    function onDown(e: PointerEvent) {
      dragging = true
      dragStartX = e.clientX - dragYaw * 120
      try {
        host!.setPointerCapture(e.pointerId)
      } catch {
        // sem captura: o arrasto segue pelos eventos normais
      }
    }
    function onMove(e: PointerEvent) {
      if (dragging) dragYaw = Math.max(-1.6, Math.min(1.6, (e.clientX - dragStartX) / 120))
    }
    function onUp() {
      dragging = false
    }
    host.addEventListener('pointerdown', onDown)
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerup', onUp)
    host.addEventListener('pointercancel', onUp)

    // ---- laço de animação ----
    let level = targetRef.current.progress
    let builtTop = Number.NaN
    let slosh: Slosh = { x: 0, v: 0 }
    let wasCelebrating = targetRef.current.celebrating
    let celebrateT = -1
    let raf = 0
    let last = performance.now()
    let time = 0
    let visible = true
    let disposed = false

    function rebuildWater(top: number) {
      waterGeometry.dispose()
      waterGeometry = new LatheGeometry(waterPoints(top), 64)
      waterBody.geometry = waterGeometry
      builtTop = top
    }

    function startCelebration() {
      celebrateT = 0
      sparks.visible = true
      for (let i = 0; i < SPARKS; i += 1) {
        const a = Math.random() * Math.PI * 2
        const speed = 0.5 + Math.random() * 0.9
        sparkPositions[i * 3] = Math.cos(a) * 0.12
        sparkPositions[i * 3 + 1] = 1.25
        sparkPositions[i * 3 + 2] = Math.sin(a) * 0.12
        sparkVelocity[i * 3] = Math.cos(a) * speed * 0.7
        sparkVelocity[i * 3 + 1] = 0.6 + Math.random() * 1.1
        sparkVelocity[i * 3 + 2] = Math.sin(a) * speed * 0.7
      }
      slosh = stepSlosh(slosh, 1 / 60, 1.4)
    }

    function frame(now: number) {
      raf = 0
      if (disposed) return
      if (!visible || document.hidden) return
      try {
        draw(now)
      } catch {
        // Qualquer falha de GPU/cena: volta para a garrafa SVG, sem quebrar a página.
        disposed = true
        failRef.current?.()
        return
      }
      raf = requestAnimationFrame(frame)
    }

    function draw(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      time += dt

      const { progress: wanted, celebrating: celebratingNow } = targetRef.current
      const target = Math.min(1, Math.max(0, wanted))
      const before = level
      level = easeToward(level, target, dt, 0.5)
      // Um respingo quando o nível muda: a água balança e se acalma.
      const kick = (level - before) * 4
      slosh = stepSlosh(slosh, dt, kick)

      const top = waterTopY(level)
      if (Number.isNaN(builtTop) || Math.abs(top - builtTop) > 0.002) rebuildWater(top)

      // Superfície: ondas leves + inclinação do balanço.
      const radius = Math.max(0.02, innerRadiusAt(top) - 0.006)
      surface.position.y = top
      surface.scale.set(radius, 1, radius)
      surface.visible = level > 0.004
      waterBody.visible = level > 0.004
      const pos = disc.geometry.attributes.position as Float32BufferAttribute
      const amp = 0.008 + Math.abs(slosh.x) * 0.06
      for (let i = 0; i < pos.count; i += 1) {
        const x = disc.base[i * 3]
        const z = disc.base[i * 3 + 2]
        const edge = 1 - Math.min(1, Math.hypot(x, z)) * 0.35
        const wave =
          0.5 * Math.sin(3.2 * x + 1.7 * time) +
          0.35 * Math.sin(4.1 * z - 1.3 * time + 1.2) +
          0.25 * Math.sin(5.7 * (x + z) + 2.1 * time)
        pos.setY(i, wave * amp * edge + slosh.x * x * 0.35 * radius)
      }
      pos.needsUpdate = true
      disc.geometry.computeVertexNormals()

      // Bolhas sobem só dentro da água.
      const room = top - (WATER_BOTTOM_Y + 0.06)
      for (let i = 0; i < BUBBLES; i += 1) {
        const b = bubbleState[i]
        b.y += b.speed * dt
        if (b.y > top - 0.03 || b.y < WATER_BOTTOM_Y + 0.04) {
          b.y = WATER_BOTTOM_Y + 0.05
          b.angle = Math.random() * Math.PI * 2
          b.rho = Math.random() * 0.75
        }
        const r = Math.max(0, innerRadiusAt(b.y) - 0.04) * b.rho
        const wobble = Math.sin(time * 2 + b.phase) * 0.012
        dummy.position.set(Math.cos(b.angle) * r + wobble, b.y, Math.sin(b.angle) * r)
        dummy.scale.setScalar(room > 0.12 ? b.size : 0.0001)
        dummy.updateMatrix()
        bubbles.setMatrixAt(i, dummy.matrix)
      }
      bubbles.instanceMatrix.needsUpdate = true

      // Comemoração: dispara ao PASSAR a atingir a meta (não ao abrir a página).
      if (celebratingNow && !wasCelebrating) startCelebration()
      wasCelebrating = celebratingNow
      let pulse = 1
      if (celebrateT >= 0) {
        celebrateT += dt
        const t = celebrateT / CELEBRATE_SECONDS
        if (t >= 1) {
          celebrateT = -1
          sparks.visible = false
        } else {
          for (let i = 0; i < SPARKS; i += 1) {
            sparkVelocity[i * 3 + 1] -= 1.4 * dt
            sparkPositions[i * 3] += sparkVelocity[i * 3] * dt
            sparkPositions[i * 3 + 1] += sparkVelocity[i * 3 + 1] * dt
            sparkPositions[i * 3 + 2] += sparkVelocity[i * 3 + 2] * dt
          }
          ;(sparkGeometry.attributes.position as Float32BufferAttribute).needsUpdate = true
          sparkMaterial.opacity = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.95
          if (celebrateT < 0.9) pulse = 1 + 0.06 * Math.sin((Math.PI * celebrateT) / 0.9)
        }
      }
      group.scale.setScalar(pulse)

      // Balanço suave de repouso + giro por arrasto (que volta sozinho).
      if (!dragging) dragYaw = easeToward(dragYaw, 0, dt, 0.6)
      group.rotation.y = Math.sin(time * 0.45) * 0.3 + dragYaw
      group.rotation.x = Math.sin(time * 0.31) * 0.03
      group.position.y = Math.sin(time * 0.9) * 0.015

      renderer.render(scene, camera)
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
      // Libera tudo que a GPU guardou.
      for (const g of [outerGeometry, innerGeometry, capGeometry, ringGeometry, waterGeometry, disc.geometry, bubbleGeometry, sparkGeometry]) {
        g.dispose()
      }
      for (const m of [glassMaterial, capMaterial, ringMaterial, waterMaterial, surfaceMaterial, bubbleMaterial, sparkMaterial]) {
        m.dispose()
      }
      bubbles.dispose()
      envTarget.dispose()
      pmrem.dispose()
      room.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    }
  }, [])

  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  return (
    <div
      ref={hostRef}
      className="water-bottle3d"
      role="img"
      aria-label={`Garrafa com ${percent}% da meta de água do dia`}
    />
  )
}
