import { useEffect, useRef } from 'react'
import {
  CanvasTexture,
  CapsuleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
} from 'three'
import { mountScene } from '../lib/scene3d'
import { poseDa } from '../lib/robo3dPoses'
import type { ArmPose, FaceKind } from '../lib/robo3dPoses'

// Livi em 3D: o robô mascote do Círcula feito de formas arredondadas (cabeça com visor escuro, antenas, orelhas,
// corpo, braços e pés cor de pêssego). Cada cena do RoboGuia vira uma pose: braços, cabeça e a expressão do
// rosto (olhos e boca em ciano, desenhados num visor). Respira, pisca e acena. Sem texto e sem IA em tempo real.

interface Props {
  cena: string
  onReady?: () => void
  onFail?: () => void
}

const PESSEGO = 0xf3a690
const SALMAO = 0xd9786d
const CIANO = '#7fe8f5'

function desenharRosto(kind: FaceKind): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 320
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 512, 320)
  g.fillStyle = CIANO
  g.strokeStyle = CIANO
  g.lineCap = 'round'
  g.shadowColor = 'rgba(127,232,245,0.9)'
  g.shadowBlur = 18
  const olho = (x: number, y: number, rx: number, ry: number) => {
    g.beginPath()
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    g.fill()
    g.shadowBlur = 0
    g.fillStyle = 'rgba(255,255,255,0.85)'
    g.beginPath()
    g.ellipse(x - rx * 0.3, y - ry * 0.4, rx * 0.28, ry * 0.24, 0, 0, Math.PI * 2)
    g.fill()
    g.shadowBlur = 18
    g.fillStyle = CIANO
  }
  const arco = (x: number, y: number, r: number, cima: boolean) => {
    g.lineWidth = 15
    g.beginPath()
    g.arc(x, y, r, cima ? Math.PI * 1.1 : Math.PI * 0.1, cima ? Math.PI * 1.9 : Math.PI * 0.9)
    g.stroke()
  }
  const sorriso = (w: number, h: number, y = 232) => {
    g.beginPath()
    g.moveTo(256 - w, y)
    g.quadraticCurveTo(256, y + h * 1.8, 256 + w, y)
    g.quadraticCurveTo(256, y + h * 0.25, 256 - w, y)
    g.fill()
  }
  const E = 150
  const D = 362
  switch (kind) {
    case 'open':
      olho(E, 130, 40, 52)
      olho(D, 130, 40, 52)
      sorriso(50, 40)
      break
    case 'blink':
      g.lineWidth = 14
      for (const x of [E, D]) {
        g.beginPath()
        g.moveTo(x - 36, 140)
        g.lineTo(x + 36, 140)
        g.stroke()
      }
      sorriso(50, 40)
      break
    case 'happy':
      arco(E, 150, 44, true)
      arco(D, 150, 44, true)
      sorriso(78, 62, 222)
      break
    case 'wink':
      olho(E, 130, 40, 52)
      arco(D, 150, 44, true)
      sorriso(62, 50, 226)
      break
    case 'wow':
      olho(E, 125, 50, 62)
      olho(D, 125, 50, 62)
      g.beginPath()
      g.ellipse(256, 240, 26, 34, 0, 0, Math.PI * 2)
      g.fill()
      break
    case 'think':
      olho(E - 4, 112, 38, 48)
      olho(D - 4, 112, 38, 48)
      g.lineWidth = 14
      g.beginPath()
      g.moveTo(222, 238)
      g.lineTo(296, 230)
      g.stroke()
      break
    case 'oops':
      olho(E, 140, 34, 42)
      olho(D, 140, 34, 42)
      g.lineWidth = 13
      g.beginPath()
      g.moveTo(210, 240)
      for (let i = 0; i <= 6; i += 1) g.lineTo(210 + i * 15, 240 + (i % 2 ? -12 : 12))
      g.stroke()
      break
    case 'plead':
      olho(E, 132, 48, 60)
      olho(D, 132, 48, 60)
      sorriso(34, 24, 238)
      break
    case 'love':
      for (const x of [E, D]) {
        g.beginPath()
        g.moveTo(x, 168)
        g.bezierCurveTo(x - 70, 120, x - 38, 76, x, 108)
        g.bezierCurveTo(x + 38, 76, x + 70, 120, x, 168)
        g.fill()
      }
      sorriso(66, 54, 226)
      break
  }
  return c
}

function formaCoracao(): Shape {
  const s = new Shape()
  s.moveTo(0, -0.5)
  s.bezierCurveTo(-0.15, -0.35, -0.55, -0.1, -0.5, 0.2)
  s.bezierCurveTo(-0.46, 0.5, -0.1, 0.6, 0, 0.32)
  s.bezierCurveTo(0.1, 0.6, 0.46, 0.5, 0.5, 0.2)
  s.bezierCurveTo(0.55, -0.1, 0.15, -0.35, 0, -0.5)
  return s
}

