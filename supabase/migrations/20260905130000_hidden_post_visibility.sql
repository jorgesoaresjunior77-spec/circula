-- =====================================================================
-- Fase 8 — correcao R4: post oculto invisivel tambem por ID direto
-- =====================================================================
-- Contexto: a migration 20260905120000 reescreveu `posts_select` para
-- esconder posts com `hidden_at` de Member e da dona (Master ve tudo).
-- Mas `can_view_post()` e `can_participate_in_post()` — usadas pelas
-- policies de SELECT e INSERT de `post_comments` / `post_reactions` (e
-- pelo INSERT de `saved_items` no ramo 'post') — NAO checavam
-- `hidden_at`. Resultado (R4): um Member podia ler/curtir/comentar os
-- comentarios e reacoes de um post oculto se tivesse o ID.
--
-- Correcao MINIMA: adicionar o mesmo predicado `hidden_at IS NULL` de
-- `posts_select` a essas duas funcoes. Nenhuma policy e alterada (elas
-- ja chamam essas funcoes); nenhuma tabela e alterada; a arquitetura de
-- moderacao (RPCs moderate_post / community_posts_moderation) NAO e
-- tocada — a Nutri continua administrando o post oculto por elas
-- (SECURITY DEFINER, fora dessas policies).
--
-- Master mantido: `can_view_post` continua `true` para post oculto no
-- ramo is_master() (mesma regra de posts_select; dependencia da Fase 9).
-- `can_participate_in_post` nunca teve ramo Master (Master nao participa)
-- e passa a exigir `hidden_at IS NULL` — ninguem interage com post oculto.
--
-- Assinaturas, volatilidade (STABLE), SECURITY DEFINER e
-- search_path='public' inalterados. R1 e R3 nao sao tocados. Sem RPC
-- nova. Aditivo (CREATE OR REPLACE), idempotente, transacional,
-- reversivel.
-- =====================================================================

begin;

-- ---- can_view_post: post oculto so e visivel para o Master ------
create or replace function public.can_view_post(p_post_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and (
        is_master()
        or (
          p.hidden_at is null
          and (owns_community(p.community_id) or is_community_member(p.community_id))
        )
      )
  );
$function$;

-- ---- can_participate_in_post: nao ha interacao com post oculto --
create or replace function public.can_participate_in_post(p_post_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and p.hidden_at is null
      and (owns_community(p.community_id) or is_community_member(p.community_id))
  );
$function$;

commit;
