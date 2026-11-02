-- =====================================================================
-- Etapa 5 (evolução/experiência/gamificação) — Solicitação de novo Círculo
-- =====================================================================
-- NÃO APLICADA — preparada nesta etapa, aguardando autorização explícita
-- do usuário antes de rodar contra o banco remoto (Etapa 10: "não
-- aplicar migrations remotamente nesta etapa").
--
-- v2 (pós-auditoria) — único ajuste: GRANT explícito para `authenticated`/
-- `service_role`, que faltava na v1 (achado da auditoria de correções
-- finais — "gotcha" de infra do projeto, mesma causa/mesma correção da
-- 20261030140000). Tudo o que já tinha sido auditado e aprovado (RLS,
-- tabela, índice único parcial, notificação) continua idêntico.
--
-- Contexto: card "Novo Círculo" na faixa editorial de Círculos da Home
-- (<HomeCirclesSection>) abre um formulário (CircleRequestForm.tsx) onde
-- a Member sugere um novo Círculo. A decisão final é sempre da
-- Profissional (nunca cria um Círculo publicado automaticamente) — ver
-- community_circles, tabela intocada por esta migration.
--
-- Tabela nova (não dá para reaproveitar community_circles: uma
-- SOLICITAÇÃO tem campos próprios — motivo, expectativa, imagem de
-- referência, status de revisão — que não fazem sentido num Círculo já
-- publicado, e misturar as duas coisas exigiria colunas nullable extras
-- em community_circles só para linhas "ainda não é um Círculo de
-- verdade").
--
-- Upload da imagem de referência: reaproveita 100% o bucket
-- `community-media` já existente (20260913120000) — a policy de INSERT
-- já permite qualquer membro ativo da comunidade enviar para
-- `<community_id>/covers/<uid>/...`, mesma pasta que CoverImageInput já
-- usa para outras capas. Nenhuma policy de Storage nova.
--
-- Notificação: mesmo molde exato de `notify_on_membership_request`
-- (20260923120000) — AFTER INSERT em circle_requests, só quando nasce
-- 'pending', à prova de exceção, nunca bloqueia o envio da solicitação.
-- +1 coluna FK em social_notifications (related_circle_request_id) +
-- CHECK de `type` ampliado de 10 -> 11 valores (os 10 existentes
-- preservados integralmente).
--
-- 100% aditivo, idempotente, transacional, reversível. Não altera
-- community_circles, Auth, Billing/Asaas, nem nenhuma policy/RLS de
-- tabela existente.
-- =====================================================================

begin;

-- ---- 1) tabela -----------------------------------------------------
create table if not exists public.circle_requests (
  id                  uuid not null default gen_random_uuid(),
  community_id        uuid not null,
  profile_id          uuid not null,             -- quem pediu (Member)
  suggested_name      text not null,
  topic               text,                       -- "sobre qual assunto"
  reason              text,                       -- "por que gostaria de participar"
  activities          text,                       -- "que tipo de conversas/atividades"
  visual_idea         text,                       -- "como imagina a identidade visual"
  notes               text,                       -- observação adicional
  reference_image_path text,                      -- path no bucket community-media (covers/<uid>/...)
  status              text not null default 'pending',
  professional_note   text,                       -- observação/resposta da Profissional
  created_at          timestamptz not null default now(),
  reviewed_at         timestamptz,
  reviewed_by         uuid,
  constraint circle_requests_pkey primary key (id),
  constraint circle_requests_status_check check (
    status = any (array['pending'::text, 'reviewing'::text, 'approved'::text, 'rejected'::text])
  ),
  constraint circle_requests_suggested_name_check check (char_length(btrim(suggested_name)) > 0),
  constraint circle_requests_community_id_fkey foreign key (community_id)
    references public.communities (id) on delete cascade,
  constraint circle_requests_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade,
  constraint circle_requests_reviewed_by_fkey foreign key (reviewed_by)
    references public.profiles (id) on delete set null
);

-- Impede envio duplicado acidental: só 1 solicitação 'pending' por
-- membro/comunidade ao mesmo tempo (índice parcial único — pode enviar
-- outra depois que a anterior sair de 'pending').
create unique index if not exists circle_requests_one_pending_per_member
  on public.circle_requests (community_id, profile_id)
  where (status = 'pending');

create index if not exists circle_requests_community_created_idx
  on public.circle_requests using btree (community_id, created_at desc);

-- ---- 2) RLS ----------------------------------------------------------
alter table public.circle_requests enable row level security;

-- SELECT: a própria autora (qualquer status) ou a dona da comunidade
-- (owns_community — mesma função já usada em toda a RLS do projeto).
drop policy if exists "circle_requests_select" on public.circle_requests;
create policy "circle_requests_select"
  on public.circle_requests for select to authenticated
  using (profile_id = auth.uid() or public.owns_community(community_id));

