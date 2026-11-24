// Aviso para a membro que ainda não tem o plano de um conteúdo pago.
export function PackagePaywall({
  title,
  planName,
  onOpenPlans,
}: {
  title: string
  planName: string
  onOpenPlans: () => void
}) {
  return (
    <section className="package-paywall">
      <h2>{title}</h2>
      <p className="plans-text">
        Este conteúdo faz parte do plano <strong>{planName}</strong>. Assine para liberar, ou escolha o Círcula
        Premium e tenha todos os conteúdos juntos, com desconto. No plano de 6 meses ou de 1 ano o Premium sai ainda mais em conta.
      </p>
      <button type="button" className="water-primary" onClick={onOpenPlans}>
        Ver planos
      </button>
    </section>
  )
}
