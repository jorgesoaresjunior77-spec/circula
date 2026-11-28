import {
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  CapsuleGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Path,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from 'three'
import type { BufferGeometry, Material, Texture } from 'three'

// Os dois relógios novos da Home em 3D (mesma cena, balanço e inclinação do clássico, em Clock3D.tsx):
// - rosé digital: caixa rosé de laterais bem arredondadas, estilo Apple Watch, hora em cima e minutos embaixo;
// - suíço: caixa redonda em prata, aro e ponteiros em ouro, mostrador prateado com índices dourados.
// Cada função monta o relógio dentro de `watch` e devolve quem atualiza a hora a cada quadro.

type Track = <T extends BufferGeometry | Material | Texture>(item: T) => T
const DEG = Math.PI / 180

function roundedRect(w: number, h: number, r: number, path: Shape | Path = new Shape()): Shape | Path {
  const x = -w / 2
  const y = -h / 2
  path.moveTo(x + r, y)
  path.lineTo(x + w - r, y)
  path.quadraticCurveTo(x + w, y, x + w, y + r)
  path.lineTo(x + w, y + h - r)
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  path.lineTo(x + r, y + h)
  path.quadraticCurveTo(x, y + h, x, y + h - r)
  path.lineTo(x, y + r)
  path.quadraticCurveTo(x, y, x + r, y)
  return path
}

function normalizeUv(geo: BufferGeometry, w: number, h: number) {
  const pos = geo.getAttribute('position')
  const uv = geo.getAttribute('uv')
  for (let i = 0; i < pos.count; i += 1) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h)
  uv.needsUpdate = true
}

const pad = (n: number) => String(n).padStart(2, '0')

export function buildRoseDigital(watch: Group, track: Track): (h: number, m: number) => void {
  const W = 1.9
  const H = 2.08
  const R = 0.8
  const BEZEL = 0.13
  const rose = track(new MeshPhysicalMaterial({ color: 0xe9b5ab, metalness: 0.8, roughness: 0.24, clearcoat: 0.7, clearcoatRoughness: 0.18 }))

  const frame = roundedRect(W, H, R) as Shape
  frame.holes.push(roundedRect(W - BEZEL * 2, H - BEZEL * 2, R - BEZEL, new Path()) as Path)
  const caseGeo = track(new ExtrudeGeometry(frame, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 8, curveSegments: 32 }))
  caseGeo.translate(0, 0, -0.1)
  watch.add(new Mesh(caseGeo, rose))
  const back = new Mesh(track(new ExtrudeGeometry(roundedRect(W, H, R) as Shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 8, curveSegments: 32 })), rose)
  back.position.z = -0.28
  watch.add(back)

  // tela: uma textura desenhada (hora em cima, minutos embaixo)
  const SW = W - BEZEL * 2
  const SH = H - BEZEL * 2
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = Math.round((640 * SH) / SW)
  const tex = track(new CanvasTexture(canvas))
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  const screenGeo = track(new ShapeGeometry(roundedRect(SW, SH, R - BEZEL) as Shape, 32))
  normalizeUv(screenGeo, SW, SH)
  const screen = new Mesh(screenGeo, track(new MeshBasicMaterial({ map: tex, toneMapped: false })))
  screen.position.z = 0.0
  watch.add(screen)
  // vidro por cima, com brilho
  const glass = new Mesh(
    track(new ShapeGeometry(roundedRect(SW, SH, R - BEZEL) as Shape, 32)),
    track(new MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.05, clearcoat: 1, metalness: 0 })),
  )
  glass.position.z = 0.02
  watch.add(glass)

  const coroa = new Mesh(track(new CylinderGeometry(0.11, 0.11, 0.13, 28)), rose)
  coroa.rotation.z = Math.PI / 2
  coroa.position.set(W / 2 + 0.08, 0.36, -0.06)
  watch.add(coroa)
  const botao = new Mesh(track(new CapsuleGeometry(0.045, 0.28, 4, 12)), rose)
  botao.position.set(W / 2 + 0.03, -0.2, -0.06)
  watch.add(botao)

  let shown = ''
  function paint(h: number, m: number) {
    const key = `${h}:${m}`
    if (key === shown) return
    shown = key
    const c = canvas.getContext('2d')
    if (!c) return
    const w = canvas.width
    const hh = canvas.height
    const g = c.createLinearGradient(0, 0, 0, hh)
    g.addColorStop(0, '#2a1c20')
    g.addColorStop(1, '#120b0e')
    c.fillStyle = g
    c.fillRect(0, 0, w, hh)
    c.textAlign = 'center'
    c.textBaseline = 'alphabetic'
    c.font = `400 ${Math.round(hh * 0.36)}px Jost, "Helvetica Neue", Arial, sans-serif`
    c.fillStyle = '#f4c6c0'
    c.fillText(pad(h), w / 2, hh * 0.47)
    c.fillStyle = '#ffffff'
    c.fillText(pad(m), w / 2, hh * 0.87)
    tex.needsUpdate = true
  }
  // a fonte do app pode chegar depois: redesenha quando ela estiver pronta
  void document.fonts?.ready.then(() => {
    const [h, m] = shown.split(':').map(Number)
    shown = ''
    if (Number.isFinite(h)) paint(h, m)
  })
  return paint
}

