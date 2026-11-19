// Filtro de linguagem ofensiva das publicações e comentários.
//
// A checagem normaliza o texto (maiúsculas, acentos, números no lugar de
// letras como "m3rd4", pontos e espaços entre as letras, letras repetidas) e
// compara PALAVRA POR PALAVRA, para não bloquear palavras comuns que apenas
// contêm um termo no meio (ex.: "computador"). A lista base fica aqui; a
// profissional acrescenta termos pelo Painel (tabela blocked_terms), e o
// banco repete a checagem (a interface só dá a mensagem educada antes).

export const BASE_BLOCKED_TERMS: string[] = [
  'merda', 'bosta', 'porra', 'caralho', 'puta', 'puto', 'putaria', 'foder', 'fodase', 'foda-se',
  'cu', 'buceta', 'piroca', 'pau no cu', 'viado', 'viada', 'arrombado', 'arrombada', 'cuzao', 'idiota',
  'imbecil', 'retardado', 'retardada', 'babaca', 'otario', 'otaria', 'vagabunda', 'vagabundo', 'piranha',
  'desgraca', 'desgracada', 'desgracado', 'lixo', 'nojenta', 'nojento', 'vadia', 'corno', 'cretina', 'cretino',
]

export const MODERATION_MESSAGE =
  'Esta mensagem tem palavras que não combinam com o nosso espaço de cuidado. Pode reescrever com carinho?'

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' }

/** minúsculas, sem acento, números/símbolos trocados por letras, sem sinais. */
export function normalizeWord(raw: string): string {
  const base = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  let out = ''
  for (const ch of base) out += LEET[ch] ?? ch
  return out.replace(/[^a-z]/g, '')
}

/** "merrrda" -> "merda" (letras repetidas viram uma só). */
function squeeze(w: string): string {
  return w.replace(/(.)\1+/g, '$1')
}

function normalizeTerm(term: string): string {
  return squeeze(normalizeWord(term))
}

/** Devolve o primeiro termo bloqueado encontrado, ou null. */
export function findBlockedTerm(text: string, extraTerms: string[] = []): string | null {
  const singles = new Set<string>()
  const phrases: string[] = []
  for (const t of [...BASE_BLOCKED_TERMS, ...extraTerms]) {
    const n = normalizeTerm(t)
    if (!n) continue
    if (/\s/.test(t.trim())) phrases.push(n)
    else singles.add(n)
  }

  const tokens = text.split(/\s+/).filter(Boolean)
  const words = tokens.map((tok) => squeeze(normalizeWord(tok))).filter(Boolean)
  const hit = (w: string) => singles.has(w) || (w.length > 3 && singles.has(w.replace(/s$/, '')))

  for (const w of words) if (hit(w)) return w

  // letras soltas: "m e r d a" ou "p.u.t.a" (sequência de tokens de 1 letra)
  let run = ''
  for (const tok of tokens) {
    const n = normalizeWord(tok)
    if (tok.length <= 2 && n.length === 1) run += n
    else {
      if (run.length >= 2 && hit(squeeze(run))) return squeeze(run)
      run = ''
    }
  }
  if (run.length >= 2 && hit(squeeze(run))) return squeeze(run)

  // termos com mais de uma palavra, comparados em sequência
  const joined = ' ' + words.join(' ') + ' '
  for (const p of phrases) {
    const spaced = ' ' + p + ' '
    if (joined.includes(spaced)) return p
  }
  return null
}

export function isBlockedText(text: string, extraTerms: string[] = []): boolean {
  return findBlockedTerm(text, extraTerms) !== null
}
