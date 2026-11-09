import { useMemo } from 'react'
import type { Profile } from '../types/profile'
import type { CommunityWithMembers, JoinResult } from '../types/community'
import type { NavKey } from './PrimaryNav'
import { useCircles } from '../hooks/useCircles'
import { useContent } from '../hooks/useContent'
import { useCommunityAccessBlocked } from '../hooks/useCommunityAccessBlocked'
import { useCommunityCardImages } from '../hooks/useCommunityCardImages'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { useProducts } from '../hooks/useProducts'
import { useMagazines } from '../hooks/useMagazines'
import { CreateCommunityForm } from './CreateCommunityForm'
import { CommunityView } from './CommunityView'
import { CommunityAccessBlockedCard } from './CommunityAccessBlockedCard'
import { HomeCommunityHeader } from './HomeCommunityHeader'
import { HomeExperienceStrip } from './HomeExperienceStrip'
import { HomeCirclesSection } from './HomeCirclesSection'
import { HomeMagazineStrip } from './HomeMagazineStrip'
import { MagazineManager } from './MagazineManager'
import { HomeEditorialCards } from './HomeEditorialCards'
import { HomeWeekCalendar } from './HomeWeekCalendar'
import { AnalogClock } from './AnalogClock'
import { HomeGreeting } from './HomeGreeting'
import { HomeToolCards } from './HomeToolCards'
import { HomePartnersStrip } from './HomePartnersStrip'
import { HomeDailyMessage } from './HomeDailyMessage'
import { HomeMenuWheel } from './HomeMenuWheel'

// FASE 2 · ITEM 2 — "Seu Círcula de hoje"
//
// Dashboard pessoal do destino "Início" para member e professional.
// master NÃO chega aqui (o Dashboard exige role !== 'master').
//
// Redesign da Home (item 1/3/5) — "Atividade recente" saiu (a Home não
// mostra mais publicações/conversas/atividade do Feed; o Feed continua
// intacto e acessível pela navegação). Em consequência, `usePosts` e
// `useHomeToday` deixaram de ter qualquer consumidor aqui e saíram
// também — nenhum dos dois alimentava outra coisa nesta tela.

interface HomeTodayProps {
  profile: Profile
  /** Já filtrado por papel em useCommunity (professional: só a própria). */
  communities: CommunityWithMembers[]
  discoverableCommunities: CommunityWithMembers[]
  /** Contagem real de participantes por comunidade (useCommunity.memberCounts). */
  memberCounts: Record<string, number>

  onCreateCommunity: (input: {
    name: string
    slug: string
    description: string
    cover_image_url?: string | null
  }) => Promise<{ error: string | null }>
  /** Reorganização do menu — descoberta de comunidade (antes no destino
   *  "Comunidades", removido) virou parte deste fallback. Mesmo
   *  `joinCommunity` de sempre (useCommunity), só chamado daqui agora. */
  onJoinCommunity: (communityId: string) => Promise<JoinResult>
  onNavigate: (key: NavKey) => void
  /**
   * Correção dos cards de Círculos — abre a página de UM círculo
   * específico (CircleDetail), em vez da lista genérica de Círculos.
   * Implementado pelo Dashboard: resolve a comunidade certa e seleciona
   * o círculo antes de navegar.
   */
  onOpenCircle: (circleId: string) => void
  /**
   * Etapa 5 (evolução/experiência/gamificação) — abre o formulário de
   * solicitação de novo Círculo. `undefined` (ex.: Professional, que já
   * cria Círculos direto no Painel) omite o card "Novo Círculo" da
   * faixa, sem mudar mais nada em <HomeCirclesSection>.
   */
  onRequestNewCircle?: () => void
  /**
   * C1 — quando a capa da comunidade em foco está sendo usada como hero
   * fotográfico full-bleed (renderizado pelo Dashboard atrás do
   * cabeçalho), o HomeCommunityHeader entra em modo sobreposição: só a
   * identidade da comunidade sobre a foto, sem a própria capa/card.
   */
  coverHero?: boolean
  /** Bolinhas vermelhas dos cards (ver useHomeBadges). */
  badges?: Record<string, number>
  /**
   * C2 — resumo leve já calculado pelo Dashboard (useRailSummary): o
   * próximo evento. Alimenta a faixa editorial de experiências sem
   * nenhuma consulta nova aqui.
   */
  railSummary?: {
    nextEvent: {
      id: string
      title: string
      starts_at: string
      cover_image_url: string | null
      is_online: boolean | null
    } | null
  } | null
}

