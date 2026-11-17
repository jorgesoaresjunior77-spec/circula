// PDFs da Gestão Nutricional. Sem biblioteca: monta uma página HTML própria
// para impressão (A4, boa leitura no celular) e abre o diálogo de imprimir,
// onde se escolhe "Salvar como PDF". Todo texto digitado passa por esc() para
// nada virar HTML.

import { brDate, bmi, derive, diff, heightAt, sortAssessments, ALL_MEASURES } from './nutri'
import type { Assessment, Consultation } from './nutri'
import { dayTotals, macroSplit, mealTotals } from './nutriPlan'
import type { Plan } from './nutriPlan'

export function esc(v: string | number | null | undefined): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const para = (v: string | null | undefined): string => (v ? `<p>${esc(v).replace(/\n/g, '<br>')}</p>` : '')
const fmt = (n: number | null | undefined, d = 1): string => (n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: d }))

const STYLE = `
@page { size: A4; margin: 16mm; }
* { box-sizing: border-box; }
body { font-family: Georgia, 'Times New Roman', serif; color: #2b2622; margin: 0; padding: 0; line-height: 1.45; }
header.doc { border-bottom: 2px solid #c79c86; padding-bottom: 10px; margin-bottom: 16px; }
header.doc .brand { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #8c6a4f; }
h1 { font-size: 24px; margin: 4px 0 2px; }
h2 { font-size: 16px; margin: 18px 0 6px; color: #6b4a36; border-bottom: 1px solid #e6d9cd; padding-bottom: 3px; }
h3 { font-size: 14px; margin: 12px 0 4px; }
p { margin: 4px 0; font-size: 13px; }
.meta { font-size: 12px; color: #6b625b; }
table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 12.5px; }
th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #eadfd4; vertical-align: top; }
th { background: #f6efe8; font-weight: 700; }
.num { text-align: right; white-space: nowrap; }
.meal { break-inside: avoid; margin-bottom: 12px; }
.sub { font-size: 11.5px; color: #6b625b; }
.box { background: #faf5ef; border: 1px solid #eadfd4; border-radius: 6px; padding: 8px 10px; margin: 8px 0; }
footer.doc { margin-top: 22px; padding-top: 8px; border-top: 1px solid #e6d9cd; font-size: 11px; color: #8a8179; }
@media screen { body { max-width: 760px; margin: 0 auto; padding: 16px; } }
`

