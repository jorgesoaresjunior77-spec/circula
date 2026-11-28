import { useEffect, useRef } from 'react'
import { CapsuleGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshPhysicalMaterial, Path, Shape, SphereGeometry } from 'three'
import { mountScene } from '../lib/scene3d'
import { clockAngles, timeParts } from './AnalogClock'
import { buildRoseDigital, buildSwiss } from './clock3dVariants'
import type { ClockStyle } from '../lib/clockStyle'

// Relógio da Home em 3D, no formato de um Apple Watch: caixa quadrada de cantos arredondados, com bisel
// e coroa lateral, e por dentro só os ponteiros (sem números nem marcações). O conjunto balança de leve e
// acompanha o dedo ou o mouse. Hora no fuso oficial do app. Com "reduzir movimento": parado e sem segundos.

interface Props {
  onFail?: () => void
  /** Modelo: clássico (padrão), rosé digital ou suíço. */
  variant?: ClockStyle
}

const DEG = Math.PI / 180
/** Caixa: largura e altura externas e raio dos cantos (unidades da cena). */
const W = 1.9
const H = 2.08
const R = 0.52
const BEZEL = 0.13

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

export default function Clock3D({ onFail, variant = 'classico' }: Props) {
  const hostRef = useRef<HTMLSpanElement>(null)
  const failRef = useRef(onFail)
  useEffect(() => {
    failRef.current = onFail
  }, [onFail])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const area = (host.closest('.home-clock') as HTMLElement | null) ?? host
    const tilt = { x: 0, y: 0, tx: 0, ty: 0 }

    return mountScene(
      host,
      { fov: 24, position: [0, 0, 6.1], look: [0, 0, 0], className: 'clock3d-canvas', exposure: 1.05 },
      ({ scene, track, reduced }) => {
        const metal = track(new MeshPhysicalMaterial({ color: 0xc9a58c, metalness: 0.75, roughness: 0.26, clearcoat: 0.6, clearcoatRoughness: 0.2 }))
        const screen = track(new MeshPhysicalMaterial({ color: 0x241914, metalness: 0.1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }))
        const cream = track(new MeshPhysicalMaterial({ color: 0xf7efe6, roughness: 0.35, metalness: 0.05, clearcoat: 0.5 }))
        const red = track(new MeshPhysicalMaterial({ color: 0xd06c5c, roughness: 0.35, metalness: 0.05, clearcoat: 0.5 }))
        const pinMat = track(new MeshPhysicalMaterial({ color: 0xd9b89f, metalness: 0.7, roughness: 0.25 }))

        const watch = new Group()
        scene.add(watch)

        // Rosé digital e suíço: outro corpo, o mesmo balanço e a mesma inclinação pelo dedo.
        if (variant !== 'classico') {
          const tick = variant === 'rose' ? buildRoseDigital(watch, track) : buildSwiss(watch, track)
          const move = (e: PointerEvent) => {
            if (reduced) return
            const box = area.getBoundingClientRect()
            tilt.tx = Math.max(-1, Math.min(1, (e.clientX - (box.left + box.width / 2)) / (box.width / 2))) * 0.26
            tilt.ty = Math.max(-1, Math.min(1, (e.clientY - (box.top + box.height / 2)) / (box.height / 2))) * 0.26
          }
          const leave = () => {
            tilt.tx = 0
            tilt.ty = 0
          }
          area.addEventListener('pointermove', move)
          area.addEventListener('pointerleave', leave)
          area.addEventListener('pointercancel', leave)
          return {
            update: (t, dt) => {
              const nowMs = Date.now()
              const p = timeParts(new Date(nowMs))
              tick(p.h, variant === 'suico' ? p.m + p.s / 60 : p.m)
              const k = 1 - Math.exp(-dt * 6)
              tilt.x += (tilt.tx - tilt.x) * k
              tilt.y += (tilt.ty - tilt.y) * k
              watch.rotation.x = tilt.y + Math.sin(t * 0.45) * 0.05 + 0.06
              watch.rotation.y = tilt.x + Math.sin(t * 0.6) * 0.12 - 0.1
            },
            dispose: () => {
              area.removeEventListener('pointermove', move)
              area.removeEventListener('pointerleave', leave)
              area.removeEventListener('pointercancel', leave)
            },
          }
        }

        // caixa (moldura com bisel) e tela escura por dentro
        const frame = roundedRect(W, H, R) as Shape
        frame.holes.push(roundedRect(W - BEZEL * 2, H - BEZEL * 2, R - BEZEL, new Path()) as Path)
        const caseGeo = track(new ExtrudeGeometry(frame, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 6, curveSegments: 24 }))
        caseGeo.translate(0, 0, -0.1)
        watch.add(new Mesh(caseGeo, metal))
        const back = new Mesh(track(new ExtrudeGeometry(roundedRect(W, H, R) as Shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 5, curveSegments: 24 })), metal)
        back.position.z = -0.26
        watch.add(back)
        const tela = new Mesh(track(new ExtrudeGeometry(roundedRect(W - BEZEL * 2, H - BEZEL * 2, R - BEZEL) as Shape, { depth: 0.02, bevelEnabled: false, curveSegments: 24 })), screen)
        tela.position.z = -0.02
        watch.add(tela)

        // coroa e botão lateral, como no Apple Watch
        const coroa = new Mesh(track(new CylinderGeometry(0.11, 0.11, 0.13, 28)), metal)
        coroa.rotation.z = Math.PI / 2
        coroa.position.set(W / 2 + 0.08, 0.36, -0.05)
        watch.add(coroa)
        const botao = new Mesh(track(new CapsuleGeometry(0.045, 0.28, 4, 12)), metal)
        botao.position.set(W / 2 + 0.03, -0.2, -0.05)
        watch.add(botao)

        // ponteiros (os mesmos de antes, finos e simples), com a base no centro
        function hand(length: number, width: number, back: number, material: MeshPhysicalMaterial, z: number) {
          const g = new Group()
          const body = new Mesh(track(new CapsuleGeometry(width / 2, length + back - width, 6, 16)), material)
          body.scale.z = 0.7
          body.position.y = (length - back) / 2
          g.add(body)
          g.position.z = z
          watch.add(g)
          return g
        }
        const hourHand = hand(0.42, 0.07, 0.05, cream, 0.03)
        const minuteHand = hand(0.66, 0.05, 0.08, cream, 0.06)
        const secondHand = hand(0.72, 0.016, 0.16, red, 0.09)
        secondHand.visible = !reduced
        const pin = new Mesh(track(new SphereGeometry(0.06, 24, 16)), pinMat)
        pin.scale.z = 0.6
        pin.position.z = 0.11
        watch.add(pin)

        function onMove(e: PointerEvent) {
          if (reduced) return
          const box = area.getBoundingClientRect()
          const dx = (e.clientX - (box.left + box.width / 2)) / (box.width / 2)
          const dy = (e.clientY - (box.top + box.height / 2)) / (box.height / 2)
          tilt.tx = Math.max(-1, Math.min(1, dx)) * 0.26
          tilt.ty = Math.max(-1, Math.min(1, dy)) * 0.26
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
            const sweepSeconds = (nowMs % 60_000) / 1000
            const a = clockAngles(parts.h, parts.m, reduced ? 0 : sweepSeconds)
            hourHand.rotation.z = -a.hour * DEG
            minuteHand.rotation.z = -a.minute * DEG
            secondHand.rotation.z = -sweepSeconds * 6 * DEG

            const k = 1 - Math.exp(-dt * 6)
            tilt.x += (tilt.tx - tilt.x) * k
            tilt.y += (tilt.ty - tilt.y) * k
            watch.rotation.x = tilt.y + Math.sin(t * 0.45) * 0.05 + 0.06
            watch.rotation.y = tilt.x + Math.sin(t * 0.6) * 0.12 - 0.1
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
  }, [variant])

  return <span ref={hostRef} className="clock3d" aria-hidden="true" />
}
