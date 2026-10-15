import { useMemo } from 'react'
import type { CommunityContent } from '../types/content'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { isInstagramUrl } from '../lib/instagramContent'

// Faixa editorial "No Instagram" — item 5 do redesign da Home.
//
// Reaproveita 100% a infraestrutura existente de `community_content`
// (mesmo filtro `filterInstagramContent`, em lib/instagramContent.ts):
// nenhuma tabela, campo ou migration nova. Cada publicação é um item de
// `community_content` publicado com `external_url` do Instagram — a
// Profissional cadastra o link pela seção "Publicações do Instagram" do
// Painel (6 espaços numerados 1–6, InstagramSlotsManager.tsx), que pede
// SÓ o link (sem imagem/título/descrição obrigatórios). Sempre 6
// espaços na faixa: publicações reais primeiro, o restante como vaga
// vazia — nunca um card falso ou link genérico.
//
// Diferença chave em relação a <HomeExperienceStrip>: aqui o clique
// ABRE A PUBLICAÇÃO NO INSTAGRAM (nova aba), não navega dentro do app —
// por isso os cards são links reais (<a target="_blank">), não botões.
//
// Correção (item 3) — ESTA faixa NUNCA usa o mecanismo de loop/clone
// marquee das outras (<HomeExperienceStrip>, <HomeCirclesSection>): lá
// o conteúdo é uma lista que pode crescer sem limite, então duplicar a
// sequência faz sentido para um vaivém contínuo. Aqui são sempre
// EXATAMENTE 6 espaços fixos — clonar a sequência duplicava os cards no
// DOM (12 ao todo) e, como os vazios são idênticos entre si, dava a
// impressão de "mais Instagram do que configurado" ao arrastar. Única
// sequência real, sem clone: rolagem manual (swipe/scroll) quando não
// couber, nunca autoplay nem duplicação.
const TOTAL_SLOTS = 6

interface HomeInstagramStripProps {
  /** Já filtrado (filterInstagramContent) na HomeToday — publicados,
   *  com link do Instagram (capa opcional). */
  posts: CommunityContent[]
}

function InstagramCard({ post }: { post: CommunityContent }) {
  const { url: coverUrl } = useSignedImageUrl(post.cover_image_url)

  // Correção pontual — reaproveita o mesmo `isInstagramUrl` do filtro
  // compartilhado (instagramContent.ts), sem duplicar a lista de hosts.
  // `filterInstagramContent` já garante isso na origem (HomeToday.tsx),
  // mas o componente não deve confiar cegamente nisso: um link ausente
  // ou inválido não vira um <a> clicável quebrado (sem href, sem
  // target/rel) — o card continua aparecendo, só sem a ação de clique.
  const href = isInstagramUrl(post.external_url) ? post.external_url : null
  // Ajustes de navegação — a capa deixou de ser obrigatória; o Painel
  // (seção "Publicações do Instagram") só pede o link, então o título
  // pode vir vazio (publicação cadastrada pelo campo único de URL). Sem
  // título, o card mostra só a foto (quando há) e o selo "Instagram".
  const hasTitle = post.title.trim().length > 0

  const content = (
    <span className="exp-card-frame">
      {coverUrl && <img src={coverUrl} alt="" className="exp-card-photo" />}
      <span className="exp-card-eyebrow">Instagram</span>
      {hasTitle && <span className="exp-card-title exp-card-title--clamp">{post.title}</span>}
    </span>
  )

  if (!href) {
    return (
      <li className="exp-card-item">
        <div className={`exp-card${coverUrl ? ' exp-card--photo' : ''}`} style={{ cursor: 'default' }}>
          {content}
        </div>
      </li>
    )
  }

  return (
    <li className="exp-card-item">
      <a
        className={`exp-card${coverUrl ? ' exp-card--photo' : ''}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={hasTitle ? `No Instagram — ${post.title}` : 'No Instagram'}
      >
        {content}
      </a>
    </li>
  )
}

function EmptyInstagramCard() {
  return (
    <li className="exp-card-item">
      <div className="exp-card exp-card--empty">
        <span className="exp-card-frame">
          <span className="exp-card-eyebrow">Instagram</span>
          <span className="exp-card-empty-label">Em breve</span>
        </span>
      </div>
    </li>
  )
}

export function HomeInstagramStrip({ posts }: HomeInstagramStripProps) {
  const items = useMemo(() => posts.slice(0, TOTAL_SLOTS), [posts])
  const emptyCount = TOTAL_SLOTS - items.length

  // Sempre 6 espaços: as publicações reais primeiro, o restante como
  // vaga vazia (nunca um card inventado, nunca menos nem mais de 6 no
  // total). Uma única sequência real — sem clone/loop (ver comentário
  // no topo do arquivo) — rolável por swipe/scroll quando não couber.
  return (
    <section className="exp-strip" aria-labelledby="insta-strip-title">
      <h2 id="insta-strip-title" className="circ-strip-title">
        No Instagram
      </h2>
      <div className="exp-viewport">
        <div className="exp-track">
          <ul className="exp-seq">
            {items.map((post) => (
              <InstagramCard key={post.id} post={post} />
            ))}
            {Array.from({ length: emptyCount }, (_, i) => (
              <EmptyInstagramCard key={`empty-${i}`} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
