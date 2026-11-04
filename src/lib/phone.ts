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

export function buildWhatsAppUrl(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}
