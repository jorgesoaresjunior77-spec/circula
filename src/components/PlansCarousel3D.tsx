import { useEffect, useRef } from 'react'
import {
  CanvasTexture,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'
import type { BufferGeometry } from 'three'
import { maxPixelRatio } from '../lib/deviceTier'
import { STEP, ringAngle, slotPose } from '../lib/planCarousel'

// Carrossel 3D (Three.js) do card "Planos e Assinaturas": cinco cartões num anel que dá a volta completa.
// Cada cartão é vazio e mostra só a imagem cadastrada no Painel (frente, Premium, Mensal, Semestre e Anual).
// Um cartão vem para a frente
// enquanto outro vai para trás, num círculo perfeito. Este arquivo é pesado e só é carregado sob demanda.

export interface PlanCardImages {
  frente?: string | null
  premium?: string | null
  mensal?: string | null
  semestre?: string | null
  anual?: string | null
}

interface Props {
  images: PlanCardImages
  /** "Reduzir movimento": desenha uma vez só, parado. */
  reduced?: boolean
  /** WebGL indisponível ou perdido: quem chamou mostra o desenho simples. */
  onFail?: () => void
}

type Foto = HTMLImageElement | null

interface CardSpec {
  id: 'frente' | 'premium' | 'mensal' | 'semestre' | 'anual'
  angle: number
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, foto: Foto) => void
  imageKey?: keyof PlanCardImages
}

const CW = 640
const CH = 960
const CARD_W = 1.65
const CARD_H = (CARD_W * CH) / CW
// espessura dobrada (como a lateral do relógio)
const DEPTH = 0.14
const RADIUS = 2.1

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function base(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#fffaf1')
  g.addColorStop(1, '#efe0cc')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(184,137,58,0.65)'
  rr(ctx, 14, 14, w - 28, h - 28, 40)
  ctx.stroke()
}

/** Cartão vazio: só a imagem cadastrada no Painel, do jeito que ela é (o texto, se houver, já vem na imagem).
 *  Sem imagem, fica em branco (creme), à espera da foto. */
function cartaoImagem(ctx: CanvasRenderingContext2D, w: number, h: number, foto: Foto) {
  base(ctx, w, h)
  if (!foto || foto.naturalWidth <= 0) return
  const px = 22
  const py = 22
  const pw = w - 44
  const ph = h - 44
  ctx.save()
  rr(ctx, px, py, pw, ph, 34)
  ctx.clip()
  const s = Math.max(pw / foto.naturalWidth, ph / foto.naturalHeight)
  const dw = foto.naturalWidth * s
  const dh = foto.naturalHeight * s
  ctx.drawImage(foto, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh)
  ctx.restore()
}

function verso(ctx: CanvasRenderingContext2D, w: number, h: number) {
  base(ctx, w, h)
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#5a3a2b')
  g.addColorStop(1, '#3d261b')
  ctx.fillStyle = g
  rr(ctx, 40, 40, w - 80, h - 80, 30)
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#f6dca4'
  ctx.font = '170px Georgia, serif'
  ctx.fillText('✿', w / 2, h / 2 + 30)
  ctx.font = `italic 52px Georgia, serif`
  ctx.fillText('Círcula', w / 2, h / 2 + 130)
  ctx.font = '30px Georgia, serif'
  ctx.fillText('conectando mulheres', w / 2, h / 2 + 190)
}

const SPECS: CardSpec[] = [
  { id: 'frente', angle: 0, imageKey: 'frente', draw: cartaoImagem },
  { id: 'premium', angle: STEP, imageKey: 'premium', draw: cartaoImagem },
  { id: 'anual', angle: STEP * 2, imageKey: 'anual', draw: cartaoImagem },
  { id: 'semestre', angle: -STEP * 2, imageKey: 'semestre', draw: cartaoImagem },
  { id: 'mensal', angle: -STEP, imageKey: 'mensal', draw: cartaoImagem },
]

function roundedShape(w: number, h: number, r: number): Shape {
  const x = -w / 2
  const y = -h / 2
  const s = new Shape()
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + w, y + h - r)
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + h)
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

/** Põe o UV da face em 0..1 sobre o retângulo do cartão. */
function normalizeUv(geo: BufferGeometry, w: number, h: number) {
  const pos = geo.getAttribute('position')
  const uv = geo.getAttribute('uv')
  for (let i = 0; i < pos.count; i += 1) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h)
  uv.needsUpdate = true
}

