// Sons de "criaturinha fofa" do robô mascote, sintetizados na hora (Web Audio),
// sem nenhum arquivo de áudio. Cada som é uma sequência de notas; cada nota é
// uma onda com modulação de frequência, vibrato e envelope curto.
//
// O áudio só pode ser criado/retomado depois de um toque da pessoa (iOS Safari):
// `tocarSom` tenta retomar o AudioContext a cada chamada e, se o aparelho ainda
// não liberou, simplesmente não toca. Nunca lança erro, mesmo sem Web Audio.

export type RoboSom =
  | 'feliz'
  | 'piscadinha'
  | 'apontando'
  | 'pensando'
  | 'boasvindas'
  | 'surpresa'
  | 'oops'
  | 'assinatura'
  | 'pedindo'
  | 'comemoracao'
  | 'obrigado'
  | 'moedas'
  | 'conta'
  | 'alarme'

interface Nota {
  f0: number
  f1: number
  dur: number
  fm: number
  vib?: number
  vibHz?: number
  curve?: number
  vol?: number
}
type Passo = Nota | { sil: number }

const n = (f0: number, f1: number, dur: number, fm: number, extra: Partial<Nota> = {}): Nota => ({ f0, f1, dur, fm, ...extra })
const sil = (s: number): Passo => ({ sil: s })

export const RECEITAS: Record<RoboSom, Passo[]> = {
  feliz: [n(700, 1300, 0.11, 0.8), sil(0.03), n(950, 1900, 0.16, 1.0, { vib: 0.02, vibHz: 30 })],
  piscadinha: [n(1500, 1900, 0.05, 0.5), sil(0.04), n(1300, 2100, 0.07, 0.5)],
  apontando: [n(480, 760, 0.1, 1.2, { curve: 0.6 })],
  pensando: [n(620, 880, 0.55, 0.6, { vib: 0.07, vibHz: 9, curve: 1.4, vol: 0.4 })],
  boasvindas: [
    n(800, 1100, 0.08, 0.8),
    sil(0.02),
    n(900, 1250, 0.08, 0.8),
    sil(0.02),
    n(1000, 1500, 0.09, 0.8),
    sil(0.03),
    n(1200, 2100, 0.2, 1.2, { vib: 0.03, vibHz: 28 }),
  ],
  surpresa: [n(450, 2300, 0.18, 1.0, { curve: 0.7 }), n(2300, 1900, 0.08, 0.6)],
  oops: [n(900, 520, 0.14, 1.0, { vib: 0.04, vibHz: 20 }), sil(0.03), n(620, 300, 0.22, 1.4, { vib: 0.06, vibHz: 18 })],
  assinatura: [
    n(660, 990, 0.09, 0.7),
    sil(0.02),
    n(990, 830, 0.07, 0.5),
    sil(0.02),
    n(740, 1480, 0.18, 1.1, { vib: 0.03, vibHz: 26 }),
    sil(0.02),
    n(1250, 1600, 0.1, 0.6),
  ],
  pedindo: [n(700, 900, 0.14, 0.5, { vib: 0.05, vibHz: 12 }), sil(0.05), n(760, 1000, 0.18, 0.6, { vib: 0.06, vibHz: 12 })],
  comemoracao: [
    n(600, 800, 0.08, 0.7),
    sil(0.015),
    n(800, 1000, 0.08, 0.7),
    sil(0.015),
    n(1000, 1250, 0.08, 0.7),
    sil(0.015),
    n(1250, 1600, 0.09, 0.8),
    sil(0.02),
    n(900, 2400, 0.28, 1.2, { vib: 0.03, vibHz: 30, curve: 0.8 }),
    sil(0.03),
    n(2400, 2000, 0.1, 0.6),
  ],
  obrigado: [n(880, 1100, 0.14, 0.4, { vib: 0.015, vibHz: 7 }), sil(0.04), n(1100, 1320, 0.22, 0.4, { vib: 0.02, vibHz: 7 })],
  // Finanças: moedinhas (arpejo alegre), conta (notas descendo, suaves) e alarme gentil (3 bipes e um tom grave)
  moedas: [n(880, 900, 0.07, 0.3), sil(0.02), n(1108, 1130, 0.07, 0.3), sil(0.02), n(1318, 1340, 0.07, 0.3), sil(0.02), n(1760, 1800, 0.16, 0.3, { vib: 0.01, vibHz: 6 })],
  conta: [n(740, 700, 0.12, 0.3, { vol: 0.6 }), sil(0.03), n(622, 590, 0.12, 0.3, { vol: 0.6 }), sil(0.03), n(523, 500, 0.12, 0.3, { vol: 0.55 }), sil(0.03), n(392, 370, 0.22, 0.3, { vol: 0.5 })],
  alarme: [n(1000, 1000, 0.07, 0.2, { vol: 0.5 }), sil(0.07), n(1000, 1000, 0.07, 0.2, { vol: 0.5 }), sil(0.07), n(1000, 1000, 0.07, 0.2, { vol: 0.5 }), sil(0.08), n(180, 160, 0.3, 0.3, { vol: 0.55 })],
}

