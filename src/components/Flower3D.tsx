import { useEffect, useRef } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three'
import { mountScene } from '../lib/scene3d'

// Flor do Meu Jardim em 3D de verdade (Three.js): pétalas com volume (curvas
// no comprimento e em concha na largura), textura aveludada (sheen), luz
// suave, miolo abaulado com sementes em espiral e um balanço orgânico, cada
// pétala no seu ritmo. Os dias/meses NÃO ficam dentro das pétalas: são
// etiquetas flutuando em volta da flor (HTML por cima, reposicionado a cada
// quadro). A pétala de um dia sem check cai uma vez, girando como uma folha.

export type PetalState = 'lit' | 'pale' | 'falling' | 'gone'

export interface PetalSpec {
  state: PetalState
  /** Cor da pétala acesa (hex). */
  color: string
  label: string
  /** Etiqueta em destaque (ex.: hoje). */
  strong?: boolean
}

interface Props {
  petals: PetalSpec[]
  center: 'core' | 'seeds'
  /** Miolo dourado (mês completo). */
  complete?: boolean
  /** Formato das pétalas: arredondadas (margarida) ou longas (girassol). */
  shape?: 'round' | 'long'
  /** Para onde a flor olha (graus), ex.: girassol virado para o sol. */
  facing?: { rotateX: number; rotateY: number }
  ariaLabel: string
  onFallDone?: () => void
  onFail?: () => void
}

const DEG = Math.PI / 180
const SEG_U = 14
const SEG_V = 8

