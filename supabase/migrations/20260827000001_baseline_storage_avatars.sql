-- =====================================================================
-- BASELINE (parte 2) — Storage: bucket "avatars"
-- Projeto Supabase: kdqtanqywjpwbnjedafn  (retrato de 2026-08-27)
-- =====================================================================
-- O app (src/hooks/useAuth.ts) usa supabase.storage.from('avatars').
-- Este bucket e suas policies foram criados manualmente no painel e
-- fazem parte do estado atual. Arquivo separado do schema principal
-- para revisão isolada. Preservação fiel — nada corrigido.
--
-- NAO EXECUTAR CONTRA O REMOTO. Reconciliar apenas por:
--     supabase migration repair --status applied 20260827000001
-- =====================================================================

-- ---- bucket ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ---- policies em storage.objects (roles = public) -----------------
drop policy if exists "avatar images are publicly accessible" on storage.objects;
create policy "avatar images are publicly accessible"
  on storage.objects for select to public
  using (bucket_id = 'avatars'::text);

drop policy if exists "users can upload their own avatar" on storage.objects;
create policy "users can upload their own avatar"
  on storage.objects for insert to public
  with check (
    (bucket_id = 'avatars'::text)
    and ((storage.foldername(name))[1] = (auth.uid())::text)
  );

drop policy if exists "users can update their own avatar" on storage.objects;
create policy "users can update their own avatar"
  on storage.objects for update to public
  using (
    (bucket_id = 'avatars'::text)
    and ((storage.foldername(name))[1] = (auth.uid())::text)
  );

drop policy if exists "users can delete their own avatar" on storage.objects;
create policy "users can delete their own avatar"
  on storage.objects for delete to public
  using (
    (bucket_id = 'avatars'::text)
    and ((storage.foldername(name))[1] = (auth.uid())::text)
  );

-- ---- policy em storage.buckets (roles = public) ------------------
drop policy if exists "avatars bucket is publicly visible" on storage.buckets;
create policy "avatars bucket is publicly visible"
  on storage.buckets for select to public
  using (id = 'avatars'::text);
