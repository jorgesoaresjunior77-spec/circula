import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  IMC_WEIGHT_MAX_KG,
  IMC_WEIGHT_MIN_KG,
  calcImc,
  imcRange,
  parseDecimal,
} from '../lib/imc'

// Calculadora de IMC: conta feita no aparelho, nada é salvo.

export function ImcPage() {
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

  return (
    <section className="imc-page">
      <h2>Calculadora de IMC</h2>
      <p className="imc-intro">
        Uma conta simples entre peso e altura. Ela não é um diagnóstico e não conta a sua história.
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
      {result !== null && (
        <div className="imc-result" role="status">
          <strong className="imc-value">{String(result).replace('.', ',')}</strong>
          <span>Resultado {imcRange(result)} para adultos.</span>
        </div>
      )}
      <p className="imc-note">
        O IMC não considera massa muscular, idade, gestação nem saúde como um todo. Para entender o seu
        caso, converse com a sua nutricionista ou com o seu médico.
      </p>
    </section>
  )
}
