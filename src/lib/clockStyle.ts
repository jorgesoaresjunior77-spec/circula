import { useEffect, useState } from 'react'

// Modelo do relógio da página inicial, escolhido na tela "Relógio do mundo".
// Fica guardado neste aparelho; a Home troca na hora (evento próprio + storage de outra aba).

export type ClockStyle = 'classico' | 'rose' | 'suico'

export const CLOCK_STYLES: { key: ClockStyle; label: string; hint: string }[] = [
  { key: 'classico', label: 'Clássico', hint: 'O de sempre, em bronze' },
  { key: 'rose', label: 'Rosé digital', hint: 'Hora em cima, minutos embaixo' },
  { key: 'suico', label: 'Suíço', hint: 'Ponteiros, prata e ouro' },
]

const KEY = 'circula:clock-style'
const EVENT = 'circula:clock-style'

export function readClockStyle(): ClockStyle {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'rose' || v === 'suico' || v === 'classico') return v
  } catch {
    /* sem storage */
  }
  return 'classico'
}

export function saveClockStyle(style: ClockStyle) {
  try {
    localStorage.setItem(KEY, style)
  } catch {
    /* sem storage: vale só até fechar */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: style }))
}

export function useClockStyle(): [ClockStyle, (s: ClockStyle) => void] {
  const [style, setStyle] = useState<ClockStyle>(readClockStyle)
  useEffect(() => {
    const sync = () => setStyle(readClockStyle())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return [
    style,
    (s: ClockStyle) => {
      setStyle(s)
      saveClockStyle(s)
    },
  ]
}
