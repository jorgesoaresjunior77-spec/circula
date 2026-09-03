-- =====================================================================
-- Etapa "plataforma completa" — Módulo 7: SALVOS
-- =====================================================================
-- Área "Salvos": referência polimórfica leve a 3 tipos de item que já
-- existem — community_content (Biblioteca), posts (Feed) e
-- community_events (Eventos). Nenhuma tabela existente é alterada,
-- exceto pelos 3 gatilhos de limpeza descritos no item (2) abaixo.
--
--   public.saved_items — 1 linha por (usuária, tipo, item)
--
-- Sem FK real em item_id (Postgres não tem FK polimórfica nativa). A
-- integridade é garantida de duas formas, sem criar nenhuma função nova
-- de visibilidade:
--
-- (1) A policy de INSERT reaproveita as 3 funções que JÁ EXISTEM —
--     can_view_content(uuid), can_view_post(uuid), can_view_event(uuid)
--     — todas SECURITY DEFINER, já GRANTed a authenticated, todas no
--     formato `exists(select 1 from <tabela> where id = p_id and
--     (is_master() or owns_community(...) or is_community_member(...)))`.
--     Um item_id inexistente já reprova sozinho, porque o exists() não
--     encontra a linha — não é preciso nenhuma checagem de existência
--     separada. E quem não pode ver o item (comunidade errada, círculo
--     alheio, conteúdo/evento não publicado sendo member) não consegue
--     salvá-lo.
--
-- (2) 3 gatilhos AFTER DELETE (em community_content, posts e
--     community_events) removem o saved_items órfão quando o item
--     original é excluído. Função única `cleanup_saved_items()`,
--     despachada por TG_TABLE_NAME, SECURITY DEFINER (a exclusão pode
--     ser feita por outra pessoa — a anfitriã apagando conteúdo/evento
--     que alguém salvou), com o corpo dentro de
--     `BEGIN ... EXCEPTION WHEN OTHERS THEN NULL` — nunca bloqueia a
--     exclusão do item original (mesmo padrão de on_message_insert).
--
-- RLS: cada usuária só enxerga/insere/remove os PRÓPRIOS salvos
-- (profile_id = auth.uid()). Sem policy de UPDATE — salvar é binário
-- (a linha existe ou não existe). SEM leitura administrativa do
-- Master aqui — diferente dos outros módulos, "salvos" é dado pessoal,
-- não administrativo da comunidade, e a tela de Salvos não é oferecida
-- ao Master no frontend.
--
-- Idempotente. GRANT DML explícito para authenticated.
-- =====================================================================

begin;

create table if not exists public.saved_items (
  id         uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  item_type  text not null,
  item_id    uuid not null,
  created_at timestamptz not null default now(),
  constraint saved_items_pkey primary key (id),
  constraint saved_items_item_type_check check (
    item_type = any (array['content'::text, 'post'::text, 'event'::text])
  ),
  constraint saved_items_unique unique (profile_id, item_type, item_id),
  constraint saved_items_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade
);

create index if not exists saved_items_profile_created_idx
  on public.saved_items using btree (profile_id, created_at desc);
create index if not exists saved_items_type_item_idx
  on public.saved_items using btree (item_type, item_id);

-- ---- RLS -----------------------------------------------------
alter table public.saved_items enable row level security;

drop policy if exists "saved_items_select" on public.saved_items;
create policy "saved_items_select"
  on public.saved_items for select to public
  using (profile_id = auth.uid());

drop policy if exists "saved_items_insert" on public.saved_items;
create policy "saved_items_insert"
  on public.saved_items for insert to public
  with check (
    profile_id = auth.uid()
    and (
      (item_type = 'content' and public.can_view_content(item_id))
      or (item_type = 'post' and public.can_view_post(item_id))
      or (item_type = 'event' and public.can_view_event(item_id))
    )
  );

drop policy if exists "saved_items_delete" on public.saved_items;
create policy "saved_items_delete"
  on public.saved_items for delete to public
  using (profile_id = auth.uid());

-- (sem policy de update — salvar é binário: insert ou delete)

-- ---- limpeza automática: item original excluído -> some do Salvos --
create or replace function public.cleanup_saved_items()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_type text;
begin
  v_type := case TG_TABLE_NAME
    when 'community_content' then 'content'
    when 'posts' then 'post'
    when 'community_events' then 'event'
    else null
  end;

  if v_type is not null then
    begin
      delete from public.saved_items
        where item_type = v_type and item_id = old.id;
    exception when others then
      null; -- nunca bloquear a exclusão do item original
    end;
  end if;

  return old;
end;
$function$;

drop trigger if exists trg_cleanup_saved_items_content on public.community_content;
create trigger trg_cleanup_saved_items_content
  after delete on public.community_content
  for each row execute function public.cleanup_saved_items();

drop trigger if exists trg_cleanup_saved_items_posts on public.posts;
create trigger trg_cleanup_saved_items_posts
  after delete on public.posts
  for each row execute function public.cleanup_saved_items();

drop trigger if exists trg_cleanup_saved_items_events on public.community_events;
create trigger trg_cleanup_saved_items_events
  after delete on public.community_events
  for each row execute function public.cleanup_saved_items();

-- ---- GRANT ------------------------------------------------
grant select, insert, delete on table public.saved_items to authenticated;

commit;
