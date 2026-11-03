// Valida CPF/CNPJ pelos dígitos verificadores. O Asaas recusa documento
// inválido ao criar a assinatura; validar antes evita o erro genérico.
function allSame(digits: string) {
  return /^(\d)\1+$/.test(digits)
}

function checkDigit(digits: string, length: number, weights: number[]) {
  let sum = 0
  for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * weights[i]
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

export function isValidCpf(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11 || allSame(digits)) return false
  const d1 = checkDigit(digits, 9, [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = checkDigit(digits, 10, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  return d1 === Number(digits[9]) && d2 === Number(digits[10])
}

export function isValidCnpj(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 14 || allSame(digits)) return false
  const d1 = checkDigit(digits, 12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = checkDigit(digits, 13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return d1 === Number(digits[12]) && d2 === Number(digits[13])
}

export function isValidDocument(type: 'CPF' | 'CNPJ', value: string) {
  return type === 'CPF' ? isValidCpf(value) : isValidCnpj(value)
}
