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
  TextureLoader,
  PlaneGeometry,
  WebGLRenderer,
} from 'three'
import circulaIcone from '../assets/circula-icone-3d.webp'
import type { BufferGeometry } from 'three'
import { maxPixelRatio } from '../lib/deviceTier'
import { STEP, slotPose } from '../lib/planCarousel'

/** Uma volta completa a cada 22 s, sem parar: movimento contínuo e natural. */
const RING_SPEED = (Math.PI * 2) / 22

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

// Textura em alta resolução (o cartão da frente chega a ~1/3 da largura da tela, em telas 3x).
const CW = 1024
const CH = 1536
const CARD_W = 1.65
const CARD_H = (CARD_W * CH) / CW
// espessura dobrada (como a lateral do relógio)
const DEPTH = 0.14
const RADIUS = 2.1
/** Quanto o cartão da frente cresce (14%). */
const FRONT_ZOOM = 0.14
// Ícone do meio: 20% da altura dele mais para baixo do que antes (0,15).
const ICON_Y = 0.15 - 0.2 * 1.7
// Pulsada leve do cartão ao chegar na frente: duração (s) e quanto cresce.
const PULSE_S = 0.7
const PULSE_AMOUNT = 0.035
/** A área de desenho é 16% mais alta que o card (passa da borda de baixo). Igual ao bottom de .plans3d-host. */
const HOST_EXTRA = 0.16

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function gold(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#f8e6b0')
  g.addColorStop(0.3, '#d6ad5c')
  g.addColorStop(0.55, '#f3dc9c')
  g.addColorStop(0.8, '#b88a3a')
  g.addColorStop(1, '#e9cf8a')
  return g
}

/** Fundo do cartão: creme com moldura dupla em ouro (filete largo e filete fino). */
function base(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#fffaf1')
  g.addColorStop(1, '#efe0cc')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = gold(ctx, w, h)
  ctx.lineWidth = 10
  rr(ctx, 16, 16, w - 32, h - 32, 58)
  ctx.stroke()
  ctx.lineWidth = 2.5
  rr(ctx, 34, 34, w - 68, h - 68, 46)
  ctx.stroke()
}

/** Brilho de vidro na diagonal: acabamento de cartão premium. */
function sheen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save()
  rr(ctx, 16, 16, w - 32, h - 32, 58)
  ctx.clip()
  const s = ctx.createLinearGradient(0, 0, w, h * 0.7)
  s.addColorStop(0, 'rgba(255,255,255,0.32)')
  s.addColorStop(0.28, 'rgba(255,255,255,0.08)')
  s.addColorStop(0.42, 'rgba(255,255,255,0)')
  ctx.fillStyle = s
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

/** Reduz em etapas (metade por vez) quando a foto é muito maior que o cartão: evita serrilhado. */
function drawSmooth(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, dw: number, dh: number) {
  let src: CanvasImageSource = img
  let sw = img.naturalWidth
  let sh = img.naturalHeight
  while (sw / 2 > dw && sh / 2 > dh) {
    const c = document.createElement('canvas')
    c.width = Math.round(sw / 2)
    c.height = Math.round(sh / 2)
    const cx = c.getContext('2d')
    if (!cx) break
    cx.imageSmoothingQuality = 'high'
    cx.drawImage(src, 0, 0, c.width, c.height)
    src = c
    sw = c.width
    sh = c.height
  }
  ctx.drawImage(src, 0, 0, sw, sh, x, y, dw, dh)
}

/** Cartão vazio: só a imagem cadastrada no Painel, do jeito que ela é (o texto, se houver, já vem na imagem).
 *  Sem imagem, fica em branco (creme), à espera da foto. */
function cartaoImagem(ctx: CanvasRenderingContext2D, w: number, h: number, foto: Foto) {
  base(ctx, w, h)
  if (!foto || foto.naturalWidth <= 0) {
    sheen(ctx, w, h)
    return
  }
  const px = 44
  const py = 44
  const pw = w - 88
  const ph = h - 88
  ctx.save()
  rr(ctx, px, py, pw, ph, 40)
  ctx.clip()
  const s = Math.max(pw / foto.naturalWidth, ph / foto.naturalHeight)
  const dw = foto.naturalWidth * s
  const dh = foto.naturalHeight * s
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  drawSmooth(ctx, foto, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh)
  ctx.restore()
  // filete de ouro por cima da borda da foto
  ctx.strokeStyle = gold(ctx, w, h)
  ctx.lineWidth = 3
  rr(ctx, px, py, pw, ph, 40)
  ctx.stroke()
  sheen(ctx, w, h)
}

