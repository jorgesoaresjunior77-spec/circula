// Diário da Gratidão: regras puras (sem acesso ao banco).

export interface Prayer {
  id: string
  title: string | null
  body: string
  status: 'draft' | 'published'
  position: number
}

/** Número do dia (para o sorteio): conta dias desde 1970 na data local. */
export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/**
 * Orações tradicionais, de uso comum e muito antigas (Pai Nosso, Ave Maria, Salve
 * Rainha, Oração de São Francisco e outras): são os textos conhecidos de todos,
 * sem tradução moderna protegida. As orações que a nutricionista cadastrar entram
 * junto, no mesmo sorteio.
 */
export const BUILTIN_PRAYERS: Prayer[] = [
  {
    id: 'b-pai-nosso',
    title: 'Pai Nosso',
    status: 'published',
    position: 1,
    body: 'Pai nosso que estais nos céus, santificado seja o vosso nome, venha a nós o vosso reino, seja feita a vossa vontade assim na terra como no céu.\nO pão nosso de cada dia nos dai hoje, perdoai-nos as nossas ofensas, assim como nós perdoamos a quem nos tem ofendido, e não nos deixeis cair em tentação, mas livrai-nos do mal.\nAmém.',
  },
  {
    id: 'b-ave-maria',
    title: 'Ave Maria',
    status: 'published',
    position: 2,
    body: 'Ave Maria, cheia de graça, o Senhor é convosco, bendita sois vós entre as mulheres e bendito é o fruto do vosso ventre, Jesus.\nSanta Maria, Mãe de Deus, rogai por nós, pecadores, agora e na hora de nossa morte.\nAmém.',
  },
  {
    id: 'b-gloria',
    title: 'Glória ao Pai',
    status: 'published',
    position: 3,
    body: 'Glória ao Pai, ao Filho e ao Espírito Santo.\nComo era no princípio, agora e sempre.\nAmém.',
  },
  {
    id: 'b-salve-rainha',
    title: 'Salve Rainha',
    status: 'published',
    position: 4,
    body: 'Salve, Rainha, Mãe de misericórdia, vida, doçura e esperança nossa, salve!\nA vós bradamos, os degredados filhos de Eva; a vós suspiramos, gemendo e chorando neste vale de lágrimas.\nEia, pois, advogada nossa, esses vossos olhos misericordiosos a nós volvei; e depois deste desterro mostrai-nos Jesus, bendito fruto do vosso ventre, ó clemente, ó piedosa, ó doce sempre Virgem Maria.\nRogai por nós, santa Mãe de Deus, para que sejamos dignos das promessas de Cristo.\nAmém.',
  },
  {
    id: 'b-anjo',
    title: 'Santo Anjo do Senhor',
    status: 'published',
    position: 5,
    body: 'Santo Anjo do Senhor, meu zeloso guardador, se a ti me confiou a piedade divina, sempre me rege, guarda, governa e ilumina.\nAmém.',
  },
  {
    id: 'b-sao-francisco',
    title: 'Oração de São Francisco',
    status: 'published',
    position: 6,
    body: 'Senhor, fazei de mim um instrumento de vossa paz.\nOnde houver ódio, que eu leve o amor; onde houver ofensa, que eu leve o perdão; onde houver discórdia, que eu leve a união; onde houver dúvidas, que eu leve a fé; onde houver erro, que eu leve a verdade; onde houver desespero, que eu leve a esperança; onde houver tristeza, que eu leve a alegria; onde houver trevas, que eu leve a luz.\nÓ Mestre, fazei que eu procure mais consolar que ser consolado; compreender que ser compreendido; amar que ser amado.\nPois é dando que se recebe, é perdoando que se é perdoado, e é morrendo que se vive para a vida eterna.\nAmém.',
  },
  {
    id: 'b-memorare',
    title: 'Lembrai-vos (Memorare)',
    status: 'published',
    position: 7,
    body: 'Lembrai-vos, ó piíssima Virgem Maria, que nunca se ouviu dizer que algum daqueles que tenham recorrido à vossa proteção, implorado a vossa assistência e reclamado o vosso socorro, fosse por vós desamparado.\nAnimado eu, pois, com igual confiança, a vós, Virgem entre todas singular, como a Mãe recorro; de vós me valho e, gemendo sob o peso dos meus pecados, me prostro a vossos pés.\nNão desprezeis as minhas súplicas, ó Mãe do Filho de Deus humanado, mas dignai-vos de as ouvir propícia e de me alcançar o que vos rogo.\nAmém.',
  },
  {
    id: 'b-espirito-santo',
    title: 'Vinde, Espírito Santo',
    status: 'published',
    position: 8,
    body: 'Vinde, Espírito Santo, enchei os corações dos vossos fiéis e acendei neles o fogo do vosso amor.\nEnviai o vosso Espírito e tudo será criado, e renovareis a face da terra.\nÓ Deus, que instruístes os corações dos vossos fiéis com a luz do Espírito Santo, fazei que apreciemos retamente todas as coisas segundo o mesmo Espírito e gozemos sempre da sua consolação.\nPor Cristo, Senhor nosso.\nAmém.',
  },
  {
    id: 'b-anima-christi',
    title: 'Alma de Cristo',
    status: 'published',
    position: 9,
    body: 'Alma de Cristo, santificai-me.\nCorpo de Cristo, salvai-me.\nSangue de Cristo, inebriai-me.\nÁgua do lado de Cristo, lavai-me.\nPaixão de Cristo, confortai-me.\nÓ bom Jesus, ouvi-me.\nDentro de vossas chagas, escondei-me.\nNão permitais que eu me separe de vós.\nDo espírito maligno, defendei-me.\nNa hora da minha morte, chamai-me.\nMandai-me ir para vós, para que com os vossos santos vos louve, por todos os séculos dos séculos.\nAmém.',
  },
  {
    id: 'b-sub-tuum',
    title: 'À vossa proteção',
    status: 'published',
    position: 10,
    body: 'À vossa proteção recorremos, santa Mãe de Deus; não desprezeis as nossas súplicas em nossas necessidades, mas livrai-nos sempre de todos os perigos, ó Virgem gloriosa e bendita.\nAmém.',
  },
  {
    id: 'b-bencao',
    title: 'Bênção',
    status: 'published',
    position: 11,
    body: 'O Senhor te abençoe e te guarde.\nO Senhor faça resplandecer o seu rosto sobre ti e tenha misericórdia de ti.\nO Senhor levante sobre ti o seu rosto e te dê a paz.\nAmém.',
  },
]

