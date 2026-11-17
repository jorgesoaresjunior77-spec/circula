import { maxPixelRatio } from '../lib/deviceTier'
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
  TorusGeometry,
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

// Copo de água em 3D (Three.js) com uma torneira cromada ao lado — quando a
// pessoa registra água (e ao abrir a tela), a torneira abre e enche até o nível real. Vidro transparente com reflexos naturais,
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio()))
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.setClearColor(0x000000, 0)
    const canvas = renderer.domElement
    canvas.className = 'water-bottle3d-canvas'
    host.appendChild(canvas)

    const scene = new Scene()
    const camera = new PerspectiveCamera(30, 1, 0.1, 50)
    camera.position.set(0.25, 0.75, 10.2)
    camera.lookAt(0.25, 0.6, 0)

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

    // ---- torneira cromada (fica sempre ao lado do copo; abre quando o nível sobe) ----
    const chrome = new MeshStandardMaterial({ color: 0xdfe4e8, metalness: 1, roughness: 0.16, envMapIntensity: 1.6 })
    const chromeDark = new MeshStandardMaterial({ color: 0xaab2b9, metalness: 1, roughness: 0.3, envMapIntensity: 1.3 })
    const faucet = new Group()
    scene.add(faucet)
    const PIPE_X = 1.08
    const ARC_R = 0.54
    const ARC_Y = 1.72
    // base no balcão, coluna, arco de "pescoço de cisne" e bico sobre o copo
    const faucetBaseGeometry = new CylinderGeometry(0.2, 0.24, 0.1, 40)
    const faucetBase = new Mesh(faucetBaseGeometry, chromeDark)
    faucetBase.position.set(PIPE_X, -1.15, 0)
    faucet.add(faucetBase)
    const faucetBodyGeometry = new CylinderGeometry(0.13, 0.15, 0.5, 32)
    const faucetBody = new Mesh(faucetBodyGeometry, chrome)
    faucetBody.position.set(PIPE_X, -0.86, 0)
    faucet.add(faucetBody)
    const pipeHeight = ARC_Y + 0.62
    const faucetPipeGeometry = new CylinderGeometry(0.075, 0.075, pipeHeight, 28)
    const faucetPipe = new Mesh(faucetPipeGeometry, chrome)
    faucetPipe.position.set(PIPE_X, -0.62 + pipeHeight / 2, 0)
    faucet.add(faucetPipe)
    const faucetArcGeometry = new TorusGeometry(ARC_R, 0.075, 18, 48, Math.PI)
    const faucetArc = new Mesh(faucetArcGeometry, chrome)
    faucetArc.position.set(PIPE_X - ARC_R, ARC_Y, 0)
    faucet.add(faucetArc)
    const SPOUT_X = PIPE_X - ARC_R * 2
    const faucetSpoutGeometry = new CylinderGeometry(0.075, 0.09, 0.3, 28)
    const faucetSpout = new Mesh(faucetSpoutGeometry, chrome)
    faucetSpout.position.set(SPOUT_X, ARC_Y - 0.15, 0)
    faucet.add(faucetSpout)
    const faucetTipGeometry = new CylinderGeometry(0.1, 0.1, 0.07, 28)
    const faucetTip = new Mesh(faucetTipGeometry, chromeDark)
    faucetTip.position.set(SPOUT_X, ARC_Y - 0.32, 0)
    faucet.add(faucetTip)
    const SPOUT_Y = ARC_Y - 0.36
    // alavanca: gira quando a água abre
    const lever = new Group()
    lever.position.set(PIPE_X, -0.62, 0)
    faucet.add(lever)
    const leverArmGeometry = new CylinderGeometry(0.04, 0.05, 0.42, 16)
    const leverArm = new Mesh(leverArmGeometry, chrome)
    leverArm.position.set(0.2, 0.06, 0)
    leverArm.rotation.z = -Math.PI / 2 + 0.25
    lever.add(leverArm)
    const leverKnobGeometry = new SphereGeometry(0.075, 20, 16)
    const leverKnob = new Mesh(leverKnobGeometry, chromeDark)
    leverKnob.position.set(0.41, 0.11, 0)
    lever.add(leverKnob)

    // fio de água: cilindro de altura 1, esticado do bico até a superfície
    const streamGeometry = new CylinderGeometry(0.05, 0.036, 1, 16, 1, true)
    const streamMaterial = new MeshPhysicalMaterial({
      color: new Color(0x8fd0ee),
      roughness: 0.05,
      transparent: true,
      opacity: 0,
      envMapIntensity: 2,
      depthWrite: false,
    })
    const stream = new Mesh(streamGeometry, streamMaterial)
    stream.renderOrder = 5
    stream.visible = false
    scene.add(stream)
    // gota que fica pendurada no bico quando a torneira fecha
    const dropGeometry = new SphereGeometry(0.035, 14, 12)
    const drop = new Mesh(dropGeometry, streamMaterial)
    drop.visible = false
    scene.add(drop)
    let pour = 0

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
    // Ao abrir, o copo começa vazio e a garrafa serve até o nível real do dia.
    let level = 0
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
        sparkPositions[i * 3 + 1] = 1.2
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
      } catch (err) {
        console.warn('[agua3d] voltando ao desenho simples:', err)
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
      level = easeToward(level, target, dt, 0.9)
      // Um respingo quando o nível muda: a água balança e se acalma.
      const kick = (level - before) * 4
      slosh = stepSlosh(slosh, dt, kick)

      const top = waterTopY(level)
      if (Number.isNaN(builtTop) || Math.abs(top - builtTop) > 0.002) rebuildWater(top)

      // Torneira: abre enquanto o nível está subindo e fecha quando chega no nível real.
      const filling = target - level > 0.004
      pour = easeToward(pour, filling ? 1 : 0, dt, filling ? 0.12 : 0.22)
      lever.rotation.z = pour * 0.7
      lever.rotation.y = -pour * 0.5
      const flowing = pour > 0.35
      stream.visible = flowing
      drop.visible = !flowing && pour > 0.02
      if (flowing) {
        const length = Math.max(0.05, SPOUT_Y - top)
        const width = 0.6 + 0.4 * pour + Math.sin(time * 18) * 0.06
        stream.scale.set(width, length, width)
        stream.position.set(SPOUT_X, top + length / 2, 0)
        streamMaterial.opacity = 0.78 * Math.min(1, (pour - 0.35) * 3)
        // a água caindo agita a superfície
        slosh = stepSlosh(slosh, dt, Math.sin(time * 9) * 0.25)
      } else if (drop.visible) {
        streamMaterial.opacity = 0.7
        drop.position.set(SPOUT_X, SPOUT_Y - 0.03 - (1 - pour) * 0.05, 0)
      }

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
      for (const g of [outerGeometry, innerGeometry, faucetBaseGeometry, faucetBodyGeometry, faucetPipeGeometry, faucetArcGeometry, faucetSpoutGeometry, faucetTipGeometry, leverArmGeometry, leverKnobGeometry, streamGeometry, dropGeometry, waterGeometry, disc.geometry, bubbleGeometry, sparkGeometry]) {
        g.dispose()
      }
      for (const m of [glassMaterial, chrome, chromeDark, streamMaterial, waterMaterial, surfaceMaterial, bubbleMaterial, sparkMaterial]) {
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
      aria-label={`Copo com ${percent}% da meta de água do dia`}
    />
  )
}
