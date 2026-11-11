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
  scalePosition,
  scaleStops,
} from '../lib/imc'
import { ImcAvatarView } from './Doll3DView'
import { m, SPRING_SOFT } from '../lib/motionKit'

// Calculadora de IMC: a conta é feita no aparelho com o peso e a altura que a
// própria usuária informa, e nada é salvo. Não é diagnóstico.

interface ImcPageProps {
  /** Abre a conversa com a nutricionista (só para a membro). */
  onTalkToNutri?: () => void
}

/** Escala de referência: quatro faixas suaves e um marcador no valor do resultado. */
function ImcScale({ imc }: { imc: number }) {
  const [a, b, c] = scaleStops()
  return (
    <div className="imc-scale" aria-hidden="true">
      <div className="imc-scale-bar">
        <span className="imc-scale-seg imc-scale-seg--abaixo" style={{ width: `${a * 100}%` }} />
        <span className="imc-scale-seg imc-scale-seg--referencia" style={{ width: `${(b - a) * 100}%` }} />
        <span className="imc-scale-seg imc-scale-seg--acima" style={{ width: `${(c - b) * 100}%` }} />
        <span className="imc-scale-seg imc-scale-seg--elevado" style={{ width: `${(1 - c) * 100}%` }} />
        <span className="imc-scale-marker" style={{ left: `${scalePosition(imc) * 100}%` }} />
      </div>
      <div className="imc-scale-labels">
        {(
          [
            ['18,5', a],
            ['25', b],
            ['30', c],
          ] as [string, number][]
        ).map(([label, at]) => (
          <span key={label} style={{ left: `${at * 100}%` }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
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
      <header className="imc-head">
        <p className="imc-eyebrow">Ferramentas</p>
        <h2>Calculadora de IMC</h2>
        <p className="imc-intro">
          Uma conta simples entre o seu peso e a sua altura. Ela não é um diagnóstico e não conta a sua história.
        </p>
      </header>

      <form className="imc-form" onSubmit={handleSubmit} noValidate>
        <div className="imc-field">
          <label htmlFor="imc-height">Altura (cm)</label>
          <div className="imc-input">
            <input
              id="imc-height"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="next"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="165"
              aria-describedby="imc-height-hint"
            />
            <span className="imc-unit" aria-hidden="true">
              cm
            </span>
          </div>
          <p className="imc-hint" id="imc-height-hint">
            Entre {HEIGHT_MIN_CM} e {HEIGHT_MAX_CM} cm
          </p>
        </div>

        <div className="imc-field">
          <label htmlFor="imc-weight">Peso (kg)</label>
          <div className="imc-input">
            <input
              id="imc-weight"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="go"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="62,5"
              aria-describedby="imc-weight-hint"
            />
            <span className="imc-unit" aria-hidden="true">
              kg
            </span>
          </div>
          <p className="imc-hint" id="imc-weight-hint">
            Use vírgula ou ponto, como 62,5
          </p>
        </div>

        <button type="submit" className="imc-submit">
          Calcular
        </button>
      </form>
      {error && (
        <p className="auth-error imc-error" role="alert">
          {error}
        </p>
      )}

      {result !== null && band && (
        <m.div
          key={result}
          className="imc-result"
          role="status"
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={SPRING_SOFT}
        >
          <ImcAvatarView band={band} />
          <div className="imc-result-text">
            <span className="imc-result-eyebrow">Seu IMC</span>
            <strong className="imc-value">{String(result).replace('.', ',')}</strong>
            <span className="imc-label">{IMC_LABEL[band]}</span>
            <p className="imc-message">{IMC_MESSAGE[band]}</p>
          </div>
          <ImcScale imc={result} />
          {onTalkToNutri && (
            <button type="button" className="imc-nutri-btn" onClick={onTalkToNutri}>
              Falar com a nutri
            </button>
          )}
          <p className="imc-note imc-note--avatar">
            A ilustração é apenas representativa: o IMC não mostra composição corporal, distribuição de
            gordura nem aparência.
          </p>
        </m.div>
      )}

      <p className="imc-note">
        O IMC não considera massa muscular, idade, gestação nem saúde como um todo e não é um diagnóstico.
        Para entender o seu caso, converse com a sua nutricionista ou com o seu médico.
      </p>
    </section>
  )
}
