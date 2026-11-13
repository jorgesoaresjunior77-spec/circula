#!/usr/bin/env node
// Reduz as imagens JÁ enviadas aos buckets `community-media` e `avatars`
// (capas em PNG de 2,5 MB, fotos de celular de 11 MB...), que são o que mais
// gasta o egress do Supabase. Uso INTERNO: roda no seu computador.
//
// Regras de segurança:
//  - o PATH e a extensão do arquivo NÃO mudam (reescreve no mesmo caminho),
//    então nenhuma linha do banco precisa ser alterada;
//  - por padrão é DRY-RUN: só lista o que faria e quanto economizaria;
//  - nunca apaga nada. Arquivos que não são imagem web (ex.: .dng) só são
//    listados — apague-os à mão no painel do Supabase, se quiser.
//
//   node scripts/otimizar-storage.mjs                 (dry-run, os 2 buckets)
//   node scripts/otimizar-storage.mjs --bucket avatars
//   node scripts/otimizar-storage.mjs --apply          (regrava de verdade)
//
// Chave: SUPABASE_SERVICE_ROLE_KEY no .env.local (SEM prefixo VITE_). A URL vem
// de VITE_SUPABASE_URL. O .env.local já é ignorado pelo git.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MIN_BYTES = 300 * 1024 // abaixo disso não compensa mexer
const MAX_SIDE = 1600
const CACHE = '31536000'

function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* sem .env.local */ }
}
loadEnv()

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const bucketArg = args.includes('--bucket') ? args[args.indexOf('--bucket') + 1] : null
const buckets = bucketArg ? [bucketArg] : ['community-media', 'avatars']

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

async function listAll(bucket, prefix = '') {
  const out = []
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100, offset })
    if (error) throw error
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id === null) out.push(...(await listAll(bucket, full))) // pasta
      else out.push({ path: full, size: item.metadata?.size ?? 0, mime: item.metadata?.mimetype ?? '' })
    }
    if (data.length < 100) break
  }
  return out
}

function encoder(ext) {
  if (ext === 'png') return (img) => img.png({ palette: true, quality: 80, compressionLevel: 9 })
  if (ext === 'webp') return (img) => img.webp({ quality: 80 })
  return (img) => img.jpeg({ quality: 80, mozjpeg: true })
}

const mb = (n) => (n / 1048576).toFixed(2)
let totalBefore = 0
let totalAfter = 0

for (const bucket of buckets) {
  console.log(`\n== ${bucket} ==`)
  const files = (await listAll(bucket)).sort((a, b) => b.size - a.size)
  for (const f of files) {
    const ext = f.path.split('.').pop()?.toLowerCase() ?? ''
    const isWeb = ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
    if (!isWeb) {
      if (f.size >= MIN_BYTES) console.log(`  [manual] ${f.path}  ${mb(f.size)} MB  (não é imagem web — apague/substitua no painel)`)
      continue
    }
    if (f.size < MIN_BYTES) continue

    const { data: blob, error } = await supabase.storage.from(bucket).download(f.path)
    if (error) { console.log(`  [erro] ${f.path}: ${error.message}`); continue }
    const input = Buffer.from(await blob.arrayBuffer())
    let output
    try {
      output = await encoder(ext)(
        sharp(input).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true }),
      ).toBuffer()
    } catch (e) {
      console.log(`  [erro] ${f.path}: ${e.message}`)
      continue
    }
    if (output.length >= input.length * 0.9) continue // ganho pequeno: deixa como está

    totalBefore += input.length
    totalAfter += output.length
    console.log(`  ${apply ? '[ok]' : '[dry]'} ${f.path}  ${mb(input.length)} -> ${mb(output.length)} MB`)
    if (apply) {
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(f.path, output, { upsert: true, contentType, cacheControl: CACHE })
      if (upErr) console.log(`  [erro upload] ${f.path}: ${upErr.message}`)
    }
  }
}

console.log(`\n${apply ? 'Reduzido' : 'Economia estimada'}: ${mb(totalBefore)} MB -> ${mb(totalAfter)} MB`)
if (!apply) console.log('Dry-run. Rode com --apply para regravar.')
