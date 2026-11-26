-- Corrige guard_own_edit(): o trigger roda em posts e em post_comments, mas a função lia new.post_id direto,
-- e a tabela posts não tem essa coluna ("record new has no field post_id"). Qualquer UPDATE em posts
-- (editar, ocultar, mostrar) falhava. Agora cada tabela só toca nas próprias colunas. Só create or replace.
begin;

create or replace function public.guard_own_edit()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.author_id is distinct from old.author_id then raise exception 'author_immutable'; end if;
  if tg_table_name = 'posts' then
    if new.community_id is distinct from old.community_id then raise exception 'community_immutable'; end if;
  elsif tg_table_name = 'post_comments' then
    if (to_jsonb(new) ->> 'post_id') is distinct from (to_jsonb(old) ->> 'post_id') then raise exception 'post_immutable'; end if;
  end if;
  if new.content is distinct from old.content then new.edited_at := now(); end if;
  return new;
end $$;

commit;
-- rollback: reaplicar a versão da migration 20261127120000 (que tem o bug).
