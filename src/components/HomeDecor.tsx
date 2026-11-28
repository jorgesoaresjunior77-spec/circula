import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CylinderGeometry,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Group,
} from 'three'
import { supabase } from '../lib/supabase'
import { mountScene, webglDisponivel } from '../lib/scene3d'

// Natal no Início: um gorro de Papai Noel em 3D sobre o ícone que a Marluce segura na foto do topo
// (posição, tamanho e giro ajustados pela profissional no Painel, porque a foto muda) e neve que cai
// pela tela quando o celular é sacudido, como num globo de neve.

export interface HomeDecor {
  hat_enabled: boolean
  hat_x: number
  hat_y: number
  hat_size: number
  hat_rotate: number
  snow_enabled: boolean
}

export const DEFAULT_DECOR: HomeDecor = { hat_enabled: true, hat_x: 70, hat_y: 55, hat_size: 16, hat_rotate: -12, snow_enabled: true }

const CACHE = 'circula:home-decor:'

export function useHomeDecor(communityId: string | null) {
  const [decor, setDecor] = useState<HomeDecor>(() => {
    try {
      const raw = communityId ? localStorage.getItem(CACHE + communityId) : null
      return raw ? { ...DEFAULT_DECOR, ...(JSON.parse(raw) as Partial<HomeDecor>) } : DEFAULT_DECOR
    } catch {
      return DEFAULT_DECOR
    }
  })
  const refresh = useCallback(async () => {
    if (!communityId) return
    const { data } = await supabase
      .from('home_decor')
      .select('hat_enabled, hat_x, hat_y, hat_size, hat_rotate, snow_enabled')
      .eq('community_id', communityId)
      .maybeSingle()
    const next = data ? ({ ...DEFAULT_DECOR, ...(data as Partial<HomeDecor>) } as HomeDecor) : DEFAULT_DECOR
    for (const k of ['hat_x', 'hat_y', 'hat_size', 'hat_rotate'] as const) next[k] = Number(next[k])
    setDecor(next)
    try {
      localStorage.setItem(CACHE + communityId, JSON.stringify(next))
    } catch {
      /* sem storage */
    }
  }, [communityId])
  useEffect(() => {
    void refresh()
  }, [refresh])
  const save = useCallback(
    async (next: HomeDecor) => {
      if (!communityId) return 'Sem comunidade.'
      const { error } = await supabase
        .from('home_decor')
        .upsert({ community_id: communityId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'community_id' })
      if (error) return error.message
      await refresh()
      return null
    },
    [communityId, refresh],
  )
  return { decor, save }
}

/** Época de Natal: de 15 de novembro a 6 de janeiro. */
export function isChristmasSeason(now: Date = new Date()): boolean {
  const m = now.getMonth()
  const d = now.getDate()
  return (m === 10 && d >= 15) || m === 11 || (m === 0 && d <= 6)
}

// ---------------------------------------------------------------- gorro em 3D
function SantaHat3D() {
  const hostRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const host = hostRef.current
    if (!host || !webglDisponivel()) return
    return mountScene(
      host,
      { fov: 30, position: [0, 0.35, 5.2], look: [0, 0.35, 0], className: 'santa-hat-canvas', exposure: 1.1 },
      ({ scene, track }) => {
        const red = track(new MeshPhysicalMaterial({ color: 0x9e0d18, roughness: 0.72, sheen: 0.6, sheenRoughness: 0.7, sheenColor: 0xd0303c }))
        const fur = track(new MeshPhysicalMaterial({ color: 0xfbf8f3, roughness: 0.95, sheen: 1, sheenRoughness: 0.9, sheenColor: 0xffffff }))
        const hat = new Group()
        scene.add(hat)
        // cone do gorro (perfil girado), um pouco caído para o lado
        const pts: Vector2[] = []
        for (let i = 0; i <= 24; i++) {
          const t = i / 24
          pts.push(new Vector2(0.95 * Math.pow(1 - t, 1.25) + 0.02, t * 1.9))
        }
        const cone = new Mesh(track(new LatheGeometry(pts, 64)), red)
        cone.rotation.z = -0.32
        cone.position.set(0.05, 0.05, 0)
        hat.add(cone)
        // ponta caída, com o pompom
        const tip = new Mesh(track(new CylinderGeometry(0.05, 0.14, 0.7, 24)), red)
        tip.position.set(0.86, 1.62, 0)
        tip.rotation.z = -1.4
        hat.add(tip)
        const pom = new Mesh(track(new SphereGeometry(0.26, 32, 24)), fur)
        pom.position.set(1.22, 1.5, 0)
        hat.add(pom)
        // barra de pelúcia
        const brim = new Mesh(track(new TorusGeometry(0.92, 0.22, 24, 80)), fur)
        brim.rotation.x = Math.PI / 2.15
        brim.position.y = 0.02
        hat.add(brim)
        return {
          update: (t) => {
            hat.rotation.y = Math.sin(t * 0.8) * 0.25
            hat.rotation.z = Math.sin(t * 1.1) * 0.04
            pom.position.y = 1.5 + Math.sin(t * 2.2) * 0.03
          },
        }
      },
    )
  }, [])
  return <span ref={hostRef} className="santa-hat-3d" aria-hidden="true" />
}

