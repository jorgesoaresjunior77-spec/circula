#!/usr/bin/env node
// Gera imagens da marca Círcula (capas de cards, arte do Meu Jardim) com a
// API de imagens da OpenAI. Uso INTERNO: roda no seu computador, a chave
// nunca vai para o app nem para o navegador, e o app não chama a OpenAI —
// as imagens geradas são cadastradas depois pelo Painel (Imagens da
// comunidade), como qualquer outra capa. Ver docs/ESPECIFICACAO_CIRCULA.md,
// seção 4 (sem IA gerando conteúdo para as participantes).
//
//   node scripts/gerar-imagem.mjs --lista
//   node scripts/gerar-imagem.mjs jardim-broto
//   node scripts/gerar-imagem.mjs capa-jardim --n 3
//   node scripts/gerar-imagem.mjs --prompt "uma xícara de chá ao pôr do sol" --size 1536x1024
//   node scripts/gerar-imagem.mjs jardim-flor --dry     (só mostra o prompt)
//
// Chave: OPENAI_API_KEY no .env.local (SEM prefixo VITE_ — esse prefixo
// jogaria a chave para o navegador). O .env.local já é ignorado pelo git.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'identidadevisual', 'Meu Jardim', 'gerados') // pasta já ignorada pelo git
const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'

// Identidade visual — a mesma dos cards da Home: luz dourada de fim de
// tarde, tons champagne/rosé/areia/sálvia, acabamento editorial suave.
const STYLE =
  'Warm golden-hour light, soft editorial look, refined and calm. ' +
  'Palette: champagne, soft rose, peach, sand and sage green on a warm cream tone. ' +
  'Delicate, elegant, feminine, never childish, never cartoonish. ' +
  'No text, no letters, no logos, no watermark.'

const ILUSTRACAO =
  'Delicate botanical watercolor illustration with fine line detail, centered subject, ' +
  'transparent background, consistent series style. '

const PRESETS = {
  'jardim-broto': {
    size: '1024x1024',
    background: 'transparent',
    prompt:
      ILUSTRACAO +
      'A tiny seedling just sprouting from a small mound of soil: two small tender sage-green leaves, ' +
      'a hint of dew, lots of empty space around it. Stage 1 of 3 of a garden growing. ' + STYLE,
  },
  'jardim-flor': {
    size: '1024x1024',
    background: 'transparent',
    prompt:
      ILUSTRACAO +
      'A single graceful flower in full bloom on a slender stem with a few leaves, soft rose and peach petals, ' +
      'a small bud beside it. Stage 2 of 3 of a garden growing. ' + STYLE,
  },
  'jardim-cheio': {
    size: '1024x1024',
    background: 'transparent',
    prompt:
      ILUSTRACAO +
      'A lush small garden in full bloom: several flowers of different heights in rose, peach, lavender and sand, ' +
      'sage-green foliage, a butterfly. Abundant but airy and harmonious. Stage 3 of 3 of a garden growing. ' + STYLE,
  },
  'capa-jardim': {
    size: '1536x1024',
    prompt:
      'Cover photograph for a card named "Meu Jardim" in a women\'s wellbeing community app: ' +
      'a serene sunlit garden at golden hour, blooming flowers in soft rose and peach, sage-green leaves, ' +
      'a ceramic watering can and a linen cloth on a wooden table, shallow depth of field, ' +
      'cinematic soft light, photorealistic, space in the lower-left for a title overlay. ' + STYLE,
  },
}

function loadEnvLocal() {
  const file = path.join(ROOT, '.env.local')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

function parseArgs(argv) {
  const args = { n: 1, dry: false, list: false, preset: null, prompt: null, size: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--lista') args.list = true
    else if (a === '--dry') args.dry = true
    else if (a === '--n') args.n = Math.max(1, Math.min(4, Number(argv[++i]) || 1))
    else if (a === '--prompt') args.prompt = argv[++i]
    else if (a === '--size') args.size = argv[++i]
    else if (!a.startsWith('--')) args.preset = a
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.list || (!args.preset && !args.prompt)) {
    console.log('Presets disponíveis:')
    for (const [k, v] of Object.entries(PRESETS)) console.log(`  ${k}  (${v.size})`)
    console.log('\nOu use --prompt "texto" [--size 1024x1024|1536x1024|1024x1536]')
    return
  }

  const preset = args.preset ? PRESETS[args.preset] : null
  if (args.preset && !preset) throw new Error(`Preset desconhecido: ${args.preset}. Use --lista.`)
  const body = {
    model: MODEL,
    prompt: args.prompt ? `${args.prompt} ${STYLE}` : preset.prompt,
    size: args.size || preset?.size || '1024x1024',
    n: args.n,
    quality: 'high',
  }
  if (preset?.background) {
    body.background = preset.background
    body.output_format = 'png'
  }

  if (args.dry) {
    console.log(JSON.stringify(body, null, 2))
    return
  }

  loadEnvLocal()
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error('OPENAI_API_KEY não encontrada. Adicione a linha OPENAI_API_KEY=... ao .env.local (sem VITE_).')
  }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${json?.error?.message ?? 'erro desconhecido'}`)

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const base = args.preset || 'livre'
  json.data.forEach((img, i) => {
    const file = path.join(OUT_DIR, `${base}-${stamp}-${i + 1}.png`)
    fs.writeFileSync(file, Buffer.from(img.b64_json, 'base64'))
    console.log('Salvo:', path.relative(ROOT, file))
  })
}

main().catch((e) => {
  console.error(e.message)
  process.exitCode = 1 // sem process.exit(): evita o assert do libuv no Windows com fetch aberto
})
