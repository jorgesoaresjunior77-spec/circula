// Paleta da foto do topo: lê a imagem da capa e tira três tons (sombra, meio, luz).
// Eles alimentam (1) o filtro de cor "circula-grade", aplicado a todas as imagens cadastradas, e
// (2) a cor de fundo atrás da barra de status do celular, para nunca aparecer uma faixa branca.

export interface HeroPalette {
  dark: [number, number, number]
  mid: [number, number, number]
  light: [number, number, number]
  top: [number, number, number]
}

function avg(list: number[][]): [number, number, number] {
  const n = Math.max(list.length, 1)
  const sum = list.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0])
  return [Math.round(sum[0] / n), Math.round(sum[1] / n), Math.round(sum[2] / n)]
}

export function paletteFromPixels(data: Uint8ClampedArray | number[], width: number, height: number): HeroPalette {
  const px: number[][] = []
  const topPx: number[][] = []
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue
    const p = [data[i], data[i + 1], data[i + 2]]
    px.push(p)
    if (Math.floor(i / 4 / width) < Math.max(2, Math.floor(height * 0.04))) topPx.push(p)
  }
  const lum = (p: number[]) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
  px.sort((a, b) => lum(a) - lum(b))
  const n = px.length
  const slice = (a: number, b: number) => px.slice(Math.floor(n * a), Math.max(Math.floor(n * b), Math.floor(n * a) + 1))
  return { dark: avg(slice(0.02, 0.22)), mid: avg(slice(0.4, 0.6)), light: avg(slice(0.78, 0.98)), top: avg(topPx.length ? topPx : px) }
}

export function readHeroPalette(url: string): Promise<HeroPalette | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const w = 48
        const h = Math.max(8, Math.round((img.naturalHeight / img.naturalWidth) * w))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(paletteFromPixels(ctx.getImageData(0, 0, w, h).data, w, h))
      } catch {
        resolve(null) // imagem sem CORS: mantém a paleta padrão
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

const f = (n: number) => (n / 255).toFixed(3)

/** Aplica a paleta: filtro de cor das imagens + cor do alto da página. */
export function applyHeroPalette(p: HeroPalette) {
  const set = (id: string, a: number, b: number, c: number) => {
    const el = document.getElementById(id)
    if (el) el.setAttribute('tableValues', `${f(a)} ${f(b)} ${f(c)}`)
  }
  set('grade-r', p.dark[0], p.mid[0], p.light[0])
  set('grade-g', p.dark[1], p.mid[1], p.light[1])
  set('grade-b', p.dark[2], p.mid[2], p.light[2])
  // O alto da foto recebe um véu claro (mesmos 40% do CSS): a cor de fundo acompanha o que se vê.
  const veil = [255, 250, 244]
  const t = p.top.map((c, i) => Math.round(c * 0.6 + veil[i] * 0.4))
  const rgb = `rgb(${t[0]}, ${t[1]}, ${t[2]})`
  document.documentElement.style.setProperty('--hero-top', rgb)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    if (!meta.getAttribute('data-original')) meta.setAttribute('data-original', meta.getAttribute('content') ?? '')
    meta.setAttribute('content', rgb)
  }
}

export function clearHeroTop() {
  document.documentElement.style.removeProperty('--hero-top')
  const meta = document.querySelector('meta[name="theme-color"]')
  const original = meta?.getAttribute('data-original')
  if (meta && original) meta.setAttribute('content', original)
}
