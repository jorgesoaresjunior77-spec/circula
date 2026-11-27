import { supabase } from './supabase'
import { isValidDocument } from './brazilianDocument'
import type { DocumentType } from '../types/billing'

// CPF/CNPJ de cobrança: máscara enquanto digita, validação pelos dígitos
// verificadores e gravação em billing_customer_data (o que as funções do Asaas leem).

export function maskDocument(type: DocumentType, raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, type === 'CPF' ? 11 : 14)
  if (type === 'CPF') {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/** Mensagem de erro (ou null) para o documento digitado. */
export function documentError(type: DocumentType, raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  const expected = type === 'CPF' ? 11 : 14
  if (!digits) return `Informe o seu ${type}.`
  if (digits.length !== expected) return `O ${type} tem ${expected} números (você digitou ${digits.length}).`
  if (!isValidDocument(type, digits)) return `Esse ${type} não é válido. Confira os números e tente de novo.`
  return null
}

export async function saveBillingDocument(type: DocumentType, raw: string): Promise<{ error: string | null }> {
  const invalid = documentError(type, raw)
  if (invalid) return { error: invalid }
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Sua sessão expirou. Entre de novo.' }
  const { error } = await supabase
    .from('billing_customer_data')
    .upsert({ profile_id: userData.user.id, document_type: type, document_number: raw.replace(/\D/g, '') }, { onConflict: 'profile_id' })
  return { error: error ? 'Não foi possível salvar o documento agora. Tente novamente.' : null }
}
