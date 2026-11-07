-- =====================================================================
-- Mensagens do dia: biblioteca automática
-- =====================================================================
-- Decisão do usuário (2026-11-07): a mensagem do dia deve funcionar sozinha,
-- sem publicar frase por frase.
--
-- Novo estado status = 'auto' ("automática"): a mensagem entra no sorteio
-- diário igual a uma publicada. A profissional pode tirar qualquer uma
-- (volta para rascunho) ou fixar como "publicada".
--
-- 1) amplia o CHECK de status;
-- 2) a leitura da membro passa a ver 'published' e 'auto';
-- 3) as mensagens hoje em rascunho viram 'auto', menos a da Clarissa
--    Pinkola Estés em português de Portugal ("nada faças... tu verás").
-- Idempotente, transacional e reversível (rodapé).
-- =====================================================================

begin;

alter table public.daily_inspirations drop constraint if exists daily_inspirations_status_check;
alter table public.daily_inspirations
  add constraint daily_inspirations_status_check
  check (status in ('draft', 'published', 'auto'));

drop policy if exists "daily_inspirations_select" on public.daily_inspirations;
create policy "daily_inspirations_select" on public.daily_inspirations for select to authenticated
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (status in ('published', 'auto') and public.is_community_member(community_id))
  );

update public.daily_inspirations
   set status = 'auto'
 where status = 'draft'
   and body not like 'Dizem que tudo o que buscamos%';

commit;

-- ---- Rollback (manual) ------------------------------------------
-- begin;
-- update public.daily_inspirations set status = 'draft' where status = 'auto';
-- alter table public.daily_inspirations drop constraint daily_inspirations_status_check;
-- alter table public.daily_inspirations add constraint daily_inspirations_status_check check (status in ('draft','published'));
-- drop policy if exists "daily_inspirations_select" on public.daily_inspirations;
-- create policy "daily_inspirations_select" on public.daily_inspirations for select to authenticated
--   using (public.is_master() or public.owns_community(community_id)
--          or (status = 'published' and public.is_community_member(community_id)));
-- commit;
