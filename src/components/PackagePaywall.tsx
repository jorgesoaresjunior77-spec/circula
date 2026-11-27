import { PRODUCTS, formatBrl } from '../lib/plansCatalog'
import type { ProductKey } from '../lib/plansCatalog'

// Aviso para a membro que ainda não tem o plano de um conteúdo pago: deixa claro que está bloqueado,
// diz quanto custa e leva para a página de Planos, onde a Livi mostra o melhor plano para ela.
export function PackagePaywall({
  title,
  planName,
  productKey,
  onOpenPlans,
}: {
  title: string
  planName: string
  /** Quando vem, o aviso mostra o preço mensal do avulso (do catálogo). */
  productKey?: ProductKey
  onOpenPlans: () => void
}) {
  const product = productKey ? PRODUCTS.find((p) => p.key === productKey) : undefined
  return (
    <section className="package-paywall" role="alert" aria-labelledby="package-paywall-title">
      <p className="package-paywall-lock" aria-hidden="true">
        🔒
      </p>
      <h2 id="package-paywall-title">{title}</h2>
      <p className="package-paywall-status">
        <strong>Você ainda não assinou este recurso.</strong>
      </p>
      <p className="plans-text">
        {product ? (
          <>
            {product.description} Ele faz parte do plano <strong>{planName}</strong>, por{' '}
            <strong>{formatBrl(product.monthlyCents)} por mês</strong>.
          </>
        ) : (
          <>
            Este conteúdo faz parte do plano <strong>{planName}</strong>.
          </>
        )}{' '}
        Assine para liberar, ou escolha o Círcula Premium e tenha tudo junto, com desconto. No plano de 6 meses ou de 1 ano
        o Premium sai ainda mais em conta.
      </p>
      <button type="button" className="water-primary" onClick={onOpenPlans}>
        Ver planos e assinar
      </button>
    </section>
  )
}
