// Feriados brasileiros calculados para qualquer ano (nada escrito à mão por ano): datas fixas e móveis
// (a partir da Páscoa). Ficam separados dos compromissos da pessoa e são classificados por natureza:
//  • nacional: feriado nacional (lei federal);
//  • ponto_facultativo: Carnaval e Corpus Christi são pontos facultativos no calendário federal,
//    não feriados nacionais obrigatórios (podem ser feriado por lei estadual ou municipal);
//  • estadual / municipal: estrutura pronta para incluir depois (REGRAS_LOCAIS), por UF e cidade.

export type HolidayKind = 'nacional' | 'ponto_facultativo' | 'estadual' | 'municipal'

export interface Holiday {
  iso: string
  name: string
  kind: HolidayKind
}

export type HolidayRule = {
  name: string
  kind: HolidayKind
  /** Só para regras estaduais/municipais. */
  uf?: string
  city?: string
} & ({ month: number; day: number } | { easterOffset: number })

export const HOLIDAY_KIND_LABEL: Record<HolidayKind, string> = {
  nacional: 'Feriado nacional',
  ponto_facultativo: 'Ponto facultativo',
  estadual: 'Feriado estadual',
  municipal: 'Feriado municipal',
}

/** Regras nacionais (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023) e pontos facultativos federais. */
export const REGRAS_NACIONAIS: HolidayRule[] = [
  { name: 'Confraternização Universal', kind: 'nacional', month: 1, day: 1 },
  { name: 'Carnaval', kind: 'ponto_facultativo', easterOffset: -48 },
  { name: 'Carnaval', kind: 'ponto_facultativo', easterOffset: -47 },
  { name: 'Sexta-feira Santa', kind: 'nacional', easterOffset: -2 },
  { name: 'Tiradentes', kind: 'nacional', month: 4, day: 21 },
  { name: 'Dia do Trabalho', kind: 'nacional', month: 5, day: 1 },
  { name: 'Corpus Christi', kind: 'ponto_facultativo', easterOffset: 60 },
  { name: 'Independência do Brasil', kind: 'nacional', month: 9, day: 7 },
  { name: 'Nossa Senhora Aparecida', kind: 'nacional', month: 10, day: 12 },
  { name: 'Finados', kind: 'nacional', month: 11, day: 2 },
  { name: 'Proclamação da República', kind: 'nacional', month: 11, day: 15 },
  { name: 'Dia Nacional de Zumbi e da Consciência Negra', kind: 'nacional', month: 11, day: 20 },
  { name: 'Natal', kind: 'nacional', month: 12, day: 25 },
]

/** Feriados estaduais e municipais: inclua aqui (com uf/city) quando forem cadastrados. */
export const REGRAS_LOCAIS: HolidayRule[] = []

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Feriados do ano, em ordem e sem repetir (mesmo dia e nome). `local` filtra regras por UF/cidade. */
export function holidaysForYear(year: number, local?: { uf?: string; city?: string }): Holiday[] {
  const easter = easterSunday(year)
  const easterUtc = Date.UTC(year, easter.month - 1, easter.day)
  const rules = [
    ...REGRAS_NACIONAIS,
    ...REGRAS_LOCAIS.filter(
      (r) =>
        (r.kind === 'estadual' && !!local?.uf && r.uf === local.uf) ||
        (r.kind === 'municipal' && !!local?.city && r.city === local.city && (!r.uf || r.uf === local.uf)),
    ),
  ]
  const seen = new Set<string>()
  const out: Holiday[] = []
  for (const r of rules) {
    let date: string
    if ('easterOffset' in r) {
      const dt = new Date(easterUtc + r.easterOffset * 86_400_000)
      date = iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
    } else {
      date = iso(year, r.month, r.day)
    }
    const key = `${date}|${r.name}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ iso: date, name: r.name, kind: r.kind })
  }
  return out.sort((x, y) => (x.iso < y.iso ? -1 : x.iso > y.iso ? 1 : 0))
}

/** Feriados entre duas datas ISO (inclusive), agrupados por dia. */
export function holidaysBetween(fromIso: string, toIso: string, local?: { uf?: string; city?: string }): Map<string, Holiday[]> {
  const map = new Map<string, Holiday[]>()
  const y0 = Number(fromIso.slice(0, 4))
  const y1 = Number(toIso.slice(0, 4))
  for (let y = y0; y <= y1; y += 1) {
    for (const h of holidaysForYear(y, local)) {
      if (h.iso < fromIso || h.iso > toIso) continue
      map.set(h.iso, [...(map.get(h.iso) ?? []), h])
    }
  }
  return map
}