/** Ganho mestre (volume baixo, fácil de ajustar). */
export const GANHO_MESTRE = 0.5
const PICO = 0.85

function sintetizarNota(nota: Nota, sr: number): Float32Array {
  const total = Math.max(2, Math.round(nota.dur * sr))
  const out = new Float32Array(total)
  const curve = nota.curve ?? 1
  const vib = nota.vib ?? 0
  const vibHz = nota.vibHz ?? 0
  const vol = nota.vol ?? 0.5
  const ataque = Math.max(1, Math.round(0.008 * sr))
  const release = Math.max(1, Math.min(Math.round(0.06 * sr), Math.floor(total / 2)))
  let fase = 0
  for (let i = 0; i < total; i++) {
    const u = Math.pow(i / (total - 1), curve)
    let f = nota.f0 + (nota.f1 - nota.f0) * u
    f *= 1 + vib * Math.sin((2 * Math.PI * vibHz * i) / sr)
    fase += (2 * Math.PI * f) / sr
    const mod = nota.fm * Math.sin(2 * fase)
    let s = Math.sin(fase + mod) + 0.25 * Math.sin(2 * fase + mod) + 0.08 * Math.sin(3 * fase)
    const env = Math.min(1, i / ataque, (total - i) / release)
    s *= env * (vol / 1.33)
    out[i] = s
  }
  return out
}

/** Gera as amostras de um som (notas concatenadas com silêncios, pico normalizado em 0,85). */
export function sintetizarSom(nome: RoboSom, sr: number): Float32Array {
  const partes: Float32Array[] = []
  for (const passo of RECEITAS[nome]) {
    partes.push('sil' in passo ? new Float32Array(Math.round(passo.sil * sr)) : sintetizarNota(passo, sr))
  }
  const total = partes.reduce((soma, p) => soma + p.length, 0)
  const saida = new Float32Array(total)
  let pos = 0
  for (const p of partes) {
    saida.set(p, pos)
    pos += p.length
  }
  let pico = 0
  for (let i = 0; i < saida.length; i++) pico = Math.max(pico, Math.abs(saida[i]))
  if (pico > 0) {
    const k = PICO / pico
    for (let i = 0; i < saida.length; i++) saida[i] *= k
  }
  return saida
}

// ---- Mudo (guardado no aparelho) ---------------------------------------------------
export const CHAVE_MUDO = 'circula:robo-som'

export function lerMudo(): boolean {
  try {
    return localStorage.getItem(CHAVE_MUDO) === 'off'
  } catch {
    return false
  }
}
export function gravarMudo(mudo: boolean) {
  try {
    localStorage.setItem(CHAVE_MUDO, mudo ? 'off' : 'on')
  } catch {
    /* sem storage: vale só nesta sessão */
  }
}

// ---- Reprodução --------------------------------------------------------------------
type ContextoAudio = AudioContext
let ctx: ContextoAudio | null = null
const buffers = new Map<RoboSom, AudioBuffer>()

function criarContexto(): ContextoAudio | null {
  if (ctx) return ctx
  try {
    const Classe = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Classe) return null
    ctx = new Classe()
    return ctx
  } catch {
    return null
  }
}

/** Chame dentro de um toque da pessoa: cria/retoma o áudio (exigência do iOS Safari). */
export function liberarAudio() {
  const c = criarContexto()
  if (c && c.state === 'suspended') void c.resume().catch(() => undefined)
}

/** Toca o som, a menos que esteja no mudo. Nunca falha. */
export function tocarSom(nome: RoboSom, mudo: boolean = lerMudo()): boolean {
  if (mudo) return false
  try {
    const c = criarContexto()
    if (!c) return false
    if (c.state === 'suspended') void c.resume().catch(() => undefined)
    let buffer = buffers.get(nome)
    if (!buffer) {
      const amostras = sintetizarSom(nome, c.sampleRate)
      buffer = c.createBuffer(1, amostras.length, c.sampleRate)
      buffer.copyToChannel(amostras as Float32Array<ArrayBuffer>, 0)
      buffers.set(nome, buffer)
    }
    const fonte = c.createBufferSource()
    fonte.buffer = buffer
    const ganho = c.createGain()
    ganho.gain.value = GANHO_MESTRE
    fonte.connect(ganho)
    ganho.connect(c.destination)
    fonte.start()
    return true
  } catch {
    return false
  }
}
