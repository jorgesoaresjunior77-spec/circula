-- =====================================================================
-- Revista: a membro vê a CAPA das edições ainda não lançadas ("Em breve")
-- =====================================================================
-- Hoje a membro só enxerga edições com release_date <= hoje, então com a
-- única edição ("Dezembro 2026", lançamento em 01/12) ela vê a revista
-- vazia. Esta migration deixa a membro ATIVA ler a linha da edição (título,
-- capa, data de lançamento) antes do lançamento.
--
-- As PÁGINAS continuam travadas: magazine_pages_select não muda e só libera
-- as páginas quando release_date <= hoje (ou para a dona e a master).
-- Idempotente, transacional e reversível (rodapé).
-- =====================================================================

begin;

drop policy if exists "magazine_issues_select" on public.magazine_issues;
create policy "magazine_issues_select"
  on public.magazine_issues for select to public
  using (
    public.is_master()
    or public.owns_community(community_id)
    or public.is_community_member(community_id)
  );

commit;

-- ---- Rollback (manual) ------------------------------------------
-- begin;
-- drop policy if exists "magazine_issues_select" on public.magazine_issues;
-- create policy "magazine_issues_select"
--   on public.magazine_issues for select to public
--   using (
--     public.is_master()
--     or public.owns_community(community_id)
--     or (public.is_community_member(community_id) and release_date <= current_date)
--   );
-- commit;
