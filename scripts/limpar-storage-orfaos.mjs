#!/usr/bin/env node
// Apaga do Storage (buckets `community-media` e `avatars`) os arquivos que não
// são mais usados por nenhuma linha do banco. Uso INTERNO, no seu computador.
//
// Segurança:
//  - por padrão só LISTA (dry-run); apaga só com --apply;
//  - antes de apagar, cada arquivo precisa ter cópia em backup-storage/
//    (se não tiver, o script baixa; se não conseguir baixar, não apaga aquele);
//  - --esperado N: aborta se a quantidade de órfãos for diferente de N (evita
//    apagar algo que mudou entre a conferência e a execução).
//
//   node scripts/limpar-storage-orfaos.mjs
//   node scripts/limpar-storage-orfaos.mjs --apply --esperado 96
//
// Chave: SUPABASE_SERVICE_ROLE_KEY no .env.local (SEM prefixo VITE_).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BACKUP_DIR = path.join(ROOT, 'backup-storage')
const BUCKETS = ['community-media', 'avatars']

// Toda coluna do banco que guarda caminho ou URL de arquivo do Storage.
const REFS = [
  ['communities', 'cover_image_url'],
  ['community_card_images', 'image_path'],
  ['community_circles', 'cover_image_url'],
  ['community_content', 'cover_image_url'],
  ['community_events', 'cover_image_url'],
  ['community_partners', 'logo_path'],
  ['community_playlists', 'cover_image_url'],
  ['garden_challenges', 'cover_image_url'],
  ['joy_moments', 'image_url'],
  ['magazine_issues', 'cover_path'],
  ['magazine_pages', 'image_path'],
  ['post_comments', 'image_url'],
  ['posts', 'image_url'],
  ['product_categories', 'cover_image_url'],
  ['product_pages', 'image_path'],
  ['products', 'cover_image_url'],
  ['profiles', 'avatar_url'],
  ['profiles', 'banner_url'],
  ['profiles', 'gallery_photos'],
  ['reading_tips', 'cover_image_url'],
  ['recipe_categories', 'cover_path'],
  ['recipe_pages', 'image_path'],
  ['wellness_session_pages', 'image_path'],
  ['wellness_sessions', 'cover_image_url'],
  ['circle_requests', 'reference_image_path'],
  ['series_picks', 'cover_path'],
  ['exercise_articles', 'cover_path'],
  ['exercise_articles', 'image_paths'],
  ['travel_images', 'image_path'],
  ['travel_places', 'image_paths'],
]

function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* sem .env.local */
  }
}
loadEnv()

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const expected = args.includes('--esperado') ? Number(args[args.indexOf('--esperado') + 1]) : null

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
      if (item.id === null) out.push(...(await listAll(bucket, full)))
      else out.push({ path: full, size: item.metadata?.size ?? 0 })
    }
    if (data.length < 100) break
  }
  return out
}

// ---- tudo o que o banco referencia
const used = []
for (const [table, column] of REFS) {
  const { data, error } = await supabase.from(table).select(column).limit(10000)
  if (error) {
    console.error(`Não consegui ler ${table}.${column}: ${error.message}. Abortando (nada foi apagado).`)
    process.exit(1)
  }
  for (const row of data) {
    const value = row[column]
    if (Array.isArray(value)) used.push(...value.filter((v) => typeof v === 'string'))
    else if (typeof value === 'string' && value) used.push(value)
  }
}
const isUsed = (name) => used.some((v) => v.endsWith(name))

// ---- órfãos
const orphans = []
for (const bucket of BUCKETS) {
  for (const f of await listAll(bucket)) {
    if (!isUsed(f.path)) orphans.push({ bucket, ...f })
  }
}
const mb = (n) => (n / 1048576).toFixed(1)
console.log(`Arquivos sem referência: ${orphans.length} (${mb(orphans.reduce((n, o) => n + o.size, 0))} MB)`)
for (const o of orphans) console.log(`  ${o.bucket}/${o.path}  ${mb(o.size)} MB`)

if (!apply) {
  console.log('\nDry-run. Rode com --apply para apagar.')
  process.exit(0)
}
if (expected !== null && orphans.length !== expected) {
  console.error(`\nEsperava ${expected} órfãos e encontrei ${orphans.length}. Abortando (nada foi apagado).`)
  process.exit(1)
}

// ---- backup + remoção
let removed = 0
let skipped = 0
for (const o of orphans) {
  const local = path.join(BACKUP_DIR, o.bucket, ...o.path.split('/'))
  if (!fs.existsSync(local)) {
    const { data: blob, error } = await supabase.storage.from(o.bucket).download(o.path)
    if (error) {
      console.log(`  [pulado: sem backup] ${o.bucket}/${o.path}: ${error.message}`)
      skipped += 1
      continue
    }
    fs.mkdirSync(path.dirname(local), { recursive: true })
    fs.writeFileSync(local, Buffer.from(await blob.arrayBuffer()))
  }
  const { error } = await supabase.storage.from(o.bucket).remove([o.path])
  if (error) {
    console.log(`  [erro] ${o.bucket}/${o.path}: ${error.message}`)
    skipped += 1
  } else {
    removed += 1
  }
}
console.log(`\nApagados: ${removed}. Não apagados: ${skipped}. Cópias em backup-storage/.`)
