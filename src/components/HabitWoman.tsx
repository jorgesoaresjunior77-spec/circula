import { colorAmount } from '../lib/habits'

// Ilustração da mulher do ritual ANTES DE TUDO. Começa em preto e branco
// e ganha cor aos poucos, conforme os hábitos do dia são marcados. Cada
// hábito acende também o seu próprio detalhe (sol, copo, tênis, livro,
// respiração, agenda, coração). O desenho é um SVG autoral, sem imagem
// externa.

interface HabitWomanProps {
  /** Quantos dos 7 hábitos de hoje já foram marcados. */
  done: number
  /** Hábitos marcados hoje (para acender cada detalhe). */
  checked: ReadonlySet<string>
}

export function HabitWoman({ done, checked }: HabitWomanProps) {
  const color = colorAmount(done)
  const grayscale = 1 - color

  return (
    <svg
      className="habit-woman"
      viewBox="0 0 220 300"
      role="img"
      aria-label={`Ilustração: ${done} de 7 hábitos de hoje concluídos`}
      style={{ filter: `grayscale(${grayscale})` }}
    >
      {/* respiração: aura suave atrás dela */}
      <circle cx="110" cy="150" r="104" className={`hw-part hw-aura${checked.has('respiracao') ? ' is-on' : ''}`} />

      {/* luz da manhã: sol */}
      <g className={`hw-part hw-sun${checked.has('luz') ? ' is-on' : ''}`}>
        <circle cx="178" cy="44" r="16" />
        <path d="M178 16v8M178 64v8M150 44h8M198 44h8M158 24l6 6M192 58l6 6M198 24l-6 6M164 58l-6 6" />
      </g>

      {/* espiritualidade: coração sobre a cabeça */}
      <path
        className={`hw-part hw-heart${checked.has('espiritualidade') ? ' is-on' : ''}`}
        d="M110 24c-6-9-20-3-14 8 3 5 14 12 14 12s11-7 14-12c6-11-8-17-14-8Z"
      />

      {/* corpo (sempre presente) */}
      <path className="hw-hair" d="M82 78c0-22 14-34 28-34s28 12 28 34v40H82Z" />
      <circle className="hw-skin" cx="110" cy="82" r="22" />
      <path className="hw-hair-front" d="M88 76c4-16 18-20 34-14 8 3 12 9 12 16-10-6-26-8-46-2Z" />
      <path className="hw-skin" d="M100 102h20v14h-20Z" />
      <path className="hw-dress" d="M84 118h52l22 100H62Z" />
      <path className="hw-skin" d="M84 124 62 176l10 6 22-44Z" />
      <path className="hw-skin" d="M136 124l22 52-10 6-22-44Z" />

      {/* água: copo na mão esquerda */}
      <g className={`hw-part hw-glass${checked.has('agua') ? ' is-on' : ''}`}>
        <path d="M52 160h20l-3 28H55Z" />
        <path d="M54 172h16l-1.4 16H55.4Z" className="hw-glass-water" />
      </g>

      {/* leitura: livro na mão direita */}
      <g className={`hw-part hw-book${checked.has('leitura') ? ' is-on' : ''}`}>
        <path d="M148 164h30v22h-30Z" />
        <path d="M163 164v22" className="hw-book-spine" />
      </g>

      {/* organização: caderninho flutuando */}
      <g className={`hw-part hw-note${checked.has('organizacao') ? ' is-on' : ''}`}>
        <rect x="14" y="84" width="34" height="40" rx="4" />
        <path d="M20 96h22M20 104h22M20 112h14" className="hw-note-lines" />
      </g>

      {/* pernas e exercício: tênis */}
      <path className="hw-skin" d="M92 218h14v50H92Z M114 218h14v50h-14Z" />
      <g className={`hw-part hw-shoes${checked.has('exercicio') ? ' is-on' : ''}`}>
        <path d="M86 268h26v12H80c0-8 2-10 6-12Z" />
        <path d="M108 268h26c4 2 6 4 6 12h-32Z" />
      </g>
    </svg>
  )
}
