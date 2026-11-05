import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { EyeIcon, EyeOffIcon } from './icons'

// Campo de senha com "olhinho" para ver o que foi digitado. Mesmo <input> de
// sempre (id, autoComplete, required etc. passam direto); só o tipo alterna
// entre password e text. O botão é do tipo button (nunca envia o formulário)
// e anuncia o estado para leitores de tela.
type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function PasswordInput({ className, ...inputProps }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="password-field">
      <input
        {...inputProps}
        className={className}
        type={visible ? 'text' : 'password'}
      />
      <button
        type="button"
        className="password-field-toggle"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
      </button>
    </div>
  )
}
