import { supabase } from './supabase'

// Código de acesso ilimitado: a nutricionista gera no Painel e manda junto com o convite; a pessoa digita no
// primeiro acesso (guardado aqui até ela entrar na comunidade) ou depois, em Planos. Quem decide é o banco
// (redeem_access_code): cada código vale para uma pessoa só.

const KEY = 'circula:codigo-acesso'

/** Deixa o código como o banco guarda: só letras e números, maiúsculas. */
export function normalizeAccessCode(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

export function savePendingAccessCode(code: string): void {
  const c = normalizeAccessCode(code)
  try {
    if (c) localStorage.setItem(KEY, c)
    else localStorage.removeItem(KEY)
  } catch {
    /* sem armazenamento: a pessoa pode digitar depois, em Planos */
  }
}

export function readPendingAccessCode(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearPendingAccessCode(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nada */
  }
}

export function accessCodeError(message: string | undefined): string {
  const m = message ?? ''
  if (m.includes('invalid_code')) return 'Código não encontrado. Confira as letras e os números.'
  if (m.includes('code_used')) return 'Este código já foi usado por outra pessoa.'
  if (m.includes('not_in_community')) return 'Entre primeiro na comunidade pelo link do convite e depois use o código.'
  if (m.includes('not_member')) return 'Este código é para participantes da comunidade.'
  return 'Não foi possível usar o código agora. Tente de novo em instantes.'
}

/** Usa o código: libera o acesso ilimitado. */
export async function redeemAccessCode(code: string): Promise<{ error: string | null }> {
  const c = normalizeAccessCode(code)
  if (c.length !== 8) return { error: 'O código tem 8 letras e números.' }
  const { error } = await supabase.rpc('redeem_access_code', { p_code: c })
  return { error: error ? accessCodeError(error.message) : null }
}

export const ACCESS_CODE_INVITE_LINE = (code: string) =>
  `Seu código de acesso ilimitado: ${code}\nDigite esse código no seu primeiro acesso ao Círcula.`
