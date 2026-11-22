// Dicas de Viagem: estados, "para quem" e ajudas de filtro. O conteúdo
// (destinos, textos, fotos) é todo cadastrado pela profissional; aqui só
// ficam as listas fixas e as regras de filtro.

export const BR_STATES: { uf: string; name: string }[] = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
]

export const TRAVEL_AUDIENCES: { key: string; label: string }[] = [
  { key: 'criancas', label: 'Crianças' },
  { key: 'familia', label: 'Família' },
  { key: 'casal', label: 'Casal' },
  { key: 'sozinha', label: 'Sozinha' },
  { key: 'amigas', label: 'Amigas' },
  { key: 'esporte', label: 'Evento esportivo' },
  { key: 'trabalho', label: 'A trabalho' },
  { key: 'melhor_idade', label: 'Melhor idade' },
  { key: 'lua_de_mel', label: 'Lua de mel' },
]

export function stateName(uf: string | null | undefined): string {
  return BR_STATES.find((s) => s.uf === uf)?.name ?? (uf ?? '')
}

export function audienceLabel(key: string): string {
  return TRAVEL_AUDIENCES.find((a) => a.key === key)?.label ?? key
}

export interface TravelPlace {
  id: string
  title: string
  state: string | null
  city: string | null
  audiences: string[]
  description: string | null
  what_to_do: string | null
  points_to_visit: string | null
  image_paths: string[]
  status: 'draft' | 'published'
}

export interface TravelFilters {
  state?: string | null
  city?: string | null
  audience?: string | null
}

export function filterPlaces(places: TravelPlace[], f: TravelFilters): TravelPlace[] {
  return places.filter(
    (p) =>
      (!f.state || p.state === f.state) &&
      (!f.city || p.city === f.city) &&
      (!f.audience || p.audiences.includes(f.audience)),
  )
}

/** Chave da imagem do card de cidade (a cidade pode se repetir em outro estado). */
export function cityKey(uf: string | null | undefined, city: string): string {
  return `${uf ?? ''}:${city.trim().toLowerCase()}`
}

export function distinctCities(places: TravelPlace[]): string[] {
  const seen = new Map<string, string>()
  for (const p of places) {
    const c = p.city?.trim()
    if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c)
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
