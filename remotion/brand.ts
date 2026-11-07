// Identidade visual do Círcula para os vídeos. Os valores espelham os tokens
// de src/index.css (cores e fontes); mantenha os dois em sincronia.

export const COLORS = {
  mocha: '#5a463a',
  white: '#ffffff',
  beige: '#efe5d6',
  beigeLight: '#faf6ef',
  champagne: '#c8b8a8',
  /** Texto pequeno/rótulos: o champagne tem só 1,9:1 de contraste, o taupe passa de 4,5:1. */
  taupe: '#6b5a4c',
} as const

export const FONT_DISPLAY = "'Mitr', 'Trebuchet MS', system-ui, sans-serif"
export const FONT_BODY = "'Lato', system-ui, 'Segoe UI', Roboto, sans-serif"
export const FONT_LABEL = "'Jost', 'Lato', system-ui, sans-serif"

/** Formatos usados nas redes: Reels/Stories (9:16) e feed (4:5). */
export const FORMATS = {
  story: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1350 },
} as const

export const FPS = 30
