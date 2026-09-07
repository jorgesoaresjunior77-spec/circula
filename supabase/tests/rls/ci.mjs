#!/usr/bin/env node
// =====================================================================
// FASE P1-C — CI da suíte de RLS: baseline vs regressão vs erro de execução
// =====================================================================
// Roda `supabase/tests/rls/run.mjs --json` e classifica o resultado em:
//   • PASS            -> só as FAILs de baseline (data-count drift)      -> exit 0
//   • FAIL NOVA       -> qualquer FAIL de assertion fora do baseline     -> exit 1
//   • ERRO DE EXECUÇÃO-> a suíte NÃO rodou por completo / não pôde ser   -> exit 2
//                        interpretada (cenário ausente do aggregate,
//                        "ERRO DE EXECUÇÃO"/"Fixtures inválidas" na saída,
//                        JSON ausente/inválido, comando falhou sem saída,
//                        runner não concluiu, baseline-failures.txt
//                        inexistente)
//
// Um ERRO DE EXECUÇÃO NUNCA vira "FAIL baseline" e o baseline NUNCA é
// justificativa para ele — as checagens de execução rodam ANTES da
// comparação com o baseline e curto-circuitam para exit 2.
//
// NÃO altera nenhum cenário .sql, nem run.mjs, nem RLS/schema.
// =====================================================================
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
// remove códigos de cor ANSI (run.mjs sempre emite ESC[..m, mesmo sem TTY).
// ESC (0x1B) montado via fromCharCode para não deixar control-char no fonte.
const ANSI_RE = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g')
const stripAnsi = (s) => s.replace(ANSI_RE, '')

function execError(msg) {
  console.error('\n============================================')
  console.error(' RLS CI — ERRO DE EXECUÇÃO')
  console.error('============================================')
  console.error(msg)
  console.error('\nRESULTADO: ERRO DE EXECUÇÃO — a suíte não rodou por completo / não pôde ser interpretada.')
  console.error('(Isto NÃO é uma FAIL de baseline. O CI deve falhar.)')
  process.exit(2)
}

// ---- baseline (data-count drift conhecido) ---------------------------
let baseline
try {
  baseline = new Set(
    readFileSync(join(DIR, 'baseline-failures.txt'), 'utf8')
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim())
      .filter(Boolean),
  )
} catch (err) {
  execError('baseline-failures.txt não encontrado ou ilegível — ' + err.message)
}

// ---- conjunto de cenários ESPERADOS (mesma regra de run.mjs) --------
let expectedScenarios
try {
  expectedScenarios = readdirSync(DIR)
    .filter((f) => /^\d\d_.*\.sql$/.test(f) && f !== '00_fixtures_check.sql')
    .sort()
} catch (err) {
  execError('não consegui listar os cenários em ' + DIR + ' — ' + err.message)
}
if (expectedScenarios.length === 0) {
  execError('nenhum cenário NN_*.sql encontrado em ' + DIR)
}

// ---- roda run.mjs --json -------------------------------------------
let raw = ''
let runExit = 0
let runSignal = null
try {
  raw = execFileSync('node', [join(DIR, 'run.mjs'), '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  })
} catch (e) {
  // run.mjs sai com código 1 quando há qualquer FAIL — a saída ainda serve.
  raw = String(e.stdout || '') + String(e.stderr || '')
  runExit = typeof e.status === 'number' ? e.status : 1
  runSignal = e.signal || null
}

// ecoa a saída original do runner (útil no log do CI)
process.stdout.write(raw.endsWith('\n') ? raw : raw + '\n')

const stripped = stripAnsi(raw)

// ---- CHECAGENS DE EXECUÇÃO (antes e independente do baseline) -------

if (!raw.trim()) {
  execError('`node run.mjs --json` não produziu nenhuma saída (comando falhou?).')
}
if (runSignal) {
  execError('`run.mjs` foi terminado por sinal ' + runSignal + '.')
}
// run.mjs sai 0 (verde) ou 1 (alguma falha real). Qualquer outro código =
// crash / erro inesperado do runner.
if (runExit !== 0 && runExit !== 1) {
  execError('`run.mjs` saiu com código inesperado ' + runExit + ' (esperado 0 ou 1).')
}
if (/ERRO DE EXECU[ÇC][ÃA]O/i.test(stripped)) {
  execError('run.mjs reportou "ERRO DE EXECUÇÃO" em pelo menos um cenário — a suíte não rodou por completo.')
}
if (/Fixtures inv[áa]lidas/i.test(stripped)) {
  execError('run.mjs abortou por fixtures inválidas (UUIDs base mudaram no banco?).')
}
// o runner precisa ter chegado ao veredito final; senão, crashou no meio.
if (!/SU[ÍI]TE (VERDE|VERMELHA)/i.test(stripped)) {
  execError('run.mjs não chegou ao veredito final ("SUÍTE VERDE/VERMELHA") — provável crash no meio da execução.')
}

// ---- localiza o JSON agregado (`{`/`}` sozinhos na coluna 0) --------
const lines = stripped.split('\n')
let endIdx = -1
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i] === '}') {
    endIdx = i
    break
  }
}
let startIdx = -1
for (let i = endIdx - 1; i >= 0; i--) {
  if (lines[i] === '{') {
    startIdx = i
    break
  }
}
if (startIdx < 0 || endIdx < 0) {
  execError('não localizei o JSON agregado de `run.mjs --json` na saída.')
}

