// Baixa os municípios do IBGE (API oficial de localidades) e grava um arquivo
// pequeno por estado em public/ibge/<UF>.json no formato [[ibge_id, "Nome"], ...].
import { writeFileSync, mkdirSync } from 'node:fs'
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
mkdirSync('public/ibge', { recursive: true })
let total = 0
for (const uf of UFS) {
  const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
  if (!r.ok) throw new Error(`${uf}: HTTP ${r.status}`)
  const rows = (await r.json()).map((m) => [m.id, m.nome])
  total += rows.length
  writeFileSync(`public/ibge/${uf}.json`, JSON.stringify(rows))
  console.log(uf, rows.length)
}
console.log('total', total)
