import { useState } from 'react'

const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','🥰','😘','😉','😎','🤗','🥹','😢','😭','😅','😇',
  '🙂','🤩','😴','🤔','😮','🙏','👏','🙌','👍','💪','❤️','🧡','💛','💚','💙','💜',
  '🌸','🌺','🌷','🌻','🌿','🍀','🌱','🌞','⭐','✨','🔥','🎉','🍎','🥗','🥑','🍓',
  '🍋','🥕','🥦','💧','☕','🍵','🏃‍♀️','🧘‍♀️','📸','💬','💡','✅',
]

// Seletor simples dos emojis mais usados.
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="emoji-picker">
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
