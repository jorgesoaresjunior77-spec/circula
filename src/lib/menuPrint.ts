// CRIE SEU CARDÁPIO — PDF independente da lista de compras. Sem biblioteca:
// monta uma página própria (A4, boa leitura no celular) e abre o diálogo de
// impressão, onde se escolhe "Salvar como PDF" (e dá para compartilhar o arquivo
// pelo WhatsApp). Todo texto passa por esc().

import { esc } from './nutriPrint'
import { courseLabel, totalMinutes } from './menuBuilder'
import type { MenuAnswers, MenuResult } from './menuBuilder'
import { groupByCategory, formatQty } from './shopping'
import type { DraftItem } from './shopping'

const STYLE = `
@page { size: A4; margin: 16mm; }
* { box-sizing: border-box; }
body { font-family: Georgia, 'Times New Roman', serif; color: #2b2622; margin: 0; line-height: 1.45; }
header.doc { border-bottom: 2px solid #c79c86; padding-bottom: 10px; margin-bottom: 14px; }
header.doc .brand { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #8c6a4f; }
h1 { font-size: 24px; margin: 4px 0 2px; }
h2 { font-size: 15px; margin: 16px 0 6px; color: #6b4a36; border-bottom: 1px solid #e6d9cd; padding-bottom: 3px; break-after: avoid; }
p { margin: 4px 0; font-size: 13px; }
.meta { font-size: 12px; color: #6b625b; }
ul.items { list-style: none; margin: 0; padding: 0; }
ul.items li { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; border-bottom: 1px dotted #e6d9cd; font-size: 13px; break-inside: avoid; }
.box { width: 11px; height: 11px; border: 1.4px solid #8c6a4f; border-radius: 2px; flex: none; transform: translateY(1px); }
.qty { margin-left: auto; white-space: nowrap; font-weight: 700; }
.from { display: block; font-size: 10.5px; color: #8a8179; }
.menu li { font-size: 13px; padding: 2px 0; }
footer.doc { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e6d9cd; font-size: 11px; color: #8a8179; }
@media screen { body { max-width: 760px; margin: 0 auto; padding: 16px; } }
`

function brDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

export function shoppingPdfHtml(answers: MenuAnswers, result: MenuResult, items: DraftItem[], when = new Date().toLocaleDateString('pt-BR')): string {
  const title = answers.name.trim() || 'Meu cardápio'
  const info = [
    `${answers.guests} ${answers.guests === 1 ? 'pessoa' : 'pessoas'}`,
    answers.date ? brDate(answers.date) : null,
    answers.time ? answers.time : null,
    answers.occasion || null,
  ].filter(Boolean)

  const menuList = result.sections
    .map(
      (s) =>
        `<li><strong>${esc(courseLabel(s.course))}:</strong> ${s.picks.map((p) => esc(p.recipe.title)).join(' · ')}</li>`,
    )
    .join('')

  const groups = groupByCategory(items)
    .map(
      (g) => `<h2>${esc(g.label)}</h2><ul class="items">${g.items
        .map(
          (i) =>
            `<li><span class="box"></span><span>${esc(i.name)}${i.notes ? `<span class="from">${esc(i.notes)}</span>` : ''}</span><span class="qty">${esc(formatQty(i.quantity, i.unit))}</span></li>`,
        )
        .join('')}</ul>`,
    )
    .join('')

  const mins = totalMinutes(result)
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lista de compras — ${esc(title)}</title><style>${STYLE}</style></head><body>
<header class="doc"><div class="brand">Círcula · Meu Chef</div><h1>Lista de compras</h1>
<div class="meta"><strong>${esc(title)}</strong> · ${info.map(esc).join(' · ')}</div></header>
<h2>Seu cardápio</h2><ul class="menu" style="list-style:none;margin:0;padding:0">${menuList}</ul>
${mins > 0 ? `<p class="meta">Tempo de preparo somado das receitas: cerca de ${Math.floor(mins / 60) > 0 ? `${Math.floor(mins / 60)} h ` : ''}${mins % 60 > 0 ? `${mins % 60} min` : ''}.</p>` : ''}
${groups || '<p>Nenhum ingrediente cadastrado nas receitas escolhidas.</p>'}
<footer class="doc">Quantidades ajustadas para ${answers.guests} ${answers.guests === 1 ? 'pessoa' : 'pessoas'}, a partir das receitas do Círcula. Itens sem quantidade na receita aparecem como "a gosto". Confira rótulos e restrições alimentares antes de comprar. Gerado em ${esc(when)}.</footer>
</body></html>`
}
