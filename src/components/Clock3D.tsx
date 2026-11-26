import { useEffect, useRef } from 'react'
import { BoxGeometry, CapsuleGeometry, Group, Mesh, MeshPhysicalMaterial, SphereGeometry } from 'three'
import { mountScene } from '../lib/scene3d'
import { clockAngles, timeParts } from './AnalogClock'

// Relógio da Home em 3D de verdade: marcações, ponteiros (horas, minutos e segundos), contrapeso e eixo são
// objetos em alturas diferentes, com luz e reflexo. O conjunto balança de leve e acompanha o dedo ou o mouse.
// Mostra a hora no fuso oficial do app. Com "reduzir movimento": sem balanço nem ponteiro dos segundos.

interface Props {
  onFail?: () => void
}

const DEG = Math.PI / 180

export default function Clock3D({ onFail }: Props) {
  const hostRef = useRef<HTMLSpanElement>(null)
  const failRef = useRef(onFail)
  useEffect(() => {
    failRef.current = onFail
  }, [onFail])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    // o relógio inteiro responde ao toque, mesmo fora do quadrado da cena
    const area = (host.closest('.home-clock') as HTMLElement | null) ?? host
    const tilt = { x: 0, y: 0, tx: 0, ty: 0 }

    return mountScene(
      host,
      { fov: 24, position: [0, 0, 5.2], look: [0, 0, 0], className: 'clock3d-canvas', exposure: 1.1 },
      ({ scene, track, reduced }) => {
        const mat = (color: number, extra: { metalness?: number; roughness?: number } = {}) =>
          track(new MeshPhysicalMaterial({ color, roughness: extra.roughness ?? 0.4, metalness: extra.metalness ?? 0.08, clearcoat: 0.5, clearcoatRoughness: 0.3 }))
        const dark = mat(0x33261f)
        const tickMajor = mat(0x5a463a)
        const tickMinor = mat(0xb3a497, { roughness: 0.6 })
        const red = mat(0xb8574d)
        const bronze = mat(0x7a5642, { metalness: 0.55, roughness: 0.28 })
        const white = mat(0xffffff)

        const clock = new Group()
        scene.add(clock)

        // marcações: as das horas maiores e mais escuras
        const majorGeo = track(new BoxGeometry(0.03, 0.14, 0.05))
        const minorGeo = track(new BoxGeometry(0.011, 0.05, 0.02))
        for (let i = 0; i < 60; i += 1) {
          const major = i % 5 === 0
          const tick = new Mesh(major ? majorGeo : minorGeo, major ? tickMajor : tickMinor)
          const a = i * 6 * DEG
          const r = major ? 0.81 : 0.81
          tick.position.set(Math.sin(a) * r, Math.cos(a) * r, major ? 0.025 : 0.01)
          tick.rotation.z = -a
          clock.add(tick)
        }

        // ponteiro: cápsula achatada com a base no centro, em um grupo que gira
        function hand(length: number, width: number, back: number, material: MeshPhysicalMaterial, z: number) {
          const g = new Group()
          const body = new Mesh(track(new CapsuleGeometry(width / 2, length + back - width, 6, 16)), material)
          body.scale.z = 0.9
          body.position.y = (length - back) / 2
          g.add(body)
          g.position.z = z
          clock.add(g)
          return g
        }
        const hourHand = hand(0.46, 0.075, 0.06, dark, 0.07)
        const minuteHand = hand(0.7, 0.055, 0.09, dark, 0.11)
        const secondHand = hand(0.78, 0.018, 0.2, red, 0.16)
        const weight = new Mesh(track(new SphereGeometry(0.05, 20, 14)), red)
        weight.position.set(0, -0.2, 0)
        secondHand.add(weight)
        const tip = new Mesh(track(new SphereGeometry(0.036, 18, 12)), white)
        tip.position.set(0, 0.62, 0.01)
        secondHand.add(tip)
        secondHand.visible = !reduced

        const pin = new Mesh(track(new SphereGeometry(0.075, 28, 20)), bronze)
        pin.position.z = 0.2
        clock.add(pin)

        function onMove(e: PointerEvent) {
          if (reduced) return
          const box = area.getBoundingClientRect()
          const dx = (e.clientX - (box.left + box.width / 2)) / (box.width / 2)
          const dy = (e.clientY - (box.top + box.height / 2)) / (box.height / 2)
          tilt.tx = Math.max(-1, Math.min(1, dx)) * 0.36
          tilt.ty = Math.max(-1, Math.min(1, dy)) * 0.36
        }
        function onLeave() {
          tilt.tx = 0
          tilt.ty = 0
        }
        area.addEventListener('pointermove', onMove)
        area.addEventListener('pointerleave', onLeave)
        area.addEventListener('pointercancel', onLeave)

        let cachedSecond = -1
        let parts = timeParts(new Date())
        return {
          update: (t, dt) => {
            const nowMs = Date.now()
            const wholeSecond = Math.floor(nowMs / 1000)
            if (wholeSecond !== cachedSecond) {
              cachedSecond = wholeSecond
              parts = timeParts(new Date(nowMs))
            }
            const sweepSeconds = ((nowMs % 60_000) / 1000) % 60
            const a = clockAngles(parts.h, parts.m, reduced ? 0 : sweepSeconds)
            hourHand.rotation.z = -a.hour * DEG
            minuteHand.rotation.z = -a.minute * DEG
            secondHand.rotation.z = -sweepSeconds * 6 * DEG

            // balanço lento + inclinação para onde o dedo está (suavizada)
            const k = 1 - Math.exp(-dt * 6)
            tilt.x += (tilt.tx - tilt.x) * k
            tilt.y += (tilt.ty - tilt.y) * k
            clock.rotation.x = tilt.y + Math.sin(t * 0.45) * 0.07
            clock.rotation.y = tilt.x + Math.sin(t * 0.6) * 0.14
          },
          dispose: () => {
            area.removeEventListener('pointermove', onMove)
            area.removeEventListener('pointerleave', onLeave)
            area.removeEventListener('pointercancel', onLeave)
          },
        }
      },
      () => failRef.current?.(),
    )
  }, [])

  return <span ref={hostRef} className="clock3d" aria-hidden="true" />
}