let aggregate
try {
  aggregate = JSON.parse(lines.slice(startIdx, endIdx + 1).join('\n'))
} catch (err) {
  execError('JSON agregado inválido — ' + err.message)
}
if (!aggregate || typeof aggregate !== 'object') {
  execError('JSON agregado não é um objeto.')
}

// ---- CHECAGEM: todo cenário esperado rodou e devolveu um array -----
const missing = []
const notArray = []
for (const file of expectedScenarios) {
  if (!(file in aggregate)) {
    missing.push(file)
  } else if (!Array.isArray(aggregate[file])) {
    notArray.push(file)
  }
}
if (missing.length || notArray.length) {
  const parts = []
  if (missing.length) parts.push('AUSENTE(S) do aggregate: ' + missing.join(', '))
  if (notArray.length) parts.push('sem array de resultados: ' + notArray.join(', '))
  execError(
    'cenário(s) que NÃO foram executados/interpretados corretamente:\n  ' +
      parts.join('\n  ') +
      '\n(um cenário que falha ao RODAR não aparece no aggregate — não pode ser tratado como baseline)',
  )
}

// número mínimo de asserções — sanidade extra contra aggregate vazio
let totalAssertions = 0
for (const file of expectedScenarios) totalAssertions += aggregate[file].length
if (totalAssertions === 0) {
  execError('o aggregate não contém nenhuma asserção — a suíte não produziu resultados.')
}

// ---- baseline vs regressão ----------------------------------------
const fails = []
for (const file of expectedScenarios) {
  for (const r of aggregate[file]) {
    if (r && r.ok === false && r.gap !== true) {
      fails.push({ scenario: file, name: r.name, expect: r.expect, got: r.got })
    }
  }
}

const key = (f) => `${f.scenario}: ${f.name}`
const regressions = fails.filter((f) => !baseline.has(key(f)))
const baselineHits = fails.filter((f) => baseline.has(key(f)))
const staleBaseline = [...baseline].filter((b) => !fails.some((f) => key(f) === b))

console.log('\n============================================')
console.log(' RLS CI — baseline vs regressão')
console.log('============================================')
console.log(`Cenários executados: ${expectedScenarios.length} · asserções: ${totalAssertions}`)
console.log(`FAILs de baseline (data-count drift; NÃO bloqueiam): ${baselineHits.length}`)
for (const f of baselineHits) console.log(`  · ${key(f)}  [esp ${f.expect} / obt ${f.got}]`)

if (staleBaseline.length) {
  console.log(
    `\n⚠ ${staleBaseline.length} entrada(s) do baseline não falharam mais — revise baseline-failures.txt:`,
  )
  for (const b of staleBaseline) console.log(`  · ${b}`)
}

if (regressions.length) {
  console.log(`\n✖ REGRESSÕES NOVAS (bloqueiam o merge): ${regressions.length}`)
  for (const f of regressions) console.log(`  ✖ ${key(f)}  [esp ${f.expect} / obt ${f.got}]`)
  console.log('\nRESULTADO: FALHOU — regressão de RLS não listada no baseline.')
  process.exit(1)
}

console.log('\n✔ Nenhuma regressão nova. Apenas as FAILs de baseline conhecidas.')
console.log('RESULTADO: OK')
process.exit(0)
