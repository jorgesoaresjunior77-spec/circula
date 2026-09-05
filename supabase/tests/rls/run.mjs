#!/usr/bin/env node
// =====================================================================
// Runner da Suíte de Testes de RLS do Círcula — Fase 12.1
// =====================================================================
// Para cada cenário NN_*.sql:
//   1. concatena _framework.sql + o arquivo do cenário num arquivo temp
//   2. executa via `supabase db query --linked` (Management API)
//   3. o cenário termina em ROLLBACK -> nada é persistido
//   4. lê o array `results` (última instrução) e imprime PASS/FAIL
//
// Saída:
//   exit 0  -> todos os testes non-gap passaram
//   exit 1  -> alguma falha real (ou fixtures inválidas, ou erro de exec)
//   falhas marcadas [GAP] são reportadas à parte e NÃO afetam o exit code
//
// Uso:
//   node run.mjs                # roda tudo
//   node run.mjs 30             # roda só cenários cujo nome contém "30"
//   node run.mjs --json         # imprime o JSON agregado ao final
// =====================================================================

import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const wantJson = args.includes('--json');
const filter = args.find((a) => !a.startsWith('--')) || '';

const framework = readFileSync(join(DIR, '_framework.sql'), 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'rls-suite-'));
process.on('exit', () => { try { rmSync(tmp, { recursive: true, force: true }); } catch {} });

const C = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', dim: '\x1b[2m', bold: '\x1b[1m',
};

const isWin = process.platform === 'win32';

function query(sqlPath) {
  const arg = isWin ? `"${sqlPath}"` : sqlPath;
  const raw = execFileSync(
    'npx',
    ['--yes', 'supabase', 'db', 'query', '--linked', '--output-format', 'json', '-f', arg],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 32, shell: true },
  );
  // a saída começa com "Initialising login role..." antes do JSON
  const start = raw.indexOf('{');
  if (start < 0) throw new Error('resposta sem JSON:\n' + raw);
  return JSON.parse(raw.slice(start));
}

function runScenario(file) {
  const scenario = readFileSync(join(DIR, file), 'utf8');
  const path = join(tmp, file);
  writeFileSync(path, framework + '\n' + scenario);
  const parsed = query(path);
  const row = parsed.rows?.[0];
  const results = row?.results;
  if (!Array.isArray(results)) {
    throw new Error(`cenário ${file} não devolveu array "results". Recebido:\n${JSON.stringify(parsed, null, 2)}`);
  }
  return results;
}

// --------------------------------------------------------------------
const scenarioFiles = readdirSync(DIR)
  .filter((f) => /^\d\d_.*\.sql$/.test(f) && f !== '00_fixtures_check.sql')
  .filter((f) => !filter || f.includes(filter))
  .sort();

let totalPass = 0;
let totalFail = 0;
let totalGap = 0;
const failLines = [];
const gapLines = [];
const perScenario = {};
const aggregate = {};

console.log(`${C.bold}=== Círcula — Suíte de Testes de RLS (Fase 12.1) ===${C.reset}`);
console.log(`${C.dim}Alvo: projeto LINKED. Cada cenário roda numa transação encerrada em ROLLBACK.${C.reset}\n`);

// ---- 00 — fixtures -------------------------------------------------
if (!filter || '00_fixtures_check.sql'.includes(filter)) {
  process.stdout.write('00_fixtures_check … ');
  try {
    const parsed = query(join(DIR, '00_fixtures_check.sql'));
    const fx = parsed.rows?.[0]?.fixtures;
    aggregate['00_fixtures_check'] = fx;
    if (fx?.ok === true && fx?.migration_12_4_aplicada === true) {
      console.log(`${C.green}OK${C.reset}  ${C.dim}${JSON.stringify(fx.counts)}${C.reset}`);
    } else {
      console.log(`${C.red}FALHOU${C.reset}`);
      console.log(JSON.stringify(fx, null, 2));
      console.log(`\n${C.red}Fixtures inválidas — abortando. Os UUIDs base mudaram no banco.${C.reset}`);
      process.exit(1);
    }
  } catch (e) {
    console.log(`${C.red}ERRO${C.reset}\n${e.message}`);
    process.exit(1);
  }
  console.log();
}

// ---- cenários ----------------------------------------------------
for (const file of scenarioFiles) {
  console.log(`${C.bold}--- ${file} ---${C.reset}`);
  let results;
  try {
    results = runScenario(file);
  } catch (e) {
    console.log(`${C.red}ERRO DE EXECUÇÃO${C.reset}\n${e.message}\n`);
    totalFail++;
    failLines.push(`${file}: erro de execução — ${e.message.split('\n')[0]}`);
    continue;
  }
  aggregate[file] = results;
  let p = 0, f = 0, g = 0;
  for (const r of results) {
    const tag = `[${r.kind}]`.padEnd(8);
    if (r.ok) {
      p++;
      console.log(`  ${C.green}PASS${C.reset} ${C.dim}${tag}${C.reset} ${r.name}`);
    } else if (r.gap) {
      g++;
      console.log(`  ${C.yellow}GAP ${C.reset} ${C.dim}${tag}${C.reset} ${r.name} ${C.dim}(esperado ${r.expect}, obteve ${r.got})${C.reset}`);
      gapLines.push(`${file}: ${r.name} (esperado ${r.expect}, obteve ${r.got})`);
    } else {
      f++;
      console.log(`  ${C.red}FAIL${C.reset} ${C.dim}${tag}${C.reset} ${r.name} ${C.red}(esperado ${r.expect}, obteve ${r.got})${C.reset}`);
      failLines.push(`${file}: ${r.name} (esperado ${r.expect}, obteve ${r.got})`);
    }
  }
  perScenario[file] = { pass: p, fail: f, gap: g };
  totalPass += p; totalFail += f; totalGap += g;
  const verdict = f === 0 ? `${C.green}OK${C.reset}` : `${C.red}${f} FALHA(S)${C.reset}`;
  console.log(`  ${C.dim}→${C.reset} ${p} pass / ${f} fail / ${g} gap  ${verdict}\n`);
}

// ---- resumo -----------------------------------------------------
console.log(`${C.bold}=== RESUMO ===${C.reset}`);
for (const [file, s] of Object.entries(perScenario)) {
  console.log(`  ${file.padEnd(32)} ${s.pass} pass / ${s.fail} fail / ${s.gap} gap`);
}
console.log(`  ${'TOTAL'.padEnd(32)} ${totalPass} pass / ${totalFail} fail / ${totalGap} gap`);

if (gapLines.length) {
  console.log(`\n${C.yellow}${C.bold}Gaps conhecidos (não falham a suíte — fechados em subfases futuras):${C.reset}`);
  for (const l of gapLines) console.log(`  ${C.yellow}•${C.reset} ${l}`);
}

if (failLines.length) {
  console.log(`\n${C.red}${C.bold}FALHAS REAIS:${C.reset}`);
  for (const l of failLines) console.log(`  ${C.red}•${C.reset} ${l}`);
}

if (wantJson) {
  console.log('\n' + JSON.stringify(aggregate, null, 2));
}

console.log();
if (totalFail === 0) {
  console.log(`${C.green}${C.bold}✔ SUÍTE VERDE — ${totalPass} asserções, 0 falhas reais, ${totalGap} gap(s) conhecido(s).${C.reset}`);
  process.exit(0);
} else {
  console.log(`${C.red}${C.bold}X SUÍTE VERMELHA — ${totalFail} falha(s) real(is).${C.reset}`);
  process.exit(1);
}
