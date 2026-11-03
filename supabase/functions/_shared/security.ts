// Comparação de segredos em tempo constante: o tempo gasto não depende de
// quantos caracteres iniciais coincidem, o que impede descobrir o token
// do webhook testando prefixos. O comprimento entra no resultado, mas não
// interrompe o laço.
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ba = enc.encode(a)
  const bb = enc.encode(b)
  const len = Math.max(ba.length, bb.length)
  let diff = ba.length ^ bb.length
  for (let i = 0; i < len; i++) {
    diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0)
  }
  return diff === 0
}
