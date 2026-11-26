import {
  ACESFilmicToneMapping,
  DirectionalLight,
  PMREMGenerator,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import type { BufferGeometry, Material, Texture } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { maxPixelRatio } from './deviceTier'

// Base comum das cenas 3D pequenas (sino, relógio, Livi): cria o renderizador transparente, a câmera e a
// luz, acompanha o tamanho do elemento, só desenha enquanto está na tela e libera tudo ao sair.

export interface SceneCtx {
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  host: HTMLElement
  reduced: boolean
  /** Registra um recurso da GPU para ser liberado ao desmontar. */
  track: <T extends BufferGeometry | Material | Texture>(item: T) => T
}

export interface SceneLoop {
  /** `t` em segundos desde o início (0 fixo com "reduzir movimento"); `dt` é o intervalo do quadro. */
  update: (t: number, dt: number) => void
  /** Limpeza própria (ouvintes de toque etc.). */
  dispose?: () => void
}

export interface SceneOptions {
  fov: number
  position: [number, number, number]
  look: [number, number, number]
  className: string
  exposure?: number
  /** Força da luz de ambiente refletida (1 = padrão). */
  envIntensity?: number
  /** Chamado uma vez, depois do primeiro quadro desenhado. */
  onReady?: () => void
}

/** Falso onde não há WebGL (testes, aparelhos antigos): quem chama já começa na versão 2D. */
export function webglDisponivel(): boolean {
  return typeof window !== 'undefined' && typeof (window as unknown as { WebGLRenderingContext?: unknown }).WebGLRenderingContext !== 'undefined'
}

export function prefersReduced(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Monta a cena em `host`. Devolve a função de limpeza; se o WebGL não existir, chama `onFail` e devolve uma limpeza vazia. */
export function mountScene(host: HTMLElement, opts: SceneOptions, build: (ctx: SceneCtx) => SceneLoop, onFail?: () => void): () => void {
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  } catch {
    onFail?.()
    return () => {}
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio()))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = opts.exposure ?? 1.05
  renderer.setClearColor(0x000000, 0)
  const canvas = renderer.domElement
  canvas.className = opts.className
  host.appendChild(canvas)

  const scene = new Scene()
  const camera = new PerspectiveCamera(opts.fov, 1, 0.1, 80)
  camera.position.set(...opts.position)
  camera.lookAt(...opts.look)

  const pmrem = new PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const envTarget = pmrem.fromScene(room, 0.04)
  scene.environment = envTarget.texture
  scene.environmentIntensity = opts.envIntensity ?? 1
  const key = new DirectionalLight(0xfff1e0, 1.3)
  key.position.set(2.5, 4, 5)
  scene.add(key)

  const owned: Array<BufferGeometry | Material | Texture> = []
  const ctx: SceneCtx = {
    scene,
    camera,
    renderer,
    host,
    reduced: prefersReduced(),
    track: (item) => {
      owned.push(item)
      return item
    },
  }

  let loop: SceneLoop
  try {
    loop = build(ctx)
  } catch {
    owned.forEach((o) => o.dispose())
    envTarget.dispose()
    pmrem.dispose()
    room.dispose()
    renderer.dispose()
    canvas.remove()
    onFail?.()
    return () => {}
  }

  function resize() {
    const w = Math.max(1, host.clientWidth)
    const h = Math.max(1, host.clientHeight)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)

  let raf = 0
  let visible = true
  let disposed = false
  let time = 0
  let last = performance.now()
  let ready = false

  function frame(now: number) {
    raf = 0
    if (disposed || !visible || document.hidden) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    time += dt
    try {
      loop.update(ctx.reduced ? 0 : time, dt)
      renderer.render(scene, camera)
    } catch {
      disposed = true
      onFail?.()
      return
    }
    if (!ready) {
      ready = true
      opts.onReady?.()
    }
    // Com "reduzir movimento" só o primeiro quadro (e os seguintes pedidos pelo componente) são desenhados.
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
  const onLost = (e: Event) => {
    e.preventDefault()
    onFail?.()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  wake()

  return () => {
    disposed = true
    if (raf) cancelAnimationFrame(raf)
    intersection.disconnect()
    resizeObserver.disconnect()
    document.removeEventListener('visibilitychange', wake)
    canvas.removeEventListener('webglcontextlost', onLost)
    loop.dispose?.()
    owned.forEach((o) => o.dispose())
    envTarget.dispose()
    pmrem.dispose()
    room.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }
}