function hash(n: number): number {
  // embaralha o número do dia (estável: a mesma data dá sempre a mesma posição)
  let x = (n ^ 0x9e3779b9) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0
  return (x ^ (x >>> 16)) >>> 0
}

/**
 * A oração do dia: sorteada entre as publicadas (as tradicionais do app mais as da
 * nutricionista), sempre a mesma durante o dia. `offset` pede "outra oração".
 */
export function prayerOfTheDay<T extends { id: string; position: number; status: string }>(prayers: T[], todayIso: string, offset = 0): T | null {
  const list = prayers.filter((p) => p.status === 'published').sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  if (list.length === 0) return null
  return list[(hash(dayNumber(todayIso)) + offset) % list.length]
}

/** Os temas mais repetidos nas gratidões do período (mesmo texto, sem acento nem maiúscula). */
export function topGratitudes(entries: { day: string; items: string[] }[], prefix: string, limit = 5): { label: string; count: number }[] {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const map = new Map<string, { label: string; count: number }>()
  for (const e of entries) {
    if (!e.day.startsWith(prefix)) continue
    for (const raw of e.items) {
      const key = norm(raw)
      if (!key) continue
      const cur = map.get(key)
      if (cur) cur.count += 1
      else map.set(key, { label: raw.trim(), count: 1 })
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit)
}

/** Dias seguidos com registro, contando de hoje (ou de ontem, se hoje ainda não tem). */
export function streak(daysIso: string[], todayIso: string): number {
  const set = new Set(daysIso)
  let cur = dayNumber(todayIso)
  const iso = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10)
  if (!set.has(iso(cur))) cur -= 1
  let count = 0
  while (set.has(iso(cur))) {
    count += 1
    cur -= 1
  }
  return count
}

export const AMEN_MESSAGES = [
  'Amém. Que o seu dia seja leve e cheio de paz.',
  'Amém. Você não está sozinha: respire fundo e siga com fé.',
  'Amém. Gratidão por este momento só seu.',
]

export function amenMessage(todayIso: string): string {
  return AMEN_MESSAGES[dayNumber(todayIso) % AMEN_MESSAGES.length]
}
