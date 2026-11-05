// Ilustrações do Meu Jardim: flor do mês (uma pétala por dia) e árvore do
// ano (uma copa por mês). As pétalas só acendem com o check do dia.

export const PETAL_COLORS = [
  '#e57373',
  '#f06292',
  '#ba68c8',
  '#9575cd',
  '#7986cb',
  '#64b5f6',
  '#4dd0e1',
  '#4db6ac',
  '#81c784',
  '#aed581',
  '#fff176',
  '#ffb74d',
  '#ff8a65',
  '#f48fb1',
  '#ce93d8',
  '#90caf9',
]

const OFF = '#ece7de'
const OFF_STROKE = '#d6cfc3'

export function MonthFlower({
  days,
  checked,
}: {
  days: number
  checked: Set<number>
}) {
  const done = checked.size
  const progress = days > 0 ? done / days : 0
  const complete = done >= days && days > 0
  const step = 360 / days
  // O broto cresce: caule sobe e folhas aparecem com o progresso.
  const stemTop = 250
  const leaf1 = progress >= 0.25
  const leaf2 = progress >= 0.5
  const leaf3 = progress >= 0.75
  return (
    <svg viewBox="0 0 300 380" role="img" aria-label={`Flor do mês: ${done} de ${days} dias`} className="garden-art">
      <path d="M150 372 C148 330 152 290 150 250" stroke="#6fa56a" strokeWidth="7" fill="none" strokeLinecap="round" />
      {leaf1 && <path d="M150 330 C115 322 100 300 96 286 C124 288 144 304 150 330Z" fill="#7fb77a" />}
      {leaf2 && <path d="M150 310 C186 304 204 284 208 268 C178 270 156 286 150 310Z" fill="#8cc486" />}
      {leaf3 && <path d="M150 285 C128 278 118 264 116 254 C134 256 148 268 150 285Z" fill="#7fb77a" />}
      <g transform="translate(150 140)">
        {Array.from({ length: days }, (_, i) => {
          const lit = checked.has(i + 1)
          return (
            <ellipse
              key={i}
              cx="0"
              cy="-68"
              rx={Math.max(6, 190 / days)}
              ry="34"
              transform={`rotate(${i * step})`}
              fill={lit ? PETAL_COLORS[i % PETAL_COLORS.length] : OFF}
              stroke={lit ? 'rgba(0,0,0,0.12)' : OFF_STROKE}
              strokeWidth="1"
            />
          )
        })}
        <circle r="30" fill={complete ? '#f4c542' : '#d9cdb5'} stroke="rgba(0,0,0,0.15)" />
      </g>
      <circle cx="150" cy={stemTop} r="0" />
    </svg>
  )
}

export function YearTree({ monthsDone }: { monthsDone: boolean[] }) {
  const count = monthsDone.filter(Boolean).length
  const trunkTop = 250 - count * 6
  return (
    <svg viewBox="0 0 300 380" role="img" aria-label={`Árvore do ano: ${count} de 12 meses`} className="garden-art">
      <path
        d={`M150 372 C146 330 154 ${trunkTop + 40} 150 ${trunkTop}`}
        stroke="#8a6a4f"
        strokeWidth={8 + count}
        fill="none"
        strokeLinecap="round"
      />
      <g transform={`translate(150 ${Math.max(105, trunkTop - 10)})`}>
        {monthsDone.map((lit, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2
          const r = 68
          return (
            <circle
              key={i}
              cx={Math.cos(a) * r}
              cy={Math.sin(a) * r * 0.85}
              r="26"
              fill={lit ? PETAL_COLORS[(i * 3) % PETAL_COLORS.length] : OFF}
              stroke={lit ? 'rgba(0,0,0,0.12)' : OFF_STROKE}
            />
          )
        })}
        <circle r="30" fill={count === 12 ? '#f4c542' : '#d9cdb5'} stroke="rgba(0,0,0,0.15)" />
      </g>
    </svg>
  )
}