function verso(ctx: CanvasRenderingContext2D, w: number, h: number) {
  base(ctx, w, h)
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#6a4632')
  g.addColorStop(1, '#3a2419')
  ctx.fillStyle = g
  rr(ctx, 44, 44, w - 88, h - 88, 40)
  ctx.fill()
  const foil = gold(ctx, w, h)
  // símbolo do Círcula (o anel) e o nome em ouro
  ctx.strokeStyle = foil
  ctx.lineWidth = 34
  ctx.beginPath()
  ctx.arc(w / 2, h / 2 - 90, 120, 0, Math.PI * 2)
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = foil
  ctx.font = 'italic 96px Georgia, serif'
  ctx.fillText('Círcula', w / 2, h / 2 + 150)
  ctx.font = '44px Georgia, serif'
  ctx.fillText('conectando mulheres', w / 2, h / 2 + 222)
  sheen(ctx, w, h)
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
    // Canvas pequeno: vale desenhar na resolução real da tela (até 2,5x) para os cartões ficarem nítidos.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Math.max(maxPixelRatio(), 2.5)))
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

    // Ícone do Círcula (só o símbolo) no meio do anel, atrás dos cartões da frente.
    // 10% maior e 20% mais baixo (pedido de 28/11/2026)
    const iconGeo = new PlaneGeometry(1.87, 1.87)
    const iconMat = new MeshBasicMaterial({ transparent: true, toneMapped: false, depthWrite: false })
    const icon = new Mesh(iconGeo, iconMat)
    icon.position.set(0, ICON_Y, -0.4)
    scene.add(icon)
    const iconTex = new TextureLoader().load(circulaIcone, () => {
      if (reduced || !visible) draw(lastNow)
    })
    iconTex.colorSpace = SRGBColorSpace
    iconTex.anisotropy = renderer.capabilities.getMaxAnisotropy()
    iconMat.map = iconTex

    const faceShape = roundedShape(CARD_W, CARD_H, 0.13)
    const bodyGeo = new ExtrudeGeometry(faceShape, { depth: DEPTH, bevelEnabled: false, curveSegments: 10 })
    bodyGeo.translate(0, 0, -DEPTH / 2)
    const faceGeo = new ShapeGeometry(faceShape, 10)
    normalizeUv(faceGeo, CARD_W, CARD_H)
    // lateral dourada, como o fio de um cartão premium
    const bodyMat = new MeshBasicMaterial({ color: new Color('#d9b56c') })

    // sombra leve embaixo de cada cartão (acompanha o giro e dá sensação de movimento)
    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = 256
    shadowCanvas.height = 64
    const sc = shadowCanvas.getContext('2d')
    if (sc) {
      const g = sc.createRadialGradient(128, 32, 4, 128, 32, 128)
      g.addColorStop(0, 'rgba(30, 18, 10, 0.42)')
      g.addColorStop(1, 'rgba(30, 18, 10, 0)')
      sc.fillStyle = g
      sc.setTransform(1, 0, 0, 0.25, 0, 24)
      sc.fillRect(0, 0, 256, 256)
    }
    const shadowTex = new CanvasTexture(shadowCanvas)
    const shadowGeo = new PlaneGeometry(CARD_W * 1.05, 0.3)
    const shadowMat = new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false })

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
        t.anisotropy = aniso
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
      const shadow = new Mesh(shadowGeo, shadowMat)
      shadow.position.set(0, -CARD_H / 2 - 0.1, -0.05)
      group.add(shadow, body, f, b)
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
      return { spec, group, body, fmat, bmat, ftex, btex, paint, url: null as string | null, inFront: false, pulseAt: -1 }
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

    // A área de desenho passa um pouco da borda de baixo do card grande (ver .plans3d-host no CSS), para o
    // cartão da frente, ao crescer, cobrir parte da borda. O enquadramento continua o do card (altura h0).
    function resize() {
      const w = host!.clientWidth || 320
      const h = host!.clientHeight || 320
      const h0 = h / (1 + HOST_EXTRA)
      renderer.setSize(w, h, false)
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      camera.aspect = w / h0
      camera.setViewOffset(w, h0, 0, 0, w, h)
      camera.updateProjectionMatrix()
    }

    let lastNow = 0
    const t0 = performance.now()
    function draw(now: number) {
      lastNow = now
      const t = reduced ? 0 : (now - t0) / 1000
      const rot = t * RING_SPEED
      // o ícone acompanha a câmera de leve (respira), sem girar com o anel
      icon.position.y = ICON_Y + Math.sin(t * 0.9) * 0.04
      for (const c of cards) {
        const p = slotPose(c.spec.angle, rot, RADIUS)
        // O da frente cresce (zoom para a frente): a borda de cima fica no lugar (não sobe na Marluce)
        // e ele desce, cobrindo parte da borda de baixo do card grande.
        const z = Math.pow(p.front, 6)
        // ao chegar na frente, uma pulsada bem leve (uma vez por chegada)
        if (!c.inFront && z > 0.9) {
          c.inFront = true
          c.pulseAt = t
        } else if (c.inFront && z < 0.6) {
          c.inFront = false
        }
        const since = t - c.pulseAt
        const pulse = !reduced && c.pulseAt >= 0 && since < PULSE_S ? Math.sin((Math.PI * since) / PULSE_S) * PULSE_AMOUNT : 0
        const s = (1 + FRONT_ZOOM * z) * (1 + pulse)
        c.group.scale.setScalar(s)
        c.group.position.set(p.x, -((s - 1) * CARD_H) / 2, p.z + 0.25 * z)
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
      iconGeo.dispose()
      shadowGeo.dispose()
      shadowMat.dispose()
      shadowTex.dispose()
      iconMat.dispose()
      iconTex.dispose()
      bodyMat.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    }
  }, [reduced])

  return <div ref={hostRef} className="plans3d-host" />
}
