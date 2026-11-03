// Aceite de Termos de Uso e Política de Privacidade (LGPD). O aceite é gravado
// em user_metadata no cadastro (ver consentMetadata). Os textos em
// public/termos.html e public/privacidade.html são RASCUNHO e precisam de
// revisão jurídica antes de divulgar o app.
export const CONSENT_VERSION = '2026-11-rascunho'

export function consentMetadata() {
  return { terms_accepted_at: new Date().toISOString(), terms_version: CONSENT_VERSION }
}

interface ConsentCheckboxProps {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function ConsentCheckbox({ id, checked, onChange }: ConsentCheckboxProps) {
  const base = import.meta.env.BASE_URL
  return (
    <label htmlFor={id} className="consent-checkbox">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />{' '}
      Li e aceito os{' '}
      <a href={`${base}termos.html`} target="_blank" rel="noopener noreferrer">
        Termos de Uso
      </a>{' '}
      e a{' '}
      <a href={`${base}privacidade.html`} target="_blank" rel="noopener noreferrer">
        Política de Privacidade
      </a>
      .
    </label>
  )
}
