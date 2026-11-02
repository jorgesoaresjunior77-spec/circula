// Regras de senha do cadastro de participante pelo convite (pedido do
// usuário): pelo menos 1 letra maiúscula, 1 número e 1 caractere
// especial; o resto é livre (qualquer escrita). O tamanho mínimo existe
// porque o próprio Supabase Auth recusa senhas com menos de 6 caracteres.

export const PASSWORD_MIN_LENGTH = 6

export interface PasswordRule {
  id: 'length' | 'uppercase' | 'digit' | 'special'
  label: string
  met: boolean
}

export function evaluatePassword(password: string): PasswordRule[] {
  return [
    { id: 'length', label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`, met: password.length >= PASSWORD_MIN_LENGTH },
    { id: 'uppercase', label: '1 letra maiúscula', met: /\p{Lu}/u.test(password) },
    { id: 'digit', label: '1 número', met: /\d/.test(password) },
    // especial = qualquer coisa que não seja letra, número ou espaço
    { id: 'special', label: '1 caractere especial (ex.: ! @ # $ %)', met: /[^\p{L}\p{N}\s]/u.test(password) },
  ]
}

export function isPasswordValid(password: string): boolean {
  return evaluatePassword(password).every((rule) => rule.met)
}
