// Número de WhatsApp para o convite: a Profissional digita como costuma
// (com ou sem DDD, parênteses, espaços, traço, +55) e aqui sai só dígitos
// no formato internacional que o `wa.me` exige. Sem número válido, nada é
// enviado: a função devolve null.
//
// Brasil: DDD (2 dígitos, 11–99) + 8 ou 9 dígitos; celular começa com 9.
// Fora do Brasil só vale com "+" na frente (ex.: +351 912 345 678).
export function normalizeWhatsAppNumber(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null

  if (trimmed.startsWith('+') && !digits.startsWith('55')) {
    return digits.length >= 8 && digits.length <= 15 ? digits : null
  }

  const national = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits
  if (national.length !== 10 && national.length !== 11) return null

  const ddd = Number(national.slice(0, 2))
  if (ddd < 11 || ddd > 99) return null
  if (national.length === 11 && national[2] !== '9') return null

  return `55${national}`
}

// ---- Celular como login ------------------------------------------------------
// Padrão do Círcula: DDD + 9 + número, só dígitos (ex.: 51996509660). Quem
// digita com parênteses, traço, espaços ou +55 também funciona: sai sempre no
// padrão. Fora disso devolve null. Mesma regra da tabela login_phones.
export function normalizeLoginPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2)
  return /^[1-9][0-9]9[0-9]{8}$/.test(digits) ? digits : null
}

/** "51996509660" -> "(51) 99650-9660", só para mostrar. */
export function formatLoginPhone(phone: string): string {
  return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`
}

export const LOGIN_PHONE_EXAMPLE = '51996509660'
export const LOGIN_PHONE_HINT = 'DDD + 9 + número, só números. Ex.: 51996509660'

export function buildWhatsAppUrl(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}
