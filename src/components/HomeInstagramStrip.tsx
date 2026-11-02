import { useMemo } from 'react'
import type { CommunityContent } from '../types/content'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { isInstagramUrl } from '../lib/instagramContent'
import { useDragCarousel, LOOP_EXTRA_COPIES } from '../hooks/useDragCarousel'

// Faixa editorial "No Instagram" — item 5 do redesign da Home.
//
// Reaproveita 100% a infraestrutura existente de `community_content`
// (mesmo filtro `filterInstagramContent`, em lib/instagramContent.ts):
// nenhuma tabela, campo ou migration nova. Cada publicação é um item de
// `community_content` publicado com `external_url` do Instagram. A
// Profissional cadastra o link pela seção "Publicações do Instagram" do
// Painel (6 espaços numerados 1–6, InstagramSlotsManager.tsx). Sempre 6
// espaços na faixa: publicações reais primeiro, o restante como vaga
// vazia — nunca um card falso ou link genérico.
//
// Diferença chave em relação a <HomeExperienceStrip>: aqui o clique
// ABRE A PUBLICAÇÃO NO INSTAGRAM (nova aba), não navega dentro do app —
// por isso os cards são links reais (<a target="_blank">), não botões.
//
// Padronização dos carrosséis (item 2.3, evolução/gamificação) — pedido
// explícito do usuário: os TRÊS carrosséis da Home (Seu Círcula de
// hoje/Círculos/No Instagram) precisam da MESMA velocidade, suavidade,
// ciclo contínuo, lógica de arrasto e experiência mobile, reaproveitando
// o MESMO hook sempre que possível. Esta faixa passou a usar
// useDragCarousel — exatamente o mesmo hook de <HomeExperienceStrip> e
// <HomeCirclesSection> — em vez de ficar sozinha com rolagem nativa sem
// ciclo/arrasto/autoplay. A preocupação antiga (clonar vagas vazias
// idênticas no ciclo poderia parecer "mais Instagram do que existe") não
// se sustenta na prática: uma vaga vazia já é visualmente marcada como
// placeholder (borda tracejada, "Em breve", sem foto) — nunca lida como
// conteúdo real, clonada ou não. Sempre 6 espaços reais no DOM da
// sequência principal (igual a antes); o ciclo só clona essa sequência
// inteira quando ela excede a viewport, como nas outras duas faixas.
const TOTAL_SLOTS = 6

interface HomeInstagramStripProps {
  /** Já filtrado (filterInstagramContent) na HomeToday — publicados,
   *  com link do Instagram (capa opcional). */
  posts: CommunityContent[]
}

function InstagramCard({ post, clone }: { post: CommunityContent; clone: boolean }) {
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
        <div
          className={`exp-card${coverUrl ? ' exp-card--photo' : ''}`}
          style={{ cursor: 'default' }}
          aria-hidden={clone ? true : undefined}
        >
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
        aria-label={clone ? undefined : hasTitle ? `No Instagram — ${post.title}` : 'No Instagram'}
        aria-hidden={clone ? true : undefined}
        tabIndex={clone ? -1 : undefined}
      >
        {content}
      </a>
    </li>
  )
}

function EmptyInstagramCard({ clone }: { clone: boolean }) {
  return (
    <li className="exp-card-item">
      <div className="exp-card exp-card--empty" aria-hidden={clone ? true : undefined}>
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

  const { viewportRef, seqRef, loop, dragging } = useDragCarousel(TOTAL_SLOTS)

  // Sempre 6 espaços: as publicações reais primeiro, o restante como
  // vaga vazia (nunca um card inventado, nunca menos nem mais de 6 no
  // total) — mesma regra de sempre, agora dentro do mesmo mecanismo de
  // ciclo contínuo/arrasto/autoplay das outras duas faixas.
  const renderSeq = (clone: boolean, key?: string) => (
    <ul className="exp-seq" aria-hidden={clone || undefined} key={key} ref={clone ? undefined : seqRef}>
      {items.map((post) => (
        <InstagramCard key={clone ? `${post.id}-${key}` : post.id} post={post} clone={clone} />
      ))}
      {Array.from({ length: emptyCount }, (_, i) => (
        <EmptyInstagramCard key={clone ? `empty-${i}-${key}` : `empty-${i}`} clone={clone} />
      ))}
    </ul>
  )

  return (
    <section className="exp-strip" aria-labelledby="insta-strip-title">
      <h2 id="insta-strip-title" className="circ-strip-title">
        No Instagram
      </h2>
      <div
        className={`exp-viewport exp-viewport--draggable${loop ? ' exp-viewport--looping' : ''}${dragging ? ' exp-viewport--dragging' : ''}`}
        ref={viewportRef}
      >
        <div className="exp-track">
          {renderSeq(false)}
          {loop &&
            Array.from({ length: LOOP_EXTRA_COPIES }, (_, copy) =>
              renderSeq(true, `copy-${copy}`),
            )}
        </div>
      </div>
    </section>
  )
}
