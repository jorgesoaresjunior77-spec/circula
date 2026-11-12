import { useProductPages } from '../hooks/useProductPages'
import type { MagazineIssue } from '../types/magazine'
import type { Product } from '../types/product'
import { MagazineReader } from './HomeMagazineStrip'

// Leitura do e-book dentro do Círcula: o mesmo leitor da revista (virar
// página, zoom, tela cheia). Só abre para quem a RLS deixa ver as páginas
// (pacote de E-books ou plano completo); sem páginas, avisa em vez de abrir
// um leitor vazio.

interface Props {
  product: Product
  onClose: () => void
}

export function ProductReader({ product, onClose }: Props) {
  const { pages, ready } = useProductPages(product.id, product.community_id)

  if (!ready) {
    return (
      <div className="product-reader-note" role="status">
        <p>Abrindo o e-book…</p>
      </div>
    )
  }

  if (pages.length === 0) {
    return (
      <div className="product-reader-note" role="status">
        <p>As páginas deste e-book ainda não foram cadastradas.</p>
        <button type="button" className="auth-link" onClick={onClose}>
          Fechar
        </button>
      </div>
    )
  }

  const issue: MagazineIssue = {
    id: product.id,
    community_id: product.community_id,
    title: product.title,
    cover_path: null,
    release_date: '',
    pages: pages.map((p) => ({
      id: p.id,
      issue_id: product.id,
      position: p.position,
      image_path: p.image_path,
    })),
  }

  return <MagazineReader issue={issue} onClose={onClose} />
}