/** Gorro posicionado sobre a foto do topo (percentuais da foto). */
export function HeroSantaHat({ decor }: { decor: HomeDecor }) {
  if (!decor.hat_enabled || !isChristmasSeason()) return null
  return (
    <span
      className="hero-santa-hat"
      style={{
        left: `${decor.hat_x}%`,
        top: `${decor.hat_y}%`,
        width: `${decor.hat_size}%`,
        transform: `translate(-50%, -70%) rotate(${decor.hat_rotate}deg)`,
      }}
    >
      <SantaHat3D />
    </span>
  )
}

// ---------------------------------------------------------------- neve ao sacudir
interface Flake {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  a: number
}

/** Neve pela tela toda quando o celular é sacudido ou movido, assentando devagar como num globo de neve. */
export function SnowGlobe({ enabled }: { enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!enabled || !isChristmasSeason()) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let reduced = false
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      /* ignore */
    }
    if (reduced) return
    const flakes: Flake[] = []
    let raf = 0
    let energy = 0
    let tiltX = 0
    let last = performance.now()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    function size() {
      canvas!.width = Math.round(window.innerWidth * dpr)
      canvas!.height = Math.round(window.innerHeight * dpr)
    }
    size()
    window.addEventListener('resize', size)

    function spawn(n: number) {
      const W = window.innerWidth
      for (let i = 0; i < n && flakes.length < 140; i++) {
        flakes.push({
          x: Math.random() * W,
          y: -10 - Math.random() * window.innerHeight * 0.5,
          vx: (Math.random() - 0.5) * 20,
          vy: 18 + Math.random() * 30,
          r: 1.2 + Math.random() * 2.6,
          a: 0.55 + Math.random() * 0.4,
        })
      }
    }
    function frame(now: number) {
      raf = 0
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const W = window.innerWidth
      const H = window.innerHeight
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.clearRect(0, 0, W, H)
      energy *= Math.pow(0.6, dt)
      for (let i = flakes.length - 1; i >= 0; i--) {
        const f = flakes[i]
        // gira devagar como neve de globo: segue a inclinação do celular e o balanço do sacudir
        f.vx += (tiltX * 30 - f.vx) * dt * 0.8 + (Math.random() - 0.5) * energy * 40 * dt
        f.vy += (26 - f.vy) * dt * 0.5
        f.x += f.vx * dt + Math.sin(now / 900 + i) * 0.25
        f.y += f.vy * dt
        if (f.y > H + 10) {
          flakes.splice(i, 1)
          continue
        }
        if (f.x < -10) f.x = W + 10
        if (f.x > W + 10) f.x = -10
        ctx!.beginPath()
        ctx!.fillStyle = `rgba(255,255,255,${f.a})`
        ctx!.shadowColor = 'rgba(120,100,90,0.35)'
        ctx!.shadowBlur = 2
        ctx!.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        ctx!.fill()
      }
      if (flakes.length > 0) raf = requestAnimationFrame(frame)
    }
    function kick(strength: number) {
      energy = Math.min(3, energy + strength)
      spawn(Math.round(18 + strength * 30))
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    let lastMag = 0
    let lastKick = 0
    function onMotion(e: DeviceMotionEvent) {
      const a = e.acceleration ?? e.accelerationIncludingGravity
      if (!a) return
      const mag = Math.abs(a.x ?? 0) + Math.abs(a.y ?? 0) + Math.abs(a.z ?? 0)
      const g = e.accelerationIncludingGravity
      if (g && typeof g.x === 'number') tiltX = Math.max(-1, Math.min(1, -g.x / 6))
      // só com movimento de verdade (sacudir, virar), não com o tremor da mão
      const jolt = e.acceleration ? mag : Math.abs(mag - lastMag)
      lastMag = mag
      const now = performance.now()
      if (jolt > 9 && now - lastKick > 350) {
        lastKick = now
        kick(Math.min(2, jolt / 15))
      }
    }
    // iPhone: o sensor só liga com permissão, pedida no primeiro toque na tela
    type MotionPerm = { requestPermission?: () => Promise<'granted' | 'denied'> }
    const needsPerm = typeof (window.DeviceMotionEvent as unknown as MotionPerm)?.requestPermission === 'function'
    function listen() {
      window.addEventListener('devicemotion', onMotion)
    }
    function askOnce() {
      document.removeEventListener('touchend', askOnce)
      void (window.DeviceMotionEvent as unknown as MotionPerm).requestPermission!()
        .then((r) => {
          if (r === 'granted') listen()
        })
        .catch(() => {})
    }
    if (needsPerm) document.addEventListener('touchend', askOnce)
    else listen()
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('resize', size)
      window.removeEventListener('devicemotion', onMotion)
      document.removeEventListener('touchend', askOnce)
    }
  }, [enabled])
  if (!enabled) return null
  return <canvas ref={canvasRef} className="snow-globe" aria-hidden="true" />
}

