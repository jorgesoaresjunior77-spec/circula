import { useState } from 'react'
import { GARDEN_COLORS, GARDEN_COLOR_HEX, GARDEN_COLOR_LABEL } from '../types/garden'
import type { GardenColor } from '../types/profile'

interface GardenColorPickerProps {
  colorOne: GardenColor | null
  colorTwo: GardenColor | null
  onSave: (colorOne: GardenColor | null, colorTwo: GardenColor | null) => Promise<{ error: string | null }>
}

/**
 * Meu Jardim — escolha de até 2 cores pessoais entre as 7 da paleta
 * fixa. Usadas (congeladas) toda vez que a Member compartilha uma
 * conclusão no feed. Clicar numa cor já selecionada a remove; clicar
 * numa 3ª cor substitui a mais antiga das duas.
 */
export function GardenColorPicker({ colorOne, colorTwo, onSave }: GardenColorPickerProps) {
  const [selected, setSelected] = useState<GardenColor[]>(
    [colorOne, colorTwo].filter((c): c is GardenColor => !!c),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle(color: GardenColor) {
    let next: GardenColor[]
    if (selected.includes(color)) {
      next = selected.filter((c) => c !== color)
    } else if (selected.length >= 2) {
      next = [selected[1], color]
    } else {
      next = [...selected, color]
    }
    setSelected(next)
    setSaving(true)
    setError(null)
    const { error: saveError } = await onSave(next[0] ?? null, next[1] ?? null)
    setSaving(false)
    if (saveError) setError(saveError)
  }

  return (
    <div className="garden-color-picker">
      <p className="panel-content-label">Minhas cores</p>
      <div className="garden-color-swatches">
        {GARDEN_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`garden-color-swatch${selected.includes(color) ? ' garden-color-swatch--active' : ''}`}
            style={{ '--garden-swatch-color': GARDEN_COLOR_HEX[color] } as React.CSSProperties}
            onClick={() => toggle(color)}
            disabled={saving}
            aria-pressed={selected.includes(color)}
            title={GARDEN_COLOR_LABEL[color]}
          >
            <span className="garden-color-swatch-dot" />
            {GARDEN_COLOR_LABEL[color]}
          </button>
        ))}
      </div>
      {error && <p className="auth-error">{error}</p>}
    </div>
  )
}