function shell(title: string, patient: string, nutri: string, body: string, when: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — ${esc(patient)}</title><style>${STYLE}</style></head><body>
<header class="doc"><div class="brand">Círcula · Fluir &amp; Florescer</div><h1>${esc(title)}</h1>
<div class="meta">Paciente: <strong>${esc(patient)}</strong> · Nutricionista: <strong>${esc(nutri || '—')}</strong> · Elaborado em ${esc(when)}</div></header>
${body}
<footer class="doc">Documento de orientação nutricional. As orientações são individuais e não substituem o acompanhamento profissional.</footer>
</body></html>`
}

export function planHtml(plan: Plan, patient: string, nutri: string, when = brDate(new Date().toISOString())): string {
  const day = dayTotals(plan.meals).total
  const split = macroSplit(day)
  const meals = [...plan.meals].sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
  const targets = [
    plan.kcal_target ? `${fmt(plan.kcal_target, 0)} kcal` : null,
    plan.protein_g_target ? `proteínas ${fmt(plan.protein_g_target, 0)} g` : null,
    plan.carb_g_target ? `carboidratos ${fmt(plan.carb_g_target, 0)} g` : null,
    plan.fat_g_target ? `gorduras ${fmt(plan.fat_g_target, 0)} g` : null,
    plan.fiber_g_target ? `fibras ${fmt(plan.fiber_g_target, 0)} g` : null,
    plan.water_ml_target ? `água ${fmt(plan.water_ml_target, 0)} ml` : null,
  ].filter(Boolean)

  const mealsHtml = meals
    .map((m) => {
      const t = mealTotals(m).total
      const rows = m.items
        .map((i) => {
          const qty = [i.grams ? `${fmt(i.grams, 0)} g` : '', i.household, i.portions].filter(Boolean).join(' · ')
          const subs = i.substitutions.filter((s) => s.name.trim())
          return `<tr><td><strong>${esc(i.name || 'Item')}</strong>${i.prep ? `<div class="sub">${esc(i.prep)}</div>` : ''}${i.note ? `<div class="sub">${esc(i.note)}</div>` : ''}${
            subs.length
              ? `<div class="sub">Substituições: ${subs
                  .map((s) => esc([s.name, s.grams ? `${fmt(s.grams, 0)} g` : '', s.household].filter(Boolean).join(' · ')))
                  .join('; ')}</div>`
              : ''
          }</td><td>${esc(qty)}</td><td class="num">${i.nutrients ? fmt(i.nutrients.kcal, 0) : '—'}</td></tr>`
        })
        .join('')
      return `<section class="meal"><h3>${esc(m.time ? m.time + ' · ' : '')}${esc(m.name)}</h3>
<table><thead><tr><th>Alimento</th><th>Quantidade</th><th class="num">kcal</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Sem alimentos.</td></tr>'}</tbody></table>
${m.notes ? `<p class="sub">${esc(m.notes)}</p>` : ''}<p class="sub">Total da refeição: ${fmt(t.kcal, 0)} kcal</p></section>`
    })
    .join('')

  const body = `
<h2>${esc(plan.name)}</h2>
<p class="meta">${plan.objective ? `Objetivo: ${esc(plan.objective)} · ` : ''}${plan.start_date ? `Início ${brDate(plan.start_date)}` : ''}${plan.review_date ? ` · Revisão ${brDate(plan.review_date)}` : ''}</p>
${targets.length ? `<div class="box"><strong>Metas do dia:</strong> ${targets.join(' · ')}${plan.goals ? `<br>${esc(plan.goals)}` : ''}</div>` : ''}
<h2>Refeições</h2>${mealsHtml}
<div class="box"><strong>Resumo do dia:</strong> ${fmt(day.kcal, 0)} kcal · proteínas ${fmt(day.protein)} g · carboidratos ${fmt(day.carb)} g · gorduras ${fmt(day.fat)} g · fibras ${fmt(day.fiber)} g${
    split ? `<br>Distribuição: proteínas ${split.protein}% · carboidratos ${split.carb}% · gorduras ${split.fat}%` : ''
  }</div>
${plan.guidance ? `<h2>Orientações gerais</h2>${para(plan.guidance)}` : ''}`
  return shell('Planejamento alimentar', patient, nutri, body, when)
}

export function assessmentHtml(a: Assessment, all: Assessment[], patient: string, nutri: string, when = brDate(new Date().toISOString())): string {
  const sorted = sortAssessments(all)
  const idx = sorted.findIndex((x) => x.id === a.id)
  const prev = idx > 0 ? sorted[idx - 1] : null
  const d = derive(a, heightAt(sorted, Math.max(idx, 0)))
  const rows = ALL_MEASURES.filter((m) => a[m.key] != null)
    .map((m) => {
      const df = prev ? diff(a[m.key] as number | null, prev[m.key] as number | null) : null
      return `<tr><td>${esc(m.label)}</td><td class="num">${fmt(a[m.key] as number)} ${esc(m.unit)}</td><td class="num">${df == null ? '—' : (df > 0 ? '+' : '') + fmt(df, 2)}</td></tr>`
    })
    .join('')
  const body = `<h2>Avaliação de ${brDate(a.assessed_on)}</h2>
<table><thead><tr><th>Medida</th><th class="num">Valor</th><th class="num">${prev ? `vs ${brDate(prev.assessed_on)}` : 'Variação'}</th></tr></thead><tbody>${rows}</tbody></table>
<div class="box">IMC: <strong>${fmt(d.bmi)}</strong> · Cintura/quadril: <strong>${fmt(d.whr, 2)}</strong> · Cintura/estatura: <strong>${fmt(d.whtr, 2)}</strong><br><span class="sub">Indicadores de referência; não são diagnóstico isolado.</span></div>
${a.source ? `<p class="sub">Composição corporal medida com: ${esc(a.source)}</p>` : ''}${para(a.notes)}`
  return shell('Avaliação nutricional', patient, nutri, body, when)
}

export function evolutionHtml(assessments: Assessment[], consultations: Consultation[], patient: string, nutri: string, when = brDate(new Date().toISOString())): string {
  const sorted = sortAssessments(assessments)
  const rows = sorted
    .map((s, i) => {
      const prev = i > 0 ? sorted[i - 1] : null
      const dw = diff(s.weight_kg, prev?.weight_kg)
      return `<tr><td>${brDate(s.assessed_on)}</td><td class="num">${fmt(s.weight_kg)}</td><td class="num">${fmt(bmi(s.weight_kg, heightAt(sorted, i)))}</td><td class="num">${fmt(s.waist_cm)}</td><td class="num">${fmt(s.body_fat_pct)}</td><td class="num">${dw == null ? '—' : (dw > 0 ? '+' : '') + fmt(dw, 2)}</td></tr>`
    })
    .join('')
  const done = consultations.filter((c) => c.status === 'realizada' && c.evolution).sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on))
  const notes = done.map((c) => `<div class="box"><strong>${brDate(c.scheduled_on)}</strong>${para(c.evolution)}</div>`).join('')
  const body = `<h2>Medidas ao longo do tempo</h2>
<table><thead><tr><th>Data</th><th class="num">Peso (kg)</th><th class="num">IMC</th><th class="num">Cintura (cm)</th><th class="num">Gordura (%)</th><th class="num">Δ peso</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Sem avaliações.</td></tr>'}</tbody></table>
${notes ? `<h2>Evolução nas consultas</h2>${notes}` : ''}`
  return shell('Relatório de evolução', patient, nutri, body, when)
}

/** Abre o diálogo de imprimir (Salvar como PDF) com o documento. */
export function printDocument(html: string): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
  window.setTimeout(() => w.print(), 350)
  return true
}