// ---------------------------------------------------------------- Painel
export function HomeDecorManager({ communityId }: { communityId: string }) {
  const { decor, save } = useHomeDecor(communityId)
  const [draft, setDraft] = useState<HomeDecor | null>(null)
  const [msg, setMsg] = useState('')
  const d = draft ?? decor
  const set = (patch: Partial<HomeDecor>) => setDraft({ ...d, ...patch })
  const slider = (key: 'hat_x' | 'hat_y' | 'hat_size' | 'hat_rotate', label: string, min: number, max: number, step = 0.5) => (
    <label className="decor-slider">
      {label}: <strong>{d[key]}</strong>
      <input type="range" min={min} max={max} step={step} value={d[key]} onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<HomeDecor>)} />
    </label>
  )
  return (
    <div className="decor-admin">
      <label className="decor-check">
        <input type="checkbox" checked={d.hat_enabled} onChange={(e) => set({ hat_enabled: e.target.checked })} /> Mostrar o gorro de Papai Noel (15/11 a 06/01)
      </label>
      {slider('hat_x', 'Posição na horizontal (%)', 0, 100)}
      {slider('hat_y', 'Posição na vertical (%)', 0, 100)}
      {slider('hat_size', 'Tamanho (% da largura da foto)', 4, 60)}
      {slider('hat_rotate', 'Inclinação (graus)', -90, 90, 1)}
      <label className="decor-check">
        <input type="checkbox" checked={d.snow_enabled} onChange={(e) => set({ snow_enabled: e.target.checked })} /> Neve ao sacudir o celular (15/11 a 06/01)
      </label>
      <p className="home-muted">Ajuste olhando o Início: o gorro deve ficar no canto do ícone que a Marluce segura na foto do topo.</p>
      <button
        type="button"
        className="water-primary"
        onClick={async () => {
          const err = await save(d)
          setMsg(err ? `Não foi possível salvar: ${err}` : 'Salvo.')
          if (!err) setDraft(null)
        }}
      >
        Salvar
      </button>
      {msg && <p className="home-muted">{msg}</p>}
    </div>
  )
}
