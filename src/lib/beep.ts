// Bipe curto do treino (Web Audio, sem arquivo de som). O áudio só pode começar depois de um toque da
// pessoa (regra dos navegadores no celular): chame `unlockBeep()` no clique de "Começar". Quem usa fecha
// o contexto com `closeBeep()` ao sair da tela, para nada tocar em segundo plano.

let ctx: AudioContext | null = null

function audioCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/** Cria/retoma o áudio dentro de um gesto da pessoa. Sem Web Audio, não faz nada. */
export function unlockBeep(): void {
  const Ctor = audioCtor()
  if (!Ctor) return
  try {
    if (!ctx || ctx.state === 'closed') ctx = new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

/** Toca um bipe (ou dois, `count`). Só se o áudio já foi liberado e a aba está visível. */
export function beep(count = 1, freq = 880): void {
  if (!ctx || ctx.state !== 'running' || (typeof document !== 'undefined' && document.hidden)) return
  try {
    const start = ctx.currentTime
    for (let i = 0; i < count; i += 1) {
      const t = start + i * 0.22
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.18)
    }
  } catch {
    /* sem som: o treino segue normalmente */
  }
}

/** Para tudo e libera o áudio (ao sair da tela do treino). */
export function closeBeep(): void {
  const c = ctx
  ctx = null
  if (c && c.state !== 'closed') void c.close().catch(() => {})
}