export function HomeToday({
  profile,
  communities,
  discoverableCommunities,
  memberCounts,
  onCreateCommunity,
  onJoinCommunity,
  onNavigate,
  onOpenCircle,
  onRequestNewCircle,
  coverHero = false,
  badges = {},
  railSummary = null,
}: HomeTodayProps) {
  const myCommunities = useMemo(
    () =>
      communities.filter((community) =>
        community.community_members.some((member) => member.profile?.id === profile.id),
      ),
    [communities, profile.id],
  )

  // Comunidade em foco: a própria (professional) ou a primeira em que a
  // usuária participa (member). MVP sem seletor multi-comunidade.
  const focusCommunity =
    profile.role === 'professional'
      ? (communities[0] ?? null)
      : (myCommunities[0] ?? null)
  const communityId = focusCommunity?.id ?? null
  // Membro bloqueado por cobrança precisa achar o caminho de regularizar
  // logo na Home (a tela antiga "Minha comunidade" saiu do menu).
  const { blocked: accessBlocked } = useCommunityAccessBlocked(profile, communityId)

  const { circles } = useCircles(communityId)

  const { items: contentItems } = useContent(communityId)
  const { issues: magazineIssues } = useMagazines(communityId)
  // Cards editoriais (Receitas/Eventos/Loja) — finalização (pedido do
  // usuário): cada card passa a destacar UM item real (a receita/produto
  // mais recente publicado; o evento já é "o próximo", via railSummary),
  // em vez de só uma contagem genérica. `contentItems`/`products` já
  // carregados acima/abaixo (sem consulta nova) e ambos já vêm ordenados
  // por created_at DESC (useContent/useProducts) — o primeiro item
  // publicado de cada tipo já É o mais recente, sem reordenar aqui.
  const featuredRecipe = useMemo(
    () => contentItems.find((item) => item.type === 'recipe' && item.status === 'published') ?? null,
    [contentItems],
  )
  const recipesCount = useMemo(
    () => contentItems.filter((item) => item.type === 'recipe' && item.status === 'published').length,
    [contentItems],
  )
  const { products } = useProducts(communityId)
  const featuredProduct = useMemo(
    () => products.find((product) => product.status === 'published') ?? null,
    [products],
  )
  const productsCount = useMemo(
    () => products.filter((product) => product.status === 'published').length,
    [products],
  )

  // Capas (só VISUAL) que a Profissional cadastrou no Painel para os
  // cards fixos de "Seu Círcula de hoje" — ver types/communityCards.ts
  // pro mapa completo chave legada -> destino atual. Sem imagem
  // cadastrada -> fallback editorial (sem foto), como sempre.
  // Correção dos cards duplicados — a chave legada 'instagram' (que
  // guardava a capa do antigo card "Círculos" nesta faixa) saiu: o
  // destino Círculos não aparece mais aqui (tem sua própria seção
  // editorial, <HomeCirclesSection>, com a capa de cada Círculo real).
  const { images: cardImagePaths } = useCommunityCardImages(communityId)
  const { url: perfilCover } = useSignedImageUrl(cardImagePaths.hoje ?? null)
  const { url: helpNutriCover } = useSignedImageUrl(cardImagePaths.desafios ?? null)
  const { url: eventosCover } = useSignedImageUrl(cardImagePaths.eventos ?? null)
  const { url: lojaCover } = useSignedImageUrl(cardImagePaths.comunidade ?? null)
  // Ajustes de navegação — capa do card "Receitas", guardada sob a chave
  // legada 'jornada' (ver types/communityCards.ts).
  const { url: receitasCover } = useSignedImageUrl(cardImagePaths.jornada ?? null)
  // Etapa 3.2 (evolução/gamificação) — capa do card "Meu Jardim", chave
  // `jardim` (migration 20261030120000, preparada e não aplicada).
  const { url: jardimCover } = useSignedImageUrl(cardImagePaths.jardim ?? null)
  const { url: novoCirculoCover } = useSignedImageUrl(cardImagePaths.novo_circulo ?? null)
  const { url: magazineOffice } = useSignedImageUrl(cardImagePaths.revista_escritorio ?? null)
  // Cards editoriais — a foto do PRÓPRIO item em destaque (evento/receita),
  // quando existe, prevalece sobre a capa genérica da categoria acima
  // (fallback em HomeEditorialCards.tsx); mesma assinatura de
  // EventCard.tsx/ContentCard.tsx para esses dois tipos. Produto NÃO
  // passa por aqui — ProductCard.tsx usa `cover_image_url` direto, sem
  // assinatura, então HomeEditorialCards faz o mesmo.
  const { url: nextEventCover } = useSignedImageUrl(railSummary?.nextEvent?.cover_image_url ?? null)
  const { url: featuredRecipeCover } = useSignedImageUrl(featuredRecipe?.cover_image_url ?? null)
  // Correções visuais (item 4) — banners editoriais grandes, independentes
  // das capas dos cards compactos acima (chaves *_grande, ver
  // types/communityCards.ts). Prioridade máxima em HomeEditorialCards —
  // na ausência delas, a cascata de fallback atual (foto do item em
  // destaque -> capa do card compacto) segue intocada.
  const { url: eventosCoverGrande } = useSignedImageUrl(cardImagePaths.eventos_grande ?? null)
  const { url: receitasCoverGrande } = useSignedImageUrl(cardImagePaths.jornada_grande ?? null)
  const { url: lojaCoverGrande } = useSignedImageUrl(cardImagePaths.comunidade_grande ?? null)

  const greeting = <HomeGreeting fullName={profile.full_name} />

  // --- Sem comunidade: preserva os fallbacks do "Início" atual -------
  if (profile.role === 'professional' && communities.length === 0) {
    return (
      <div className="home">
        {greeting}
        <section className="home-section">
          <h3 className="home-section-title">Minha comunidade</h3>
          <CreateCommunityForm onCreate={onCreateCommunity} />
        </section>
      </div>
    )
  }

  if (!focusCommunity) {
    // Reorganização do menu — a descoberta de comunidade (antes um
    // destino de nav próprio, "Comunidades") vive aqui agora: é o único
    // lugar em que um Member sem nenhuma comunidade ainda precisa dela.
    // Mesmos dados (`discoverableCommunities`, já carregado por
    // useCommunity) e mesmo `onJoin` de sempre — só o local mudou.
    return (
      <div className="home">
        {greeting}
        <section className="community-card">
          <p>Você ainda não faz parte de nenhuma comunidade.</p>
        </section>
        {discoverableCommunities.length > 0 && (
          <section className="home-section">
            <h3 className="home-section-title">Descobrir comunidades</h3>
            <div className="community-grid">
              {discoverableCommunities.map((community) => (
                <CommunityView
                  key={community.id}
                  community={community}
                  memberCount={memberCounts[community.id]}
                  onJoin={() => onJoinCommunity(community.id)}
                  variant="grid"
                />
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  // Calendário compacto — logo depois do banner grande da comunidade, com
  // a mesma linha fininha e o mesmo respiro das outras seções. Com capa, o
  // banner é desenhado pelo Dashboard ANTES desta tela, então o calendário
  // abre a Home; sem capa, o banner (cabeçalho) vem logo abaixo da
  // saudação e o calendário entra depois dele.
  const weekCalendar = (
    <>
      <div className="home-time">
        <HomeWeekCalendar onOpen={() => onNavigate('agenda')} />
        <AnalogClock />
      </div>
      <hr className="home-section-divider" />
      <HomeToolCards onNavigate={onNavigate} />
      <hr className="home-section-divider" />
    </>
  )

  return (
    <div className="home">
      {/* Com banner, a saudação é desenhada pelo Dashboard ACIMA dele. */}
      {!coverHero && greeting}

      {/* Para a membro a frase do dia é o balão ao lado da saudação; a
          profissional ganha aqui o atalho para gerenciar as mensagens. */}
      {profile.role === 'professional' && (
        <HomeDailyMessage communityId={focusCommunity.id} onManage={() => onNavigate('inspiracoes')} />
      )}

      {coverHero && weekCalendar}

      {accessBlocked && <CommunityAccessBlockedCard communityId={focusCommunity.id} />}

      {/* Fase 10 — cabeçalho da comunidade: capa, logo, nome, profissional
          responsável e nº de participantes. "Onde estou" claro logo na
          entrada. Somente leitura.
          C1 — quando a capa vira hero fotográfico full-bleed, esta
          identidade é renderizada pelo Dashboard DENTRO do hero (sobre a
          foto); aqui ela sai para não duplicar. */}
      {!coverHero && (
        <HomeCommunityHeader community={focusCommunity} profileId={profile.id} />
      )}

      {!coverHero && weekCalendar}

      {/* Redesign da Home (item 3) — "Seu Círcula de hoje": destinos fixos
          de navegação (Meu Perfil, Help Nutri, Eventos, Loja, Receitas),
          sempre presentes. "Círculos" não entra aqui — tem a própria
          seção editorial abaixo (<HomeCirclesSection>). */}
      <HomeExperienceStrip
        nextEvent={railSummary?.nextEvent ?? null}
        perfilCover={perfilCover}
        helpNutriCover={helpNutriCover}
        eventosCover={eventosCover}
        lojaCover={lojaCover}
        receitasCover={receitasCover}
        jardimCover={jardimCover}
        badges={badges}
        onNavigate={onNavigate}
      />

      {/* Ajustes visuais (item 1) — linha fininha entre as 3 seções. Só
          antes de Círculos quando a seção realmente renderiza algo
          (HomeCirclesSection devolve null sem círculo cadastrado) —
          nunca um separador "órfão" antes de uma seção vazia. */}
      {circles.length > 0 && <hr className="home-section-divider" />}

      {/* C3 — Círculos da comunidade como coleção editorial, logo após a
          faixa de experiências. Só dados existentes (useCircles já
          instanciado). Correção dos cards de Círculos — abrir leva
          direto à página DAQUELE círculo (CircleDetail), onde seguir/
          deixar de seguir continua disponível; o card deixou de ter
          botão de Entrar/Sair próprio. */}
      <HomeCirclesSection
        circles={circles}
        onOpen={onOpenCircle}
        onRequestNewCircle={onRequestNewCircle}
        newCircleCover={novoCirculoCover}
        newCircleBadge={badges['novo-circulo'] ?? 0}
      />

      {/* Revista Círcula Woman Magazine (substitui a faixa do Instagram). */}
      <hr className="home-section-divider" />
      <HomeMagazineStrip
        issues={magazineIssues}
        officeImage={magazineOffice}
        manager={
          profile.role === 'professional' ? (
            <MagazineManager communityId={focusCommunity.id} profileId={profile.id} />
          ) : undefined
        }
      />

      {/* Pedido do usuário — cards editoriais de Receitas/Eventos/Loja,
          depois da faixa do Instagram (ver HomeEditorialCards.tsx).
          Vitrines de conteúdo em destaque: cada um mostra UM item real
          (a foto/dados do próprio evento/receita/produto), não mais só
          um rótulo genérico de categoria — essa é a diferença proposital
          em relação aos atalhos compactos de "Seu Círcula de hoje", que
          continuam levando aos mesmos destinos. */}
      <hr className="home-section-divider" />
      <HomeEditorialCards
        receitasCover={receitasCover}
        eventosCover={eventosCover}
        lojaCover={lojaCover}
        eventosCoverGrande={eventosCoverGrande}
        receitasCoverGrande={receitasCoverGrande}
        lojaCoverGrande={lojaCoverGrande}
        nextEvent={railSummary?.nextEvent ?? null}
        nextEventCover={nextEventCover}
        recipesCount={recipesCount}
        featuredRecipe={featuredRecipe}
        featuredRecipeCover={featuredRecipeCover}
        productsCount={productsCount}
        featuredProduct={featuredProduct}
        onNavigate={onNavigate}
      />

      <HomeMenuWheel onNavigate={onNavigate} showSubscriptions={profile.role !== 'professional'} />

      <HomePartnersStrip communityId={focusCommunity.id} />

      <p className="home-institutional-note">
        O Círcula é um espaço de cuidado e amizade entre mulheres.
      </p>
    </div>
  )
}
