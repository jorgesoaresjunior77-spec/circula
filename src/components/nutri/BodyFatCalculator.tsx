import { useMemo, useState } from 'react'
import {
  CIRCUMFERENCE_LABEL,
  PROTOCOLS,
  SKINFOLD_LABEL,
  classifyBodyFat,
  computeBodyComposition,
  protocolByKey,
} from '../../lib/bodyComposition'
import type { CompositionResult, ProtocolKey, Sex } from '../../lib/bodyComposition'

// Calculadora de composição corporal por protocolos publicados (dobras cutâneas
// ou circunferências). Não usa inteligência artificial: aplica a equação
// escolhida às medidas que a nutricionista digitou. O resultado é uma estimativa.

const num = (v: string | undefined): number | null => {
  if (v == null || v.trim() === '') return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

export interface AppliedComposition {
  result: CompositionResult
  protocolLabel: string
  skinfolds: Record<string, number>
}

export function BodyFatCalculator({
  sex,
  age,
  weightKg,
  heightCm,
  onApply,
}: {
  sex: Sex | null
  age: number | null
  weightKg: number | null
  heightCm: number | null
  onApply: (applied: AppliedComposition) => void
}) {
  const [open, setOpen] = useState(false)
  const [protocol, setProtocol] = useState<ProtocolKey>('jp3')
  const [skin, setSkin] = useState<Record<string, string>>({})
  const [circ, setCirc] = useState<Record<string, string>>({})
  const proto = protocolByKey(protocol)

  const result = useMemo(() => {
    if (!sex || !age) return null
    const skinfolds: Record<string, number | null> = {}
    for (const k of Object.keys(skin)) skinfolds[k] = num(skin[k])
    const circumferences: Record<string, number | null> = {}
    for (const k of Object.keys(circ)) circumferences[k] = num(circ[k])
    return computeBodyComposition({ protocol, sex, age, weightKg, heightCm, skinfolds, circumferences })
  }, [protocol, sex, age, weightKg, heightCm, skin, circ])

  if (!open) {
    return (
      <button type="button" className="auth-link" onClick={() => setOpen(true)}>
        Calcular gordura corporal por protocolo (dobras ou circunferências)
      </button>
    )
  }

  const missing = !sex ? 'Informe o sexo no cadastro da paciente.' : !age ? 'Informe a data de nascimento no cadastro da paciente.' : null

  return (
    <fieldset className="body-fat-calc">
      <legend>Gordura corporal por protocolo</legend>
      <p className="home-muted">
        Cálculo por equações publicadas, sem inteligência artificial. Digite as dobras (mm) ou as circunferências (cm) medidas na paciente. O resultado é uma
        estimativa: a interpretação é sua.
      </p>
      {missing && <p className="auth-error">{missing}</p>}
      <label>
        Protocolo
        <select value={protocol} onChange={(e) => setProtocol(e.target.value as ProtocolKey)}>
          {PROTOCOLS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      {sex && (
        <div className="nutri-grid2">
          {proto.skinfolds[sex].map((k) => (
            <label key={k}>
              {SKINFOLD_LABEL[k]} (mm)
              <input inputMode="decimal" value={skin[k] ?? ''} onChange={(e) => setSkin((s) => ({ ...s, [k]: e.target.value }))} />
            </label>
          ))}
          {proto.circumferences[sex].map((k) => (
            <label key={k}>
              {CIRCUMFERENCE_LABEL[k]} (cm)
              <input inputMode="decimal" value={circ[k] ?? ''} onChange={(e) => setCirc((s) => ({ ...s, [k]: e.target.value }))} />
            </label>
          ))}
        </div>
      )}
      {protocol === 'navy' && !heightCm && <p className="home-muted">Informe a altura nas medidas corporais acima.</p>}

      {result && sex && (
        <div className="body-fat-result" role="status">
          <p>
            <strong>{result.bodyFatPct.toLocaleString('pt-BR')}% de gordura</strong> · {classifyBodyFat(sex, result.bodyFatPct)}
          </p>
          <p>
            Massa de gordura: <strong>{result.fatMassKg != null ? `${result.fatMassKg.toLocaleString('pt-BR')} kg` : 'informe o peso'}</strong> · Massa magra:{' '}
            <strong>{result.leanMassKg != null ? `${result.leanMassKg.toLocaleString('pt-BR')} kg` : 'informe o peso'}</strong>
            {result.density != null && <> · Densidade: {result.density.toLocaleString('pt-BR')} g/cm³</>}
          </p>
          {result.warnings.map((w) => (
            <p key={w} className="auth-error">
              {w}
            </p>
          ))}
          <p className="home-muted">Fonte: {proto.source}</p>
          <button
            type="button"
            className="water-primary"
            onClick={() => {
              const skinfolds: Record<string, number> = {}
              for (const k of proto.skinfolds[sex]) {
                const v = num(skin[k])
                if (v) skinfolds[k] = v
              }
              onApply({ result, protocolLabel: proto.label, skinfolds })
            }}
          >
            Usar estes valores na avaliação
          </button>
        </div>
      )}
      <button type="button" className="auth-link" onClick={() => setOpen(false)}>
        Fechar calculadora
      </button>
    </fieldset>
  )
}