export default function Robo3D({ cena, onReady, onFail }: Props) {
  const hostRef = useRef<HTMLSpanElement>(null)
  const cenaRef = useRef(cena)
  const readyRef = useRef(onReady)
  const failRef = useRef(onFail)
  useEffect(() => {
    cenaRef.current = cena
  }, [cena])
  useEffect(() => {
    readyRef.current = onReady
    failRef.current = onFail
  }, [onReady, onFail])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    return mountScene(
      host,
      { fov: 27, position: [0, 1.0, 14], look: [0, 0.95, 0], className: 'robo3d-canvas', exposure: 0.9, envIntensity: 0.55, onReady: () => readyRef.current?.() },
      ({ scene, track, reduced }) => {
        const mat = (color: number, rough = 0.38) =>
          track(new MeshPhysicalMaterial({ color, roughness: rough, metalness: 0.03, clearcoat: 0.55, clearcoatRoughness: 0.3, sheen: 0.2 }))
        const pessego = mat(PESSEGO)
        const salmao = mat(SALMAO)
        const preto = track(new MeshPhysicalMaterial({ color: 0x0b0b0e, roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }))
        const vermelho = mat(0xe4577a, 0.3)

        const root = new Group()
        scene.add(root)

        // cabeça
        const head = new Group()
        head.position.set(0, 1.78, 0)
        root.add(head)
        const crown = new Mesh(track(new SphereGeometry(1, 48, 36)), pessego)
        crown.scale.set(1.08, 0.92, 0.9)
        head.add(crown)
        const visor = new Group()
        visor.position.set(0, -0.02, 0.56)
        visor.scale.set(1, 0.78, 0.6)
        head.add(visor)
        visor.add(new Mesh(track(new SphereGeometry(0.86, 48, 36)), preto))
        const faceMat = track(new MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false }))
        const face = new Mesh(track(new SphereGeometry(0.89, 48, 32, Math.PI / 2 - 0.78, 1.56, Math.PI / 2 - 0.52, 1.04)), faceMat)
        visor.add(face)
        // brilho do visor
        const shine = new Mesh(track(new SphereGeometry(0.1, 16, 12)), track(new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })))
        shine.scale.set(2.2, 1, 0.2)
        shine.position.set(-0.42, 0.52, 0.8)
        visor.add(shine)
        // orelhas e antenas
        for (const lado of [-1, 1]) {
          const orelha = new Mesh(track(new CylinderGeometry(0.34, 0.34, 0.26, 28)), salmao)
          orelha.rotation.z = Math.PI / 2
          orelha.position.set(lado * 1.07, -0.02, 0)
          head.add(orelha)
          const haste = new Mesh(track(new CapsuleGeometry(0.035, 0.3, 4, 8)), salmao)
          haste.position.set(lado * 0.38, 0.97, -0.05)
          haste.rotation.z = -lado * 0.3
          head.add(haste)
          const bola = new Mesh(track(new SphereGeometry(0.14, 20, 16)), pessego)
          bola.position.set(lado * 0.5, 1.2, -0.05)
          head.add(bola)
        }

        // corpo
        const corpo = new Mesh(track(new SphereGeometry(0.7, 40, 30)), pessego)
        corpo.scale.set(0.95, 1.08, 0.82)
        corpo.position.set(0, 0.5, 0)
        root.add(corpo)
        const barriga = new Mesh(track(new SphereGeometry(0.24, 24, 16)), salmao)
        barriga.scale.set(1.3, 0.78, 0.25)
        barriga.position.set(0, 0.46, 0.54)
        root.add(barriga)

        // braços (ombro > braço > cotovelo > antebraço e mão)
        interface Braco {
          lado: number
          ombro: Group
          cotovelo: Group
          atual: ArmPose
        }
        const bracoGeo = track(new CapsuleGeometry(0.13, 0.2, 6, 14))
        const antGeo = track(new CapsuleGeometry(0.115, 0.18, 6, 14))
        const maoGeo = track(new SphereGeometry(0.17, 20, 16))
        const juntaGeo = track(new SphereGeometry(0.16, 20, 16))
        const faixaGeo = track(new CylinderGeometry(0.135, 0.135, 0.06, 20))
        const bracos: Braco[] = [-1, 1].map((lado) => {
          const ombro = new Group()
          ombro.position.set(lado * 0.72, 0.88, 0)
          ombro.add(new Mesh(juntaGeo, pessego))
          const braco = new Mesh(bracoGeo, pessego)
          braco.position.y = -0.3
          ombro.add(braco)
          const faixa = new Mesh(faixaGeo, salmao)
          faixa.position.y = -0.2
          ombro.add(faixa)
          const cotovelo = new Group()
          cotovelo.position.y = -0.6
          ombro.add(cotovelo)
          const ant = new Mesh(antGeo, pessego)
          ant.position.y = -0.2
          cotovelo.add(ant)
          const mao = new Mesh(maoGeo, pessego)
          mao.position.y = -0.46
          mao.scale.set(1, 1.1, 0.9)
          cotovelo.add(mao)
          root.add(ombro)
          return { lado, ombro, cotovelo, atual: [0.2, 0, -0.12] as ArmPose }
        })

        // pernas e pés
        const pernaGeo = track(new CapsuleGeometry(0.2, 0.22, 6, 16))
        const peGeo = track(new SphereGeometry(0.3, 24, 18))
        for (const lado of [-1, 1]) {
          const perna = new Mesh(pernaGeo, pessego)
          perna.position.set(lado * 0.3, -0.5, 0)
          root.add(perna)
          const pe = new Mesh(peGeo, salmao)
          pe.scale.set(1, 0.55, 1.3)
          pe.position.set(lado * 0.3, -0.93, 0.08)
          root.add(pe)
        }

        // coração (cena "coração")
        const coracaoGeo = track(
          new ExtrudeGeometry(formaCoracao(), { depth: 0.14, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 6, curveSegments: 24 }),
        )
        coracaoGeo.center()
        const coracao = new Mesh(coracaoGeo, vermelho)
        coracao.scale.setScalar(0.5)
        coracao.position.set(0, 3.55, 0.2)
        root.add(coracao)

        // rostos (desenhados na hora, uma vez cada)
        const rostos = new Map<FaceKind, CanvasTexture>()
        const rostoDe = (k: FaceKind) => {
          let t = rostos.get(k)
          if (!t) {
            t = track(new CanvasTexture(desenharRosto(k)))
            t.colorSpace = SRGBColorSpace
            rostos.set(k, t)
          }
          return t
        }
        let faceAtual: FaceKind | null = null

        // posição inicial já na pose da cena (sem "viajar" do zero)
        const p0 = poseDa(cenaRef.current)
        bracos[0].atual = [...p0.esq]
        bracos[1].atual = [...p0.dir]
        let cabeca: [number, number] = [...p0.cabeca]
        let coracaoVis = p0.coracao ? 1 : 0
        let pulo = 0

        let piscaEm = 3.2
        let piscaAte = 0
        return {
          update: (t, dt) => {
            const cenaNome = cenaRef.current
            const pose = poseDa(cenaNome)
            const k = 1 - Math.exp(-dt * 9)

            // pisca sozinho na cena neutra
            let rosto = pose.face
            if (cenaNome === 'neutro' && !reduced) {
              if (t > piscaEm) {
                piscaAte = t + 0.13
                piscaEm = t + 3.2
              }
              if (t < piscaAte) rosto = 'blink'
            }
            if (rosto !== faceAtual) {
              faceAtual = rosto
              faceMat.map = rostoDe(rosto)
              faceMat.needsUpdate = true
            }

            const alvos: ArmPose[] = [pose.esq, pose.dir]
            bracos.forEach((b, i) => {
              for (let j = 0; j < 3; j += 1) b.atual[j] += (alvos[i][j] - b.atual[j]) * k
              const aceno = pose.acena === (i === 0 ? 'esq' : 'dir') && !reduced ? Math.sin(t * 9) * 0.3 : 0
              b.ombro.rotation.set(b.atual[1], 0, b.lado * b.atual[0])
              b.cotovelo.rotation.set(b.atual[2], 0, b.lado * aceno)
            })

            cabeca[0] += (pose.cabeca[0] - cabeca[0]) * k
            cabeca[1] += (pose.cabeca[1] - cabeca[1]) * k
            const resp = Math.sin(t * 1.8)
            head.rotation.z = cabeca[0] + Math.sin(t * 0.9) * 0.025
            head.rotation.y = cabeca[1] + Math.sin(t * 0.6) * 0.08
            head.position.y = 1.78 + resp * 0.015
            corpo.scale.set(0.95 + resp * 0.004, 1.08 + resp * 0.01, 0.82)

            // pulo da comemoração e flutuação leve
            const queroPulo = pose.pulo && !reduced ? Math.abs(Math.sin(t * 5)) * 0.35 : 0
            pulo += (queroPulo - pulo) * Math.min(1, k * 2)
            root.position.y = pulo
            root.rotation.y = Math.sin(t * 0.5) * 0.1

            coracaoVis += ((pose.coracao ? 1 : 0) - coracaoVis) * k
            coracao.visible = coracaoVis > 0.02
            coracao.scale.setScalar(0.5 * coracaoVis * (1 + Math.max(0, Math.sin(t * 4)) * 0.1))
            coracao.position.y = 3.45 + Math.sin(t * 1.4) * 0.06
            coracao.rotation.y = Math.sin(t * 0.8) * 0.4
          },
        }
      },
      () => failRef.current?.(),
    )
  }, [])

  return <span ref={hostRef} className="robo3d" aria-hidden="true" />
}
