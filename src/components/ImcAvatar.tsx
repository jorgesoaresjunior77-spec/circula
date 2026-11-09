import type { ImcBand } from '../lib/imc'

// Silhueta feminina ilustrativa, delicada e sem rosto. A largura da cintura e
// do quadril muda de leve conforme a faixa; os ombros e a altura ficam iguais.
// É só uma ilustração: o IMC não define composição corporal nem aparência.

const WIDTH: Record<ImcBand, number> = {
  abaixo: 0.86,
  referencia: 1,
  acima: 1.14,
  elevado: 1.3,
}

export function ImcAvatar({ band }: { band: ImcBand }) {
  const f = WIDTH[band]
  const cx = 60
  const waist = 15 * f
  const hip = 21 * f
  const shoulder = 22
  // Contorno do corpo: ombros -> cintura -> quadril -> pernas, simétrico.
  const body = [
    `M ${cx - shoulder} 52`,
    `C ${cx - shoulder} 46, ${cx - 12} 44, ${cx - 8} 42`,
    `L ${cx + 8} 42`,
    `C ${cx + 12} 44, ${cx + shoulder} 46, ${cx + shoulder} 52`,
    `C ${cx + shoulder} 62, ${cx + waist + 2} 70, ${cx + waist} 82`,
    `C ${cx + waist} 92, ${cx + hip} 98, ${cx + hip} 108`,
    `L ${cx + hip - 3} 150`,
    `L ${cx + 3} 150`,
    `L ${cx} 118`,
    `L ${cx - 3} 150`,
    `L ${cx - hip + 3} 150`,
    `L ${cx - hip} 108`,
    `C ${cx - hip} 98, ${cx - waist} 92, ${cx - waist} 82`,
    `C ${cx - waist - 2} 70, ${cx - shoulder} 62, ${cx - shoulder} 52`,
    'Z',
  ].join(' ')

  return (
    <svg className="imc-avatar" viewBox="0 0 120 160" role="img" aria-label="Ilustração feminina representativa" focusable="false">
      <defs>
        <linearGradient id="imc-avatar-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9c9c0" />
          <stop offset="1" stopColor="#d9b3a8" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy="26" r="13" fill="url(#imc-avatar-fill)" />
      <path d={`M ${cx - 6} 38 L ${cx - 6} 43 L ${cx + 6} 43 L ${cx + 6} 38 Z`} fill="url(#imc-avatar-fill)" />
      <path d={body} fill="url(#imc-avatar-fill)" />
    </svg>
  )
}
