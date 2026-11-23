#!/usr/bin/env node
// Prepara as imagens do robô mascote: tira o fundo branco, ALINHA a tela preta da
// cabeça de todas as cenas na mesma posição (a troca de cena não "pula") e exporta
// WebP em public/robo/<cena>.webp.
//
//   node scripts/processar-robo.mjs
//   node scripts/processar-robo.mjs "C:\\caminho\\da\\pasta" --escala 2
//
// Também grava scripts/robo-conferencia.png (todas as cenas sobrepostas, para conferir o alinhamento).
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const pasta = args.find((a) => !a.startsWith('--')) ?? path.join(raiz, 'identidadevisual', 'Circula Robot')
const escala = Number(args[args.indexOf('--escala') + 1]) || 2
const saida = path.join(raiz, 'public', 'robo')

// cena -> arquivo da pasta. Cenas repetidas (apresenta, aponta-esquerda) vêm de outra cena.
// As imagens image15 a image21 têm a tela da cabeça vazia (sem olhos nem boca) e a image22 é uma
// folha com vários robôs: não entram, porque o rosto não pode ser desenhado por cima.
const CENAS = {
  neutro: 'image2.png',
  'neutro-piscando': 'image14.png',
  feliz: 'image13.png',
  piscadinha: 'image12.png',
  'aponta-direita': 'image11.png',
  'aponta-cima': 'image10.png',
  'aponta-baixo': 'image9.png',
  pensando: 'image8.png',
  acena: 'image7.png',
  'boas-vindas': 'image6.png',
  surpresa: 'image5.png',
  oops: 'image3.png',
  comemora: 'image0 (3).png',
  coracao: 'image4.png',
  pedindo: 'image1 (2).png',
}

async function carregar(arquivo) {
  const { data, info } = await sharp(path.join(pasta, arquivo)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data: Buffer.from(data), w: info.width, h: info.height }
}

const branco = (d, i) => Math.min(d[i], d[i + 1], d[i + 2]) > 232 && d[i + 3] > 0

/** Remove o branco ligado às bordas (flood-fill) e suaviza a beira. */
function tirarFundo(img) {
  const { data: d, w, h } = img
  const fundo = new Uint8Array(w * h)
  const fila = []
  const empurrar = (x, y) => {
    const p = y * w + x
    if (x < 0 || y < 0 || x >= w || y >= h || fundo[p] || !branco(d, p * 4)) return
    fundo[p] = 1
    fila.push(p)
  }
  for (let x = 0; x < w; x++) (empurrar(x, 0), empurrar(x, h - 1))
  for (let y = 0; y < h; y++) (empurrar(0, y), empurrar(w - 1, y))
  while (fila.length) {
    const p = fila.pop()
    const x = p % w
    const y = (p - x) / w
    empurrar(x + 1, y)
    empurrar(x - 1, y)
    empurrar(x, y + 1)
    empurrar(x, y - 1)
  }
  for (let p = 0; p < w * h; p++) if (fundo[p]) d[p * 4 + 3] = 0
  // beira: pixels que encostam no fundo e ainda são claros ficam semitransparentes
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x
      if (fundo[p]) continue
      if (!(fundo[p - 1] || fundo[p + 1] || fundo[p - w] || fundo[p + w])) continue
      const claro = Math.min(d[p * 4], d[p * 4 + 1], d[p * 4 + 2])
      if (claro > 205) d[p * 4 + 3] = Math.round(((255 - claro) / 50) * 255)
    }
  }
}

/** Retângulo da maior região escura contígua (a tela preta da cabeça; os olhos ficam dentro). */
function acharTela(img) {
  const { data: d, w, h } = img
  const escuro = (p) => d[p * 4 + 3] > 200 && d[p * 4] + d[p * 4 + 1] + d[p * 4 + 2] < 3 * 75
  const visto = new Uint8Array(w * h)
  let melhor = null
  for (let s = 0; s < w * h; s++) {
    if (visto[s] || !escuro(s)) continue
    const pilha = [s]
    visto[s] = 1
    let n = 0
    let x0 = w, y0 = h, x1 = 0, y1 = 0
    while (pilha.length) {
      const p = pilha.pop()
      const x = p % w
      const y = (p - x) / w
      n++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (const q of [p + 1, p - 1, p + w, p - w]) {
        if (q < 0 || q >= w * h || visto[q] || !escuro(q)) continue
        if ((q === p + 1 && x + 1 >= w) || (q === p - 1 && x === 0)) continue
        visto[q] = 1
        pilha.push(q)
      }
    }
    if (!melhor || n > melhor.n) melhor = { n, x0, y0, x1, y1 }
  }
  if (!melhor) throw new Error('tela preta não encontrada')
  return { x: melhor.x0, y: melhor.y0, w: melhor.x1 - melhor.x0 + 1, h: melhor.y1 - melhor.y0 + 1 }
}

async function main() {
  fs.mkdirSync(saida, { recursive: true })
  const cenas = {}
  for (const [nome, arq] of Object.entries(CENAS)) {
    if (!fs.existsSync(path.join(pasta, arq))) {
      console.warn(`FALTA: ${nome} (${arq})`)
      continue
    }
    const img = await carregar(arq)
    tirarFundo(img)
    cenas[nome] = { img, tela: acharTela(img) }
  }
  const ref = cenas.neutro
  if (!ref) throw new Error('a cena "neutro" é necessária como referência')
  const W = ref.img.w * escala
  const H = ref.img.h * escala
  const refCx = (ref.tela.x + ref.tela.w / 2) * escala
  const refCy = (ref.tela.y + ref.tela.h / 2) * escala

  const quadros = []
  for (const [nome, { img, tela }] of Object.entries(cenas)) {
    const s = ((ref.tela.w / tela.w + ref.tela.h / tela.h) / 2) * escala
    const nw = Math.round(img.w * s)
    const nh = Math.round(img.h * s)
    const esq = Math.round(refCx - (tela.x + tela.w / 2) * s)
    const topo = Math.round(refCy - (tela.y + tela.h / 2) * s)
    const redim = await sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } }).resize(nw, nh, { kernel: 'lanczos3' }).png().toBuffer()
    const ox = Math.round(W / 2)
    const oy = Math.round(H / 2)
    const grande = await sharp({ create: { width: W * 2, height: H * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: redim, left: esq + ox, top: topo + oy }])
      .png()
      .toBuffer()
    const recortado = await sharp(grande).extract({ left: ox, top: oy, width: W, height: H }).png().toBuffer()
    const quadro = recortado
    quadros.push(quadro)
    const arquivo = path.join(saida, `${nome}.webp`)
    await sharp(quadro).webp({ quality: 85, alphaQuality: 90 }).toFile(arquivo)
    const kb = (fs.statSync(arquivo).size / 1024).toFixed(1)
    console.log(`${nome.padEnd(16)} tela ${tela.w}x${tela.h}@${tela.x},${tela.y}  escala ${s.toFixed(3)}  ${kb} KB`)
  }
  // conferência: todas as cenas sobrepostas sobre cinza
  const base = sharp({ create: { width: W, height: H, channels: 4, background: '#8a8a8a' } })
  const camadas = []
  for (const q of quadros) {
    const m = await sharp(q).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let i = 3; i < m.data.length; i += 4) m.data[i] = Math.round(m.data[i] * 0.22)
    camadas.push({ input: await sharp(m.data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer() })
  }
  await base.composite(camadas).png().toFile(path.join(raiz, 'scripts', 'robo-conferencia.png'))
  console.log('Conferência: scripts/robo-conferencia.png')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
