// Cartão de envio do Rachei $: uma imagem bonita (PNG) para mandar no WhatsApp para quem participou do racha.
// Desenhada no próprio aparelho, em canvas: sem servidor e sem texto gerado por IA.

export interface CartaoLinha {
  nome: string
  /** Texto do valor, já formatado (ex.: "R$ 33,00"). */
  valor: string
  /** Frase pequena sob o nome (ex.: "paga para Ana"). */
  detalhe?: string
}

export interface CartaoRachei {
  titulo: string
  subtitulo?: string
  /** Ex.: "Total R$ 99,00". */
  totalTexto: string
  linhas: CartaoLinha[]
  /** Linha final opcional, ex.: "Pix: ana@email.com". */
  rodape?: string
}

const W = 1080
const MARROM = '#4a2c14'
const DOURADO = '#b8893a'

function arredondado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function cortar(ctx: CanvasRenderingContext2D, texto: string, largura: number): string {
  if (ctx.measureText(texto).width <= largura) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(`${t}…`).width > largura) t = t.slice(0, -1)
  return `${t}…`
}

/** Desenha o cartão. Devolve null onde não há canvas (testes, navegadores muito antigos). */
export function desenharCartao(c: CartaoRachei): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  const linhaH = 118
  const topo = 470
  const H = Math.max(1350, topo + c.linhas.length * linhaH + 250)
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const fundo = ctx.createLinearGradient(0, 0, W, H)
  fundo.addColorStop(0, '#fffaf1')
  fundo.addColorStop(1, '#efe0cc')
  ctx.fillStyle = fundo
  ctx.fillRect(0, 0, W, H)

  // moldura dupla dourada
  ctx.lineWidth = 3
  ctx.strokeStyle = DOURADO
  arredondado(ctx, 36, 36, W - 72, H - 72, 44)
  ctx.stroke()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(184,137,58,0.55)'
  arredondado(ctx, 52, 52, W - 104, H - 104, 34)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = DOURADO
  ctx.font = '600 30px Georgia, serif'
  ctx.fillText('✿  C Í R C U L A  ✿', W / 2, 135)

  ctx.fillStyle = MARROM
  ctx.font = '700 128px Georgia, serif'
  ctx.fillText('Rachei $', W / 2, 270)

  ctx.font = 'italic 38px Georgia, serif'
  ctx.fillStyle = '#7a5a3a'
  ctx.fillText(cortar(ctx, c.titulo, W - 220), W / 2, 335)
  if (c.subtitulo) {
    ctx.font = '30px Georgia, serif'
    ctx.fillText(cortar(ctx, c.subtitulo, W - 220), W / 2, 380)
  }

  // total em destaque
  const pw = 560
  const ph = 84
  const px = (W - pw) / 2
  const py = 398
  const pil = ctx.createLinearGradient(px, py, px + pw, py + ph)
  pil.addColorStop(0, '#5a3a2b')
  pil.addColorStop(1, '#3d261b')
  ctx.fillStyle = pil
  arredondado(ctx, px, py, pw, ph, 42)
  ctx.fill()
  ctx.fillStyle = '#fbf3e8'
  ctx.font = '600 40px Georgia, serif'
  ctx.fillText(cortar(ctx, c.totalTexto, pw - 40), W / 2, py + 56)

  // linhas
  let y = topo + 70
  c.linhas.forEach((l, i) => {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    arredondado(ctx, 96, y, W - 192, linhaH - 18, 30)
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = 'rgba(184,137,58,0.45)'
    ctx.stroke()

    // bolinha com a inicial
    ctx.fillStyle = i % 2 === 0 ? '#c9a45a' : '#8a5f2f'
    ctx.beginPath()
    ctx.arc(160, y + (linhaH - 18) / 2, 30, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fffaf1'
    ctx.font = '700 32px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText((l.nome.trim()[0] ?? '?').toUpperCase(), 160, y + (linhaH - 18) / 2 + 11)

    ctx.textAlign = 'left'
    ctx.fillStyle = MARROM
    ctx.font = '600 38px Georgia, serif'
    ctx.fillText(cortar(ctx, l.nome, 400), 214, y + (l.detalhe ? 46 : 62))
    if (l.detalhe) {
      ctx.fillStyle = '#8a6a4a'
      ctx.font = 'italic 27px Georgia, serif'
      ctx.fillText(cortar(ctx, l.detalhe, 400), 214, y + 78)
    }
    ctx.textAlign = 'right'
    ctx.fillStyle = MARROM
    ctx.font = '700 42px Georgia, serif'
    ctx.fillText(l.valor, W - 130, y + 62)
    y += linhaH
  })

  ctx.textAlign = 'center'
  if (c.rodape) {
    ctx.fillStyle = MARROM
    ctx.font = '600 32px Georgia, serif'
    ctx.fillText(cortar(ctx, c.rodape, W - 200), W / 2, H - 150)
  }
  ctx.fillStyle = DOURADO
  ctx.font = 'italic 28px Georgia, serif'
  ctx.fillText('Conta dividida no Círcula · conectando mulheres', W / 2, H - 100)
  return canvas
}

export function textoWhats(c: CartaoRachei): string {
  const l = [`*Rachei $* · ${c.titulo}`, c.totalTexto, '']
  for (const x of c.linhas) l.push(`• ${x.nome}: ${x.valor}${x.detalhe ? ` (${x.detalhe})` : ''}`)
  if (c.rodape) l.push('', c.rodape)
  return l.join('\n')
}

export type ResultadoEnvio = 'compartilhado' | 'baixado' | 'texto' | 'cancelado'

/** Manda o cartão: pela folha de compartilhar do celular (WhatsApp à vista); sem isso, baixa a imagem ou abre o WhatsApp com o texto. */
export async function enviarCartao(c: CartaoRachei): Promise<ResultadoEnvio> {
  const texto = textoWhats(c)
  const canvas = desenharCartao(c)
  const blob: Blob | null = canvas ? await new Promise((res) => canvas.toBlob((b) => res(b), 'image/png')) : null
  if (blob) {
    const arquivo = new File([blob], 'rachei.png', { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], text: texto, title: 'Rachei $' })
        return 'compartilhado'
      }
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return 'cancelado'
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rachei.png'
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 4000)
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
    return 'baixado'
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
  return 'texto'
}