export default function PlansCarousel3D({ images, reduced = false, onFail }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const imagesRef = useRef(images)
  const failRef = useRef(onFail)
  const refreshRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    failRef.current = onFail
  }, [onFail])

  // Fotos novas (cadastradas no Painel): carrega e redesenha só os cartões afetados.
  useEffect(() => {
    imagesRef.current = images
    refreshRef.current?.()
  }, [images])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let raf = 0
    let visible = true

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      failRef.current?.()
      return
    }
    renderer.outputColorSpace = SRGBColorSpace
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio()))
    renderer.setClearColor(0x000000, 0)
    const canvas = renderer.domElement
    canvas.className = 'plans3d-canvas'
    canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(canvas)

    const scene = new Scene()
    const camera = new PerspectiveCamera(36, 1, 0.1, 50)
    camera.position.set(0, 2.1, 9.6)
    camera.lookAt(0, 0.95, 0)

    const ring = new Group()
    scene.add(ring)

    const faceShape = roundedShape(CARD_W, CARD_H, 0.13)
    const bodyGeo = new ExtrudeGeometry(faceShape, { depth: DEPTH, bevelEnabled: false, curveSegments: 10 })
    bodyGeo.translate(0, 0, -DEPTH / 2)
    const faceGeo = new ShapeGeometry(faceShape, 10)
    normalizeUv(faceGeo, CARD_W, CARD_H)
    const bodyMat = new MeshBasicMaterial({ color: new Color('#e7d3b4') })

    const aniso = renderer.capabilities.getMaxAnisotropy()
    const cards = SPECS.map((spec) => {
      const front = document.createElement('canvas')
      front.width = CW
      front.height = CH
      const back = document.createElement('canvas')
      back.width = CW
      back.height = CH
      const ftex = new CanvasTexture(front)
      const btex = new CanvasTexture(back)
      for (const t of [ftex, btex]) {
        t.colorSpace = SRGBColorSpace
        t.anisotropy = Math.min(8, aniso)
      }
      const fmat = new MeshBasicMaterial({ map: ftex, toneMapped: false })
      const bmat = new MeshBasicMaterial({ map: btex, toneMapped: false, side: DoubleSide })
      const group = new Group()
      const body = new Mesh(bodyGeo, bodyMat.clone())
      const f = new Mesh(faceGeo, fmat)
      f.position.z = DEPTH / 2 + 0.002
      const b = new Mesh(faceGeo, bmat)
      b.rotation.y = Math.PI
      b.position.z = -DEPTH / 2 - 0.002
      group.add(body, f, b)
      ring.add(group)

      const paint = (foto: Foto) => {
        const c = front.getContext('2d')
        if (c) {
          c.clearRect(0, 0, CW, CH)
          spec.draw(c, CW, CH, foto)
          ftex.needsUpdate = true
        }
      }
      const bc = back.getContext('2d')
      if (bc) verso(bc, CW, CH)
      btex.needsUpdate = true
      paint(null)
      return { spec, group, body, fmat, bmat, ftex, btex, paint, url: null as string | null }
    })

    function carregarFotos() {
      for (const c of cards) {
        const key = c.spec.imageKey
        if (!key) continue
        const url = imagesRef.current[key] ?? null
        if (url === c.url) continue
        c.url = url
        if (!url) {
          c.paint(null)
          continue
        }
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          if (!disposed && c.url === url) {
            c.paint(img)
            if (reduced || !visible) draw(lastNow)
          }
        }
        img.src = url
      }
    }
    refreshRef.current = carregarFotos

    function resize() {
      const w = host!.clientWidth || 320
      const h = host!.clientHeight || 320
      renderer.setSize(w, h, false)
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }

    let lastNow = 0
    const t0 = performance.now()
    function draw(now: number) {
      lastNow = now
      const t = reduced ? 0 : (now - t0) / 1000
      const rot = ringAngle(t)
      for (const c of cards) {
        const p = slotPose(c.spec.angle, rot, RADIUS)
        c.group.position.set(p.x, 0, p.z)
        c.group.rotation.y = p.face
        // Os que vão para trás escurecem um pouco: dá profundidade.
        const k = 0.62 + 0.38 * Math.pow(p.front, 0.7)
        c.fmat.color.setScalar(k)
        c.bmat.color.setScalar(k)
        ;(c.body.material as MeshBasicMaterial).color.setScalar(k)
      }
      renderer.render(scene, camera)
    }

    function frame(now: number) {
      raf = 0
      if (disposed) return
      if (!visible || document.hidden) return
      try {
        draw(now)
      } catch (err) {
        console.warn('[planos3d] voltando ao desenho simples:', err)
        disposed = true
        failRef.current?.()
        return
      }
      raf = requestAnimationFrame(frame)
    }
    function start() {
      if (reduced || raf || disposed) return
      raf = requestAnimationFrame(frame)
    }

    carregarFotos()
    resize()
    draw(performance.now())

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      resize()
      draw(lastNow || performance.now())
    }) : null
    ro?.observe(host)
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) start()
    }, { threshold: 0.05 }) : null
    io?.observe(host)
    const onVis = () => {
      if (!document.hidden) start()
    }
    document.addEventListener('visibilitychange', onVis)
    const onLost = (ev: Event) => {
      ev.preventDefault()
      disposed = true
      failRef.current?.()
    }
    canvas.addEventListener('webglcontextlost', onLost)
    start()

    return () => {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      refreshRef.current = null
      ro?.disconnect()
      io?.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      canvas.removeEventListener('webglcontextlost', onLost)
      for (const c of cards) {
        c.ftex.dispose()
        c.btex.dispose()
        c.fmat.dispose()
        c.bmat.dispose()
        ;(c.body.material as MeshBasicMaterial).dispose()
      }
      bodyGeo.dispose()
      faceGeo.dispose()
      bodyMat.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    }
  }, [reduced])

  return <div ref={hostRef} className="plans3d-host" />
}
