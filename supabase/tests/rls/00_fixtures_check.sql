-- =====================================================================
-- 00 — Verificação de fixtures (read-only, standalone)
-- =====================================================================
-- Roda ANTES dos cenários. Se algum fixture não existir, o resto da
-- suíte produz falsos positivos/negativos. Este arquivo não usa o
-- framework e não abre transação de escrita.
-- =====================================================================

select jsonb_build_object(
  'ok', (
    (select count(*) from public.profiles where id = '18004064-4776-4c12-8f9f-b1bae6c390f5' and role = 'master') = 1
    and (select count(*) from public.profiles where id = '1c20d81a-1312-4bdd-9e40-390a81536fd1' and role = 'professional') = 1
    and (select count(*) from public.profiles where id = '94bc64f8-3ecc-42da-84c2-abfcbc3f80ef' and role = 'member') = 1
    and (select count(*) from public.communities where id = '077aeceb-7321-48ca-8c23-cb256823755a' and owner_id = '1c20d81a-1312-4bdd-9e40-390a81536fd1') = 1
    and (select count(*) from public.community_members where community_id = '077aeceb-7321-48ca-8c23-cb256823755a' and profile_id = '94bc64f8-3ecc-42da-84c2-abfcbc3f80ef' and status = 'active') = 1
    and (select count(*) from public.posts where id = '5d5b9f92-cc21-43df-856d-7f0e7b27c33d' and community_id = '077aeceb-7321-48ca-8c23-cb256823755a' and hidden_at is null) = 1
    and (select count(*) from public.community_challenges where id = '019cd6ca-1777-48dd-bcc4-d7a8e91dd652' and community_id = '077aeceb-7321-48ca-8c23-cb256823755a') = 1
    and (select count(*) from public.joy_moments where id = 'f9b6b83d-4963-47c6-9f4c-b78918bbee40') = 1
    and (select count(*) from public.community_content where id = '17720895-1032-4fb8-8e8e-968ae6bce31e' and status = 'published') = 1
    and (select count(*) from public.subscriptions where id = 'cf65a3fa-ae1e-4397-a0b0-574c03120562' and subject = 'community' and profile_id = '94bc64f8-3ecc-42da-84c2-abfcbc3f80ef') = 1
    and (select count(*) from public.billing_plans where id = '7162d0df-0e88-438c-96d2-f831bf9b6e1c' and code = 'member_monthly') = 1
    and (select count(*) from public.challenge_participants where profile_id = '94bc64f8-3ecc-42da-84c2-abfcbc3f80ef' and challenge_id = '019cd6ca-1777-48dd-bcc4-d7a8e91dd652') = 1
    -- fixture sintético NÃO deve pré-existir
    and (select count(*) from public.communities where id in ('bbbbbbbb-0000-4000-8000-0000000000b1','cccccccc-0000-4000-8000-0000000000c1')) = 0
  ),
  'counts', jsonb_build_object(
    'posts_visiveis_A', (select count(*) from public.posts where community_id = '077aeceb-7321-48ca-8c23-cb256823755a' and hidden_at is null),
    'post_comments_total', (select count(*) from public.post_comments),
    'post_reactions_total', (select count(*) from public.post_reactions),
    'joy_moments_A', (select count(*) from public.joy_moments where community_id = '077aeceb-7321-48ca-8c23-cb256823755a'),
    'content_publicado_A', (select count(*) from public.community_content where community_id = '077aeceb-7321-48ca-8c23-cb256823755a' and status = 'published'),
    'challenge_current_day', (select public.challenge_current_day('019cd6ca-1777-48dd-bcc4-d7a8e91dd652'))
  ),
  'migration_12_4_aplicada', (
    (select count(*) from pg_policies where schemaname='public' and policyname='posts_select' and qual ilike '%is_master()%') = 0
  )
) as fixtures;
