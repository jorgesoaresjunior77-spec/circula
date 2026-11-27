import { useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { documentError, maskDocument, saveBillingDocument } from '../lib/billingDocument'
import type { DocumentType } from '../types/billing'

// Campo de CPF/CNPJ para a cobrança (Loja, avulsos): máscara, validação e
// mensagem clara. Pede só o documento: nome e e-mail já vêm do cadastro.
export function BillingDocumentForm({
  onSaved,
  onCancel,
  submitLabel = 'Salvar e continuar',
  intro,
  idPrefix = 'billing-doc',
}: {
  onSaved: () => void
  onCancel?: () => void
  submitLabel?: string
  intro?: string
  idPrefix?: string
}) {
  const [type, setType] = useState<DocumentType>('CPF')
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const liveError = touched ? documentError(type, value) : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    const invalid = documentError(type, value)
    if (invalid) {
      setError(invalid)
      return
    }
    setSaving(true)
    setError(null)
    const r = await saveBillingDocument(type, value)
    setSaving(false)
    if (r.error) {
      setError(r.error)
      return
    }
    onSaved()
  }

  const shown = error ?? liveError
  return (
    <form className="billing-doc-form" onSubmit={(e) => void submit(e)} noValidate>
      {intro && <p className="billing-doc-intro">{intro}</p>}
      <div className="billing-doc-types" role="radiogroup" aria-label="Tipo de documento">
        {(['CPF', 'CNPJ'] as DocumentType[]).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            className={`schedule-type${type === t ? ' schedule-type--on' : ''}`}
            onClick={() => {
              setType(t)
              setValue((v) => maskDocument(t, v))
              setError(null)
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <label htmlFor={`${idPrefix}-number`}>{type === 'CPF' ? 'Seu CPF' : 'CNPJ'}</label>
      <input
        id={`${idPrefix}-number`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setValue(maskDocument(type, e.target.value))
          setError(null)
        }}
        onBlur={() => setTouched(true)}
        placeholder={type === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
        aria-invalid={!!shown}
        aria-describedby={shown ? `${idPrefix}-error` : undefined}
      />
      {shown && (
        <p id={`${idPrefix}-error`} className="auth-error" role="alert">
          {shown}
        </p>
      )}
      <small className="home-muted">Usado só para emitir a cobrança no Asaas. Você informa uma vez.</small>
      <div className="billing-doc-actions">
        {onCancel && (
          <button type="button" className="auth-link" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        )}
        <button type="submit" className="water-primary" disabled={saving}>
          {saving ? 'Salvando…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

/** Mesma coisa numa janela por cima da tela (Loja). */
export function BillingDocumentDialog({ onSaved, onCancel, productTitle }: { onSaved: () => void; onCancel: () => void; productTitle?: string }) {
  return createPortal(
    <div className="cropper-backdrop" role="dialog" aria-modal="true" aria-label="CPF para a cobrança">
      <div className="cropper billing-doc-dialog">
        <h3 className="cropper-title">Falta só o seu CPF</h3>
        <BillingDocumentForm
          idPrefix="store-doc"
          intro={`Para emitir a cobrança${productTitle ? ` de “${productTitle}”` : ''}, o Asaas precisa do seu CPF (ou CNPJ).`}
          submitLabel="Salvar e ir para o pagamento"
          onSaved={onSaved}
          onCancel={onCancel}
        />
      </div>
    </div>,
    document.body,
  )
}
