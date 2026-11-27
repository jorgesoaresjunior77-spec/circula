import { useEffect, useRef } from 'react'
import { CatmullRomCurve3, Group, LatheGeometry, Mesh, MeshPhysicalMaterial, SphereGeometry, TorusGeometry, Vector2, Vector3 } from 'three'
import { mountScene } from '../lib/scene3d'

// Sino da Home em 3D: sino clássico de metal dourado (boca larga, cintura e cúpula), argola no topo e badalo. Pendurado pelo topo, balança
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
      { fov: 26, position: [0, 0.1, 8.2], look: [0, 0.05, 0], className: 'bell3d-canvas', exposure: 1.05, envIntensity: 1.2 },
      ({ scene, track }) => {
        // sino de verdade, de metal dourado: o reflexo do ambiente é que dá o volume
        const gold = track(new MeshPhysicalMaterial({ color: 0xd8a650, roughness: 0.26, metalness: 1, clearcoat: 0.4, clearcoatRoughness: 0.25 }))
        const darkGold = track(new MeshPhysicalMaterial({ color: 0x9a6a2a, roughness: 0.35, metalness: 1 }))

        // perfil clássico (raio, altura), da boca até o topo: boca aberta com borda grossa,
        // cintura fina, ombro arredondado e cúpula
        const pts = [
          [1.18, -0.86],
          [1.13, -0.74],
          [0.96, -0.58],
          [0.76, -0.3],
          [0.66, 0.02],
          [0.64, 0.36],
          [0.6, 0.62],
          [0.5, 0.84],
          [0.3, 0.99],
          [0.001, 1.04],
        ].map(([r, y]) => new Vector3(r, y, 0))
        const profile = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5).getPoints(48).map((p) => new Vector2(Math.max(0.001, p.x), p.y))
        const body = new Mesh(track(new LatheGeometry(profile, 64)), gold)

        const rim = new Mesh(track(new TorusGeometry(1.16, 0.085, 16, 64)), gold)
        rim.rotation.x = Math.PI / 2
        rim.position.y = -0.84
        const loop = new Mesh(track(new TorusGeometry(0.2, 0.06, 14, 32)), darkGold)
        loop.position.y = 1.22
        const clapper = new Mesh(track(new SphereGeometry(0.24, 24, 18)), darkGold)
        clapper.position.y = -0.98

        const bell = new Group()
        bell.add(body, rim, loop, clapper)
        // o eixo de giro fica na argola, no topo
        const pivot = new Group()
        pivot.position.y = 1.22
        bell.position.y = -1.22
        pivot.add(bell)
        pivot.position.y += -0.12
        scene.add(pivot)

        pivot.rotation.set(0.16, -0.42, 0)
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