function dialTexture(track: Track): CanvasTexture {
  const S = 1024
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const c = canvas.getContext('2d')!
  const cx = S / 2
  // mostrador prateado com raios de sol
  const g = c.createRadialGradient(cx * 0.9, cx * 0.8, 20, cx, cx, cx)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.6, '#eeeeea')
  g.addColorStop(1, '#d4d3cd')
  c.fillStyle = g
  c.fillRect(0, 0, S, S)
  c.save()
  c.translate(cx, cx)
  for (let i = 0; i < 240; i++) {
    c.rotate((Math.PI * 2) / 240)
    c.strokeStyle = i % 2 ? 'rgba(255,255,255,0.18)' : 'rgba(150,150,145,0.08)'
    c.lineWidth = 3
    c.beginPath()
    c.moveTo(0, 0)
    c.lineTo(0, -cx)
    c.stroke()
  }
  c.restore()
  const gold = c.createLinearGradient(0, 0, S, S)
  gold.addColorStop(0, '#f6e3a8')
  gold.addColorStop(0.45, '#d4ab55')
  gold.addColorStop(1, '#9c7428')
  // trilho dos minutos
  c.save()
  c.translate(cx, cx)
  for (let i = 0; i < 60; i++) {
    if (i % 5) {
      c.fillStyle = '#8f8f8a'
      c.fillRect(-2, -cx * 0.93, 4, cx * 0.05)
    }
    c.rotate((Math.PI * 2) / 60)
  }
  // índices em ouro, duplo nas 12
  for (let i = 0; i < 12; i++) {
    c.fillStyle = gold
    const len = i % 3 === 0 ? cx * 0.2 : cx * 0.15
    if (i === 0) {
      c.fillRect(-cx * 0.055, -cx * 0.9, cx * 0.04, len)
      c.fillRect(cx * 0.015, -cx * 0.9, cx * 0.04, len)
    } else {
      c.fillRect(-cx * 0.022, -cx * 0.9, cx * 0.044, len)
    }
    c.rotate((Math.PI * 2) / 12)
  }
  c.restore()
  c.fillStyle = '#8a6a2c'
  c.textAlign = 'center'
  c.font = `italic ${Math.round(S * 0.05)}px Georgia, "Times New Roman", serif`
  c.fillText('Círcula', cx, cx * 0.62)
  c.font = `${Math.round(S * 0.022)}px Georgia, serif`
  c.fillStyle = '#9a9a94'
  c.fillText('AUTOMATIC', cx, cx * 1.42)
  const tex = track(new CanvasTexture(canvas))
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function dauphineShape(len: number, w: number, tail: number): Shape {
  const s = new Shape()
  s.moveTo(0, -tail)
  s.lineTo(w, len * 0.18)
  s.lineTo(0, len)
  s.lineTo(-w, len * 0.18)
  s.lineTo(0, -tail)
  return s
}

export function buildSwiss(watch: Group, track: Track): (h: number, m: number) => void {
  const silver = track(new MeshPhysicalMaterial({ color: 0xdfe1e4, metalness: 0.92, roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.12 }))
  const gold = track(new MeshPhysicalMaterial({ color: 0xd8ad57, metalness: 1, roughness: 0.22, clearcoat: 0.6 }))

  const caseMesh = new Mesh(track(new CylinderGeometry(1.0, 1.0, 0.26, 128)), silver)
  caseMesh.rotation.x = Math.PI / 2
  caseMesh.position.z = -0.14
  watch.add(caseMesh)
  const bezel = new Mesh(track(new TorusGeometry(0.94, 0.06, 32, 160)), gold)
  bezel.position.z = 0.0
  watch.add(bezel)
  const dial = new Mesh(track(new CircleGeometry(0.9, 128)), track(new MeshPhysicalMaterial({ map: dialTexture(track), roughness: 0.4, metalness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.08 })))
  dial.position.z = -0.005
  watch.add(dial)

  const crown = new Mesh(track(new CylinderGeometry(0.09, 0.09, 0.16, 32)), silver)
  crown.rotation.z = Math.PI / 2
  crown.position.set(1.06, 0, -0.14)
  watch.add(crown)
  // alças (onde a pulseira prende)
  for (const sy of [1, -1]) {
    for (const sx of [1, -1]) {
      const lug = new Mesh(track(new CapsuleGeometry(0.06, 0.22, 4, 12)), silver)
      lug.position.set(sx * 0.5, sy * 1.02, -0.16)
      watch.add(lug)
    }
  }

  const extrude = { depth: 0.025, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 }
  const hourHand = new Group()
  hourHand.add(new Mesh(track(new ExtrudeGeometry(dauphineShape(0.5, 0.06, 0.08), extrude)), gold))
  hourHand.position.z = 0.03
  watch.add(hourHand)
  const minuteHand = new Group()
  minuteHand.add(new Mesh(track(new ExtrudeGeometry(dauphineShape(0.76, 0.05, 0.1), extrude)), gold))
  minuteHand.position.z = 0.07
  watch.add(minuteHand)
  const pin = new Mesh(track(new SphereGeometry(0.05, 24, 16)), gold)
  pin.scale.z = 0.6
  pin.position.z = 0.11
  watch.add(pin)

  return (h: number, m: number) => {
    hourHand.rotation.z = -((h % 12) + m / 60) * 30 * DEG
    minuteHand.rotation.z = -m * 6 * DEG
  }
}
