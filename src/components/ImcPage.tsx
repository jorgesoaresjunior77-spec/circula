import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  IMC_LABEL,
  IMC_MESSAGE,
  IMC_WEIGHT_MAX_KG,
  IMC_WEIGHT_MIN_KG,
  calcImc,
  imcBand,
  parseDecimal,
} from '../lib/imc'
import { ImcAvatar } from './ImcAvatar'

// Calculadora de IMC: a conta é feita no aparelho com o peso e a altura que a
// própria usuária informa, e nada é salvo. Não é diagnóstico.

interface ImcPageProps {
  /** Abre a conversa com a nutricionista (só para a membro). */
  onTalkToNutri?: () => void
}

export function ImcPage({ onTalkToNutri }: ImcPageProps) {
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [result, setResult] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const h = parseDecimal(height)
    const w = parseDecimal(weight)
    if (h === null || h < HEIGHT_MIN_CM || h > HEIGHT_MAX_CM) {
      setResult(null)
      setError(`Informe a altura em centímetros, entre ${HEIGHT_MIN_CM} e ${HEIGHT_MAX_CM}.`)
      return
    }
    if (w === null || w < IMC_WEIGHT_MIN_KG || w > IMC_WEIGHT_MAX_KG) {
      setResult(null)
      setError(`Informe o peso em quilos, entre ${IMC_WEIGHT_MIN_KG} e ${IMC_WEIGHT_MAX_KG}.`)
      return
    }
    setError(null)
    setResult(calcImc(w, h))
  }

  const band = result === null ? null : imcBand(result)

  return (
    <section className="imc-page">
      <h2>Calculadora de IMC</h2>
      <p className="imc-intro">
        Uma conta simples entre o seu peso e a sua altura. Ela não é um diagnóstico e não conta a sua história.
      </p>
      <form className="imc-form" onSubmit={handleSubmit}>
        <label>
          Altura (cm)
          <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="Ex.: 165" />
        </label>
        <label>
          Peso (kg)
          <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Ex.: 62,5" />
        </label>
        <button type="submit">Calcular</button>
      </form>
      {error && <p className="auth-error" role="alert">{error}</p>}

      {result !== null && band && (
        <div className="imc-result" role="status">
          <ImcAvatar band={band} />
          <div className="imc-result-text">
            <span className="imc-result-eyebrow">Seu IMC</span>
            <strong className="imc-value">{String(result).replace('.', ',')}</strong>
            <span className="imc-label">{IMC_LABEL[band]}</span>
            <p className="imc-message">{IMC_MESSAGE[band]}</p>
          </div>
          {onTalkToNutri && (
            <button type="button" className="imc-nutri-btn" onClick={onTalkToNutri}>
              Falar com a nutri
            </button>
          )}
          <p className="imc-note imc-note--avatar">
            A ilustração é apenas representativa: o IMC não mostra composição corporal, distribuição de
            gordura nem aparência.
          </p>
        </div>
      )}

      <p className="imc-note">
        O IMC não considera massa muscular, idade, gestação nem saúde como um todo e não é um diagnóstico.
        Para entender o seu caso, converse com a sua nutricionista ou com o seu médico.
      </p>
    </section>
  )
}