/** Pétala paramétrica: comprimento em +Y, concha na largura e ponta curvada para a frente (+Z). */
function petalGeometry(length: number, width: number, shape: 'round' | 'long'): BufferGeometry {
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= SEG_U; i++) {
    const u = i / SEG_U
    // perfil da largura: nasce fino, abre e fecha na ponta (arredondada ou fina)
    const w = shape === 'round' ? width * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.78)), 0.75) : width * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 1.1)
    for (let j = 0; j <= SEG_V; j++) {
      const v = (j / SEG_V) * 2 - 1
      const x = v * w
      const y = u * length
      const z = 0.55 * w * v * v + 0.22 * length * u * u - 0.04 * Math.sin(Math.PI * u)
      pos.push(x, y, z)
      // base um pouco mais escura, ponta e meio mais claros (volume)
      const shade = 0.7 + 0.3 * Math.pow(u, 0.6) - 0.08 * Math.abs(v)
      col.push(shade, shade, shade)
    }
  }
  const row = SEG_V + 1
  for (let i = 0; i < SEG_U; i++) {
    for (let j = 0; j < SEG_V; j++) {
      const a = i * row + j
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

interface Fall {
  mesh: Mesh
  start: number
  delay: number
  from: Vector3
  spin: Vector3
  drift: number
  done: boolean
}

export default function Flower3D({ petals, center, complete = false, shape = 'round', facing, ariaLabel, onFallDone, onFail }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<(HTMLSpanElement | null)[]>([])
  const cbRef = useRef({ onFallDone, onFail })
  useEffect(() => {
    cbRef.current = { onFallDone, onFail }
  }, [onFallDone, onFail])
  const facingRef = useRef(facing)
  useEffect(() => {
    facingRef.current = facing
  }, [facing])

  // A cena é montada de novo só quando o desenho muda (estado das pétalas).
  const key = petals.map((p) => p.state[0] + p.color).join('|') + center + String(complete) + shape

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const n = petals.length
    return mountScene(
      host,
      { fov: 30, position: [0, -0.35, 6.2], look: [0, 0, 0], className: 'flower3d-canvas', exposure: 1.08, envIntensity: 0.85 },
      ({ scene, camera, track, reduced }) => {
        scene.add(new HemisphereLight(0xfff6ea, 0x8a6a55, 0.75))

        const flower = new Group()
        scene.add(flower)

        // ---- pétalas -------------------------------------------------------
        const long = shape === 'long'
        const length = long ? 1.18 : 1.12
        const width = long ? 0.26 : Math.min(0.34, Math.max(0.1, (2.5 / Math.max(n, 1)) * 1.25))
        const geo = track(petalGeometry(length, width, shape))
        const pale = track(
          new MeshPhysicalMaterial({ color: center === 'seeds' ? 0xf2dfa6 : 0xece3d6, roughness: 0.2, metalness: 0, clearcoat: 0.8, transparent: true, opacity: center === 'seeds' ? 0.55 : 0.3, depthWrite: false, side: DoubleSide }),
        )
        const matCache = new Map<string, MeshPhysicalMaterial>()
        const litMat = (hex: string) => {
          let mm = matCache.get(hex)
          if (!mm) {
            const c = new Color(hex)
            mm = track(
              new MeshPhysicalMaterial({
                color: c,
                vertexColors: true,
                roughness: 0.5,
                metalness: 0,
                // veludo leve: o brilho fica só nas bordas, a cor da pétala continua forte
                sheen: 0.35,
                sheenRoughness: 0.55,
                sheenColor: c.clone().lerp(new Color(0xffffff), 0.3),
                clearcoat: 0.08,
                envMapIntensity: 0.55,
                side: DoubleSide,
              }),
            )
            matCache.set(hex, mm)
          }
          return mm
        }

        const pivots: Group[] = []
        const meshes: Mesh[] = []
        const step = (Math.PI * 2) / Math.max(n, 1)
        petals.forEach((p, i) => {
          const pivot = new Group()
          pivot.rotation.z = -i * step // sentido horário, o dia 1 em cima
          const inner = n > 16 && i % 2 === 1
          const tiltFwd = (inner ? 22 : 12) * DEG
          // dia sem check: a pétala fica murcha (cor apagada) antes de cair
          const withered = '#' + new Color(p.color).lerp(new Color(0xbfae9c), 0.55).getHexString()
          const mesh = new Mesh(geo, p.state === 'pale' ? pale : litMat(p.state === 'falling' ? withered : p.color))
          mesh.rotation.x = -tiltFwd
          mesh.position.z = inner ? 0.05 : 0
          mesh.scale.setScalar(inner ? 0.9 : 1)
          mesh.visible = p.state !== 'gone'
          mesh.renderOrder = p.state === 'pale' ? 1 : 2
          pivot.add(mesh)
          flower.add(pivot)
          pivots.push(pivot)
          meshes.push(mesh)
        })

        // ---- miolo ---------------------------------------------------------
        const coreR = center === 'seeds' ? 0.42 : 0.3
        const coreGeo = track(new SphereGeometry(coreR, 40, 24))
        const coreMat = track(
          new MeshPhysicalMaterial({
            color: center === 'seeds' ? 0x5a3418 : complete ? 0xf2c03c : 0xe8dcc6,
            roughness: center === 'seeds' ? 0.85 : 0.45,
            clearcoat: center === 'seeds' ? 0.1 : 0.5,
            sheen: 0.4,
          }),
        )
        const core = new Mesh(coreGeo, coreMat)
        core.scale.set(1, 1, 0.55)
        core.position.z = 0.12
        flower.add(core)
        // sementes em espiral (filotaxia) sobre o domo
        const seedCount = center === 'seeds' ? 140 : 70
        const seedGeo = track(new SphereGeometry(1, 8, 6))
        const seedMat = track(new MeshPhysicalMaterial({ color: center === 'seeds' ? 0xd9a85e : complete ? 0xb8741c : 0xc9b391, roughness: 0.7 }))
        const seeds = new InstancedMesh(seedGeo, seedMat, seedCount)
        const m4 = new Matrix4()
        const o = new Object3D()
        for (let k = 0; k < seedCount; k++) {
          const rr = (coreR * 0.92 * Math.sqrt(k + 0.5)) / Math.sqrt(seedCount)
          const a = k * 137.5 * DEG
          const x = Math.cos(a) * rr
          const y = Math.sin(a) * rr
          const zz = 0.55 * Math.sqrt(Math.max(0, coreR * coreR - rr * rr))
          o.position.set(x, y, 0.12 + zz + 0.005)
          o.scale.setScalar(center === 'seeds' ? 0.022 : 0.016)
          o.updateMatrix()
          m4.copy(o.matrix)
          seeds.setMatrixAt(k, m4)
        }
        flower.add(seeds)

        // ---- pétalas que caem ------------------------------------------------
        const falls: Fall[] = []
        let fallIndex = 0
        petals.forEach((p, i) => {
          if (p.state !== 'falling') return
          falls.push({ mesh: meshes[i], start: -1, delay: 0.9 + fallIndex * 0.75, from: new Vector3(), spin: new Vector3(1.6 + Math.random(), 0.8, 2.2 + Math.random()), drift: (i % 2 ? 1 : -1) * (0.35 + Math.random() * 0.3), done: false })
          fallIndex++
        })
        let fallsReported = falls.length === 0
        if (reduced && falls.length) {
          falls.forEach((f) => {
            f.mesh.visible = false
            f.done = true
          })
          fallsReported = true
          window.setTimeout(() => cbRef.current.onFallDone?.(), 0)
        }

        // ---- etiquetas flutuando fora da flor ---------------------------------
        const tip = new Vector3()
        const labelR = long ? 1.62 : 1.5
        function placeLabels() {
          const w = host!.clientWidth
          const h = host!.clientHeight
          pivots.forEach((pv, i) => {
            const el = labelsRef.current[i]
            if (!el) return
            tip.set(0, labelR, 0.15)
            pv.localToWorld(tip)
            tip.project(camera)
            const x = ((tip.x + 1) / 2) * w
            const y = ((1 - tip.y) / 2) * h
            el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`
          })
        }

        let elapsed = 0
        return {
          update(t, dt) {
            elapsed += dt
            const f = facingRef.current
            const baseX = (f?.rotateX ?? 0) * DEG
            const baseY = (f?.rotateY ?? 0) * DEG
            // balanço orgânico do conjunto e de cada pétala
            flower.rotation.x = baseX + 0.14 + Math.sin(t * 0.55) * 0.09
            flower.rotation.y = baseY + Math.sin(t * 0.42) * 0.16
            flower.rotation.z = Math.sin(t * 0.3) * 0.03
            meshes.forEach((mesh, i) => {
              if (mesh.parent !== pivots[i]) return
              const inner = n > 16 && i % 2 === 1
              mesh.rotation.x = -(inner ? 22 : 12) * DEG + Math.sin(t * 1.25 + i * 0.7) * 0.045
            })

            for (const fl of falls) {
              if (fl.done) continue
              if (elapsed < fl.delay) continue
              if (fl.start < 0) {
                fl.start = elapsed
                scene.attach(fl.mesh) // solta da flor mantendo a posição
                fl.from.copy(fl.mesh.position)
                ;(fl.mesh.material as MeshPhysicalMaterial) = (fl.mesh.material as MeshPhysicalMaterial).clone()
                track(fl.mesh.material as MeshPhysicalMaterial)
                ;(fl.mesh.material as MeshPhysicalMaterial).transparent = true
              }
              const p = Math.min(1, (elapsed - fl.start) / 3.2)
              const ease = p * p * (3 - 2 * p)
              fl.mesh.position.set(
                fl.from.x + fl.drift * ease + Math.sin(p * Math.PI * 3) * 0.22,
                fl.from.y - 3.1 * Math.pow(p, 1.35),
                fl.from.z + 0.5 * Math.sin(p * Math.PI),
              )
              fl.mesh.rotation.x += fl.spin.x * dt
              fl.mesh.rotation.y += fl.spin.y * dt * Math.sin(p * 8)
              fl.mesh.rotation.z += fl.spin.z * dt * 0.6
              ;(fl.mesh.material as MeshPhysicalMaterial).opacity = p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35
              if (p >= 1) {
                fl.done = true
                fl.mesh.visible = false
              }
            }
            if (!fallsReported && falls.every((x) => x.done)) {
              fallsReported = true
              cbRef.current.onFallDone?.()
            }
            placeLabels()
          },
        }
      },
      () => cbRef.current.onFail?.(),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (
    <div className={`flower3d flower3d--${shape}`} ref={hostRef} role="img" aria-label={ariaLabel}>
      <span className="ga3d-ground" aria-hidden="true" />
      <div className="flower3d-labels" aria-hidden="true">
        {petals.map((p, i) => (
          <span
            key={i}
            ref={(el) => {
              labelsRef.current[i] = el
            }}
            className={`flower3d-label${p.strong ? ' flower3d-label--strong' : ''}${p.state === 'lit' ? ' flower3d-label--lit' : ''}${p.state === 'gone' || p.state === 'falling' ? ' flower3d-label--missed' : ''}`}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}
