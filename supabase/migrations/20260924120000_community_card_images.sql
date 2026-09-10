-- =====================================================================
-- Imagens dos cards de experiência da Home da comunidade
-- =====================================================================
-- A Profissional dona escolhe, no Painel, a capa VISUAL de cada uma das
-- 6 experiências da faixa da Home (Hoje no Círcula, Seus desafios,
-- Próximos eventos, Na comunidade, Sua jornada, No Instagram). É SÓ
-- imagem — não muda a origem dos dados de nenhum card: "Seus desafios"
-- segue mostrando os desafios reais, "Próximos eventos" os eventos
-- reais, etc.
--
-- POR QUE UMA TABELA NOVA — a auditoria da arquitetura atual não achou
-- estrutura adequada para "slot de imagem nomeado por comunidade":
--   · communities: acrescentar 6 colunas por um recurso que pode crescer
--     é frágil e polui a tabela mais quente do schema;
--   · community_content: o CHECK de `type` só aceita
--     recipe/article/tip/material/video/educational — mudar o CHECK e
--     usar linhas de conteúdo como "capa de card" poluiria a Biblioteca
--     (HomeHighlights "Conteúdo para você" lê community_content);
--   · não existe tabela de config/kv genérica por comunidade.
-- Molde adotado: community_billing_settings — uma linha por
-- (community_id, card_key), RLS com owns_community / is_community_member,
-- trigger set_updated_at. O ARQUIVO em si vai para o bucket privado já
-- existente `community-media` (path <community_id>/covers/<uid>/...),
-- cuja policy já isola por comunidade; aqui guardamos só o PATH.
--
-- 100% aditivo, idempotente, transacional, reversível. Nenhuma linha
-- existente é tocada. Não altera Auth/Billing/Asaas/Storage nem
-- qualquer regra de negócio ou rota.
-- =====================================================================

begin;

create table if not exists public.community_card_images (
  community_id  uuid not null,
  card_key      text not null,
  image_path    text not null,
  updated_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint community_card_images_pkey primary key (community_id, card_key),
  constraint community_card_images_community_id_fkey
    foreign key (community_id) references public.communities (id) on delete cascade,
  constraint community_card_images_updated_by_fkey
    foreign key (updated_by) references public.profiles (id) on delete set null,
  constraint community_card_images_card_key_check check (
    card_key = any (array[
      'hoje'::text, 'desafios'::text, 'eventos'::text,
      'comunidade'::text, 'jornada'::text, 'instagram'::text
    ])
  ),
  constraint community_card_images_image_path_check check (length(btrim(image_path)) > 0)
);

create or replace trigger set_community_card_images_updated_at
  before update on public.community_card_images
  for each row execute function public.set_updated_at();

-- ---- RLS ----------------------------------------------------------
alter table public.community_card_images enable row level security;

-- Leitura: quem enxerga a Home da comunidade — Master (suporte), a dona
-- ou um membro. Mesma condição das outras tabelas de comunidade.
drop policy if exists "community_card_images_select" on public.community_card_images;
create policy "community_card_images_select"
  on public.community_card_images for select to public
  using (
    public.is_master()
    or public.owns_community(community_id)
    or public.is_community_member(community_id)
  );

-- Escrita: SOMENTE a dona da comunidade — garante o isolamento entre
-- comunidades (uma profissional nunca altera imagens de outra).
drop policy if exists "community_card_images_insert" on public.community_card_images;
create policy "community_card_images_insert"
  on public.community_card_images for insert to public
  with check (
    public.owns_community(community_id)
    and updated_by = auth.uid()
  );

drop policy if exists "community_card_images_update" on public.community_card_images;
create policy "community_card_images_update"
  on public.community_card_images for update to public
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

drop policy if exists "community_card_images_delete" on public.community_card_images;
create policy "community_card_images_delete"
  on public.community_card_images for delete to public
  using (public.owns_community(community_id));

grant select, insert, update, delete on table public.community_card_images to authenticated;

commit;

-- ---- Rollback (manual) ------------------------------------------
-- drop table if exists public.community_card_images;
