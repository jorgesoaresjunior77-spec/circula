// Bipe do treino (Web Audio, sem arquivo de som). Regras dos navegadores no celular:
//  • o áudio só começa depois de um toque da pessoa: chame `unlockBeep()` no clique (Começar, sino);
//  • no iPhone o contexto só "acorda" de verdade se algum som tocar DENTRO do toque: tocamos um
//    silêncio de 1 amostra no desbloqueio;
//  • no iPhone a chave do silencioso cala o Web Audio por padrão: pedimos a sessão de "reprodução"
//    (navigator.audioSession, Safari 17+), a mesma de um vídeo, para o bipe sair;
//  • o contexto pode ficar "suspended"/"interrupted" (ligação, tela bloqueada): o bipe tenta retomar.
// Quem usa fecha o contexto com `closeBeep()` ao sair da tela, para nada tocar em segundo plano.

let ctx: AudioContext | null = null

function audioCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

function preferPlaybackSession() {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession && nav.audioSession.type !== 'playback') nav.audioSession.type = 'playback'
  } catch {
    /* navegador sem audioSession */
  }
}

/** Cria/retoma o áudio dentro de um gesto da pessoa. Sem Web Audio, não faz nada. */
export function unlockBeep(): void {
  const Ctor = audioCtor()
  if (!Ctor) return
  try {
    preferPlaybackSession()
    if (!ctx || ctx.state === 'closed') ctx = new Ctor()
    if (ctx.state !== 'running') void ctx.resume().catch(() => {})
    // som vazio dentro do toque: destrava o áudio no Safari do iPhone
    const buf = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start(0)
  } catch {
    ctx = null
  }
}

function play(c: AudioContext, count: number, freq: number, length: number, volume: number) {
  const start = c.currentTime + 0.01
  for (let i = 0; i < count; i += 1) {
    const t = start + i * (length + 0.07)
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
    osc.connect(gain).connect(c.destination)
    osc.start(t)
    osc.stop(t + length + 0.02)
  }
}

/** Toca um bipe (ou `count` bipes). Só se o áudio já foi liberado e a aba está visível. */
export function beep(count = 1, freq = 880, length = 0.18, volume = 0.6): void {
  const c = ctx
  if (!c || c.state === 'closed' || (typeof document !== 'undefined' && document.hidden)) return
  try {
    if (c.state === 'running') play(c, count, freq, length, volume)
    // suspenso/interrompido (ex.: depois de uma ligação): retoma e toca
    else void c.resume().then(() => play(c, count, freq, length, volume)).catch(() => {})
  } catch {
    /* sem som: o treino segue normalmente */
  }
}

/** Tique curto da contagem regressiva (3, 2, 1). */
export function tick(): void {
  beep(1, 660, 0.07, 0.4)
}

/** Para tudo e libera o áudio (ao sair da tela do treino). */
export function closeBeep(): void {
  const c = ctx
  ctx = null
  if (c && c.state !== 'closed') void c.close().catch(() => {})
}

/** Só para testes. */
export function __beepState(): AudioContext | null {
  return ctx
}