-- INSERT: só membro ATIVO da própria comunidade, só em nome de si mesma
-- (profile_id = auth.uid()), só com status inicial 'pending'.
drop policy if exists "circle_requests_insert" on public.circle_requests;
create policy "circle_requests_insert"
  on public.circle_requests for insert to authenticated
  with check (
    profile_id = auth.uid()
    and status = 'pending'
    and public.is_community_member(community_id)
  );

-- UPDATE: só a dona da comunidade (revisar/aprovar/recusar). A autora
-- nunca edita a própria solicitação depois de enviada — evita que o
-- conteúdo revisado pela Profissional mude debaixo dela.
drop policy if exists "circle_requests_update" on public.circle_requests;
create policy "circle_requests_update"
  on public.circle_requests for update to authenticated
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

-- Nenhuma policy de DELETE — fora de escopo nesta etapa.

-- ---- GRANT (correção pós-auditoria) -----------------------------------
-- Mesmo "gotcha" de infra já documentado no projeto (tabela criada por
-- migration SQL não recebe GRANT automático para `authenticated`/`anon`
-- — ver 20260831120000_community_events.sql / 20260831150000_social_
-- notifications.sql, e confirmado por consulta real ao banco remoto na
-- auditoria): esta tabela, como criada na v1 deste arquivo, NÃO tinha
-- nenhum GRANT — a RLS acima nunca chegaria a ser avaliada, e o
-- formulário "Novo Círculo" ficaria permanentemente bloqueado mesmo
-- depois de aplicada. Sem DELETE (fora de escopo, igual à policy).
grant select, insert, update on table public.circle_requests to authenticated;
grant select, insert, update, delete on table public.circle_requests to service_role;

-- ---- 3) social_notifications: coluna + FK + CHECK ampliado ----------
alter table public.social_notifications
  add column if not exists related_circle_request_id uuid;

alter table public.social_notifications
  drop constraint if exists social_notifications_related_circle_request_id_fkey;
alter table public.social_notifications
  add constraint social_notifications_related_circle_request_id_fkey
  foreign key (related_circle_request_id)
  references public.circle_requests (id) on delete cascade;

create index if not exists social_notifications_related_circle_request_idx
  on public.social_notifications using btree (related_circle_request_id);

alter table public.social_notifications
  drop constraint if exists social_notifications_type_check;
alter table public.social_notifications
  add constraint social_notifications_type_check check (
    type = any (array[
      'post_comment'::text,
      'post_reaction'::text,
      'circle_join'::text,
      'event_rsvp'::text,
      'direct_message'::text,
      'help_request'::text,
      'membership_requested'::text,
      'membership_approved'::text,
      'membership_rejected'::text,
      'circle_request'::text
    ])
  );

-- ---- 4) gatilho: nova solicitação -> notifica a dona -----------------
create or replace function public.notify_on_circle_request()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_owner      uuid;
  v_actor_name text;
begin
  begin
    if new.status = 'pending' then
      select owner_id into v_owner
      from public.communities where id = new.community_id;

      if v_owner is not null and v_owner <> new.profile_id then
        select full_name into v_actor_name
        from public.profiles where id = new.profile_id;

        insert into public.social_notifications
          (profile_id, actor_profile_id, type, title, body, related_circle_request_id, related_community_id)
        values
          (v_owner, new.profile_id, 'circle_request',
           coalesce(v_actor_name, 'Uma mulher do Círcula') || ' sugeriu um novo Círculo',
           new.suggested_name,
           new.id, new.community_id);
      end if;
    end if;
  exception when others then
    null; -- nunca bloquear o envio da solicitação
  end;

  return new;
end;
$function$;

drop trigger if exists trg_notify_on_circle_request on public.circle_requests;
create trigger trg_notify_on_circle_request
  after insert on public.circle_requests
  for each row execute function public.notify_on_circle_request();

commit;

-- ---- Rollback (manual) ------------------------------------------
-- begin;
-- drop trigger if exists trg_notify_on_circle_request on public.circle_requests;
-- drop function if exists public.notify_on_circle_request();
-- alter table public.social_notifications
--   drop constraint if exists social_notifications_type_check;
-- alter table public.social_notifications
--   add constraint social_notifications_type_check check (
--     type = any (array[
--       'post_comment'::text, 'post_reaction'::text, 'circle_join'::text,
--       'event_rsvp'::text, 'direct_message'::text, 'help_request'::text,
--       'membership_requested'::text, 'membership_approved'::text,
--       'membership_rejected'::text
--     ])
--   );
-- drop index if exists social_notifications_related_circle_request_idx;
-- alter table public.social_notifications
--   drop constraint if exists social_notifications_related_circle_request_id_fkey;
-- alter table public.social_notifications
--   drop column if exists related_circle_request_id;
-- revoke select, insert, update on table public.circle_requests from authenticated;
-- revoke select, insert, update, delete on table public.circle_requests from service_role;
-- drop table if exists public.circle_requests;
-- commit;
