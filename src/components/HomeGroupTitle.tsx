// Título curto de cada grupo da Home (Hoje, Descobrir, Para você): organiza a
// rolagem em três partes fáceis de reconhecer.

export function HomeGroupTitle({ children }: { children: string }) {
  return (
    <h2 className="home-group-title">
      <span>{children}</span>
    </h2>
  )
}
