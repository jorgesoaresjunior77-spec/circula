import { describe, it, expect } from 'vitest'
import {
  EMAIL_NOT_CONFIRMED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  isEmailNotConfirmed,
  signInErrorMessage,
} from './authErrors'

describe('authErrors', () => {
  it('reconhece o código email_not_confirmed', () => {
    expect(isEmailNotConfirmed({ code: 'email_not_confirmed', message: 'x' })).toBe(true)
  })

  it('reconhece a mensagem "Email not confirmed" sem código', () => {
    expect(isEmailNotConfirmed({ message: 'Email not confirmed' })).toBe(true)
    expect(isEmailNotConfirmed({ code: null, message: 'email NOT confirmed' })).toBe(true)
  })

  it('não confunde com credenciais inválidas', () => {
    expect(isEmailNotConfirmed({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(false)
    expect(isEmailNotConfirmed(null)).toBe(false)
  })

  it('escolhe a mensagem certa para o login', () => {
    expect(signInErrorMessage({ code: 'email_not_confirmed' })).toBe(EMAIL_NOT_CONFIRMED_MESSAGE)
    expect(signInErrorMessage({ code: 'invalid_credentials' })).toBe(INVALID_CREDENTIALS_MESSAGE)
  })
})
