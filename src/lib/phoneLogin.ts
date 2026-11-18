import { supabase } from './supabase'
import { normalizeLoginPhone } from './phone'
import { EMAIL_NOT_CONFIRMED_MESSAGE } from './authErrors'

// Login por celular. O servidor (edge function login-with-phone) acha a conta
// pelo celular, confere a senha e devolve a sessão; aqui ela é instalada no
// cliente. O e-mail continua sendo o da conta (cadastro e recuperação).

export interface PhoneAuthError {
  /** 'invalid_credentials' | 'email_not_confirmed' | 'unavailable' */
  code: string
  message: string
}

export const INVALID_PHONE_MESSAGE = 'Celular ou senha inválidos.'
const UNAVAILABLE_MESSAGE = 'Não foi possível entrar agora. Tente novamente em instantes.'

async function readError(error: unknown): Promise<PhoneAuthError> {
  const ctx = (error as { context?: Response } | null)?.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const parsed = (await ctx.json()) as { code?: string; error?: string }
      // A mensagem é do app, não do servidor: só o código decide.
      if (parsed?.code === 'invalid_credentials') return { code: parsed.code, message: INVALID_PHONE_MESSAGE }
      if (parsed?.code === 'email_not_confirmed') return { code: parsed.code, message: EMAIL_NOT_CONFIRMED_MESSAGE }
    } catch {
      /* cai na mensagem genérica */
    }
  }
  return { code: 'unavailable', message: UNAVAILABLE_MESSAGE }
}

/** Entra com celular + senha. Em caso de sucesso o App troca de tela sozinho. */
export async function signInWithPhone(phoneInput: string, password: string): Promise<{ error: PhoneAuthError | null }> {
  const phone = normalizeLoginPhone(phoneInput)
  if (!phone || !password) return { error: { code: 'invalid_credentials', message: INVALID_PHONE_MESSAGE } }

  const { data, error } = await supabase.functions.invoke('login-with-phone', {
    body: { action: 'login', phone, password },
  })
  if (error) return { error: await readError(error) }

  const tokens = data as { access_token?: string; refresh_token?: string } | null
  if (!tokens?.access_token || !tokens.refresh_token) return { error: { code: 'unavailable', message: UNAVAILABLE_MESSAGE } }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  })
  if (sessionError) return { error: { code: 'unavailable', message: UNAVAILABLE_MESSAGE } }

  void rememberCredentials(phone, password)
  return { error: null }
}

/** Pede o link de recuperação: vai para o e-mail do cadastro. Resposta sempre igual. */
export async function requestPasswordResetByPhone(phoneInput: string): Promise<{ error: boolean }> {
  const phone = normalizeLoginPhone(phoneInput)
  if (!phone) return { error: false } // não revela nada: mesma resposta de qualquer número
  const { error } = await supabase.functions.invoke('login-with-phone', { body: { action: 'reset', phone } })
  return { error: !!error }
}

interface PasswordCredentialCtor {
  new (data: { id: string; password: string; name?: string }): Credential
}

/**
 * Oferece ao navegador guardar o login e a senha ("Salvar senha?"), para não
 * digitar toda vez. O Círcula NÃO guarda a senha em lugar nenhum: quem guarda é
 * o gerenciador de senhas do próprio navegador/celular. Onde a API não existe
 * (Safari, Firefox) vale o preenchimento automático dos campos do formulário.
 */
export async function rememberCredentials(id: string, password: string): Promise<void> {
  try {
    const Ctor = (window as unknown as { PasswordCredential?: PasswordCredentialCtor }).PasswordCredential
    if (Ctor && navigator.credentials && typeof navigator.credentials.store === 'function') {
      await navigator.credentials.store(new Ctor({ id, password, name: id }))
    }
  } catch {
    /* sem suporte ou recusado: segue sem guardar */
  }
}
