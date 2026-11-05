import { useEffect, useRef, useState } from 'react'

const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','🥰','😘','😉','😎','🤗','🥹','😢','😭','😅','😇',
  '🙂','🤩','😴','🤔','😮','🙏','👏','🙌','👍','💪','❤️','🧡','💛','💚','💙','💜',
  '🌸','🌺','🌷','🌻','🌿','🍀','🌱','🌞','⭐','✨','🔥','🎉','🍎','🥗','🥑','🍓',
  '🍋','🥕','🥦','💧','☕','🍵','🏃‍♀️','🧘‍♀️','📸','💬','💡','✅',
]

// Seletor simples dos emojis mais usados.
//
// No celular a lista abre como uma folha presa à base da tela (largura
// total, com margem), em vez de uma caixa ancorada no botão — ancorada, ela
// passava da borda direita quando o botão estava longe da esquerda. Toque
// fora ou Esc fecham.
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <span className="emoji-picker" ref={rootRef}>
      <button
        type="button"
        className="emoji-picker-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label="Inserir emoji"
        aria-expanded={open}
      >
        😊
      </button>
      {open && (
        <span className="emoji-picker-pop" role="listbox">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onPick(e)
                setOpen(false)
              }}
            >
              {e}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
