import { useEffect, useRef } from 'react'
import { CatmullRomCurve3, Group, LatheGeometry, Mesh, MeshPhysicalMaterial, SphereGeometry, TorusGeometry, Vector2, Vector3 } from 'three'
import { mountScene } from '../lib/scene3d'

// Sino da Home em 3D: corpo de revolução suavizado, argola no topo e badalo. Pendurado pelo topo, balança
// de verdade (com pausa entre um toque e outro) quando há notificação; sem notificação, fica parado,
// de leve virado, só em relevo. Carregado sob demanda; libera a GPU ao sair da tela.

interface Props {
  ringing: boolean
  onFail?: () => void
}

/** Ângulo do balanço (radianos) em `t` segundos: toca ~1,1 s, amortecendo, e descansa ~1,8 s. */
export function bellSwing(t: number): number {
  const cycle = 2.9
  const p = ((t % cycle) + cycle) % cycle
  if (p > 1.1) return 0
  const u = p / 1.1
  return -0.31 * Math.sin(u * Math.PI * 5) * (1 - u) ** 1.2
}

export default function Bell3D({ ringing, onFail }: Props) {
  const hostRef = useRef<HTMLSpanElement>(null)
  const ringingRef = useRef(ringing)
  const failRef = useRef(onFail)

  useEffect(() => {
    ringingRef.current = ringing
  }, [ringing])
  useEffect(() => {
    failRef.current = onFail
  }, [onFail])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    return mountScene(
      host,
      { fov: 26, position: [0, 0.1, 8.2], look: [0, 0.05, 0], className: 'bell3d-canvas', exposure: 1.1 },
      ({ scene, track }) => {
        const white = track(new MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.3 }))
        const shade = track(new MeshPhysicalMaterial({ color: 0xf1e6da, roughness: 0.4, metalness: 0.05 }))

        // perfil do sino (raio, altura), da borda até o topo
        const pts = [
          [1.12, -0.82],
          [1.06, -0.7],
          [0.9, -0.32],
          [0.62, 0.34],
          [0.4, 0.78],
          [0.2, 1.05],
          [0.001, 1.16],
        ].map(([r, y]) => new Vector3(r, y, 0))
        const profile = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5).getPoints(40).map((p) => new Vector2(Math.max(0.001, p.x), p.y))
        const body = new Mesh(track(new LatheGeometry(profile, 56)), white)

        const rim = new Mesh(track(new TorusGeometry(1.1, 0.075, 16, 56)), white)
        rim.rotation.x = Math.PI / 2
        rim.position.y = -0.8
        const loop = new Mesh(track(new TorusGeometry(0.16, 0.045, 12, 28)), shade)
        loop.position.y = 1.36
        const clapper = new Mesh(track(new SphereGeometry(0.26, 24, 18)), shade)
        clapper.position.y = -1.0

        const bell = new Group()
        bell.add(body, rim, loop, clapper)
        // o eixo de giro fica na argola, no topo
        const pivot = new Group()
        pivot.position.y = 1.36
        bell.position.y = -1.36
        pivot.add(bell)
        pivot.position.y += -0.2
        scene.add(pivot)

        pivot.rotation.set(0.12, -0.42, 0)
        return {
          update: (t) => {
            const swing = ringingRef.current ? bellSwing(t) : 0
            pivot.rotation.z = swing
            // o badalo atrasa um pouco em relação ao corpo
            clapper.position.x = ringingRef.current ? -Math.sin(swing * 1.6) * 0.18 : 0
          },
        }
      },
      () => failRef.current?.(),
    )
  }, [])

  return <span ref={hostRef} className="bell3d" aria-hidden="true" />
}
