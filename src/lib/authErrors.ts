// Mensagens de erro de autenticação mostradas ao usuário. O Supabase devolve
// `code: 'email_not_confirmed'` (e, em versões antigas, só a mensagem
// "Email not confirmed") quando o projeto exige confirmar o e-mail.
export const EMAIL_NOT_CONFIRMED_MESSAGE =
  'Seu e-mail ainda não foi confirmado. Confirme pelo link que enviamos ou fale com quem te convidou.'

export const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos.'

interface AuthErrorLike {
  code?: string | null
  message?: string | null
}

export function isEmailNotConfirmed(error: AuthErrorLike | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === 'email_not_confirmed' ||
    /email not confirmed/i.test(error.message ?? '')
  )
}

export function signInErrorMessage(error: AuthErrorLike): string {
  return isEmailNotConfirmed(error) ? EMAIL_NOT_CONFIRMED_MESSAGE : INVALID_CREDENTIALS_MESSAGE
}
