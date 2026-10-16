import { useMemo } from 'react'
import type { Profile } from '../types/profile'
import type { CommunityWithMembers, JoinResult } from '../types/community'
import type { NavKey } from './PrimaryNav'
import { useCircles } from '../hooks/useCircles'
import { useContent } from '../hooks/useContent'
import { useCommunityCardImages } from '../hooks/useCommunityCardImages'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import { filterInstagramContent } from '../lib/instagramContent'
import { CreateCommunityForm } from './CreateCommunityForm'
import { CommunityView } from './CommunityView'
import { HomeCommunityHeader } from './HomeCommunityHeader'
import { HomeExperienceStrip } from './HomeExperienceStrip'
import { HomeCirclesSection } from './HomeCirclesSection'
import { HomeInstagramStrip } from './HomeInstagramStrip'

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
   * C1 — quando a capa da comunidade em foco está sendo usada como hero
   * fotográfico full-bleed (renderizado pelo Dashboard atrás do
   * cabeçalho), o HomeCommunityHeader entra em modo sobreposição: só a
   * identidade da comunidade sobre a foto, sem a própria capa/card.
   */
  coverHero?: boolean
  /**
   * C2 — resumo leve já calculado pelo Dashboard (useRailSummary): o
   * próximo evento. Alimenta a faixa editorial de experiências sem
   * nenhuma consulta nova aqui.
   */
  railSummary?: {
    nextEvent: { id: string; title: string; starts_at: string } | null
  } | null
}

function timeGreeting(now = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function firstName(fullName: string | null): string | null {
  const name = (fullName ?? '').trim().split(/\s+/)[0]
  return name || null
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
  coverHero = false,
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

  const { circles } = useCircles(communityId)

  // No Instagram — publicações que a comunidade cadastrou como
  // community_content com link do Instagram + capa (useContent já
  // existe, sem consulta nova). Alimenta a faixa <HomeInstagramStrip>.
  const { items: contentItems } = useContent(communityId)
  const instagramPosts = useMemo(
    () => filterInstagramContent(contentItems),
    [contentItems],
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

  const greetingName = firstName(profile.full_name)
  const greeting = (
    <header className="home-greeting">
      <h2 className="home-greeting-title">
        {timeGreeting()}
        {greetingName ? `, ${greetingName}` : ''}
      </h2>
      <p className="home-greeting-sub">Seu Círcula de hoje</p>
    </header>
  )

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

  return (
    <div className="home">
      {greeting}

      {/* Fase 10 — cabeçalho da comunidade: capa, logo, nome, profissional
          responsável e nº de participantes. "Onde estou" claro logo na
          entrada. Somente leitura.
          C1 — quando a capa vira hero fotográfico full-bleed, esta
          identidade é renderizada pelo Dashboard DENTRO do hero (sobre a
          foto); aqui ela sai para não duplicar. */}
      {!coverHero && (
        <HomeCommunityHeader community={focusCommunity} profileId={profile.id} />
      )}

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
      <HomeCirclesSection circles={circles} onOpen={onOpenCircle} />

      {/* <HomeInstagramStrip> sempre renderiza (6 espaços fixos, vazios
          ou não) — este separador nunca fica órfão. */}
      <hr className="home-section-divider" />

      {/* Redesign da Home (item 5) — "No Instagram": terceira faixa,
          logo abaixo de Círculos. Mesmos dados do C4.1 (community_content
          publicado + link do Instagram); sem publicação real, mostra
          vagas vazias no lugar (item 1 da reorganização). */}
      <HomeInstagramStrip posts={instagramPosts} />

      <p className="home-institutional-note">
        O Círcula é um espaço de cuidado e amizade entre mulheres.
      </p>
    </div>
  )
}
