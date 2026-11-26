// Data curta da Home, ao lado do relógio: "SEX 26 NOV" (dia da semana e mês com três letras maiúsculas,
// dia com dois dígitos, em português). Usa o fuso do aparelho de quem está vendo, salvo se outro for pedido.

const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const WEEKDAY_EN: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function formatClockDate(at: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', day: '2-digit', month: 'numeric' }).formatToParts(at)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const dia = DIAS[WEEKDAY_EN[get('weekday')] ?? at.getDay()]
  const mes = MESES[(Number(get('month')) || at.getMonth() + 1) - 1]
  return `${dia} ${get('day').padStart(2, '0')} ${mes}`
}
