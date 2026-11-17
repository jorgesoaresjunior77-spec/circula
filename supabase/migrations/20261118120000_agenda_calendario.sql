-- =====================================================================
-- Agenda de conteúdos em calendário mensal (2026-11-18)
--  1. content_schedule.phase — produção x publicação (cor da bolinha).
--  2. content_schedule_rules — regras de conteúdo registradas por mês
--     (month = 'yyyy-mm') ou gerais (month = 'geral'). Só a dona da comunidade.
-- =====================================================================
begin;

alter table public.content_schedule
  add column if not exists phase text not null default 'publicacao';

alter table public.content_schedule
  drop constraint if exists content_schedule_phase_check;
alter table public.content_schedule
  add constraint content_schedule_phase_check check (phase in ('producao', 'publicacao'));

create table if not exists public.content_schedule_rules (
  id               uuid primary key default gen_random_uuid(),
  community_id     uuid not null references public.communities (id) on delete cascade,
  month            text not null check (month = 'geral' or month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  production_days  integer check (production_days is null or (production_days between 0 and 31)),
  posts_per_week   integer check (posts_per_week is null or (posts_per_week between 0 and 50)),
  frequency        text check (frequency is null or char_length(frequency) <= 600),
  posting_rules    text check (posting_rules is null or char_length(posting_rules) <= 4000),
  organization     text check (organization is null or char_length(organization) <= 4000),
  updated_at       timestamptz not null default now(),
  unique (community_id, month)
);

alter table public.content_schedule_rules enable row level security;

drop policy if exists "content_schedule_rules_select" on public.content_schedule_rules;
create policy "content_schedule_rules_select" on public.content_schedule_rules for select to authenticated
  using (public.owns_community(community_id));

drop policy if exists "content_schedule_rules_insert" on public.content_schedule_rules;
create policy "content_schedule_rules_insert" on public.content_schedule_rules for insert to authenticated
  with check (public.owns_community(community_id));

drop policy if exists "content_schedule_rules_update" on public.content_schedule_rules;
create policy "content_schedule_rules_update" on public.content_schedule_rules for update to authenticated
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

drop policy if exists "content_schedule_rules_delete" on public.content_schedule_rules;
create policy "content_schedule_rules_delete" on public.content_schedule_rules for delete to authenticated
  using (public.owns_community(community_id));

revoke all on table public.content_schedule_rules from public, anon;
grant select, insert, update, delete on table public.content_schedule_rules to authenticated;

commit;

-- Para desfazer:
-- begin;
-- drop table if exists public.content_schedule_rules;
-- alter table public.content_schedule drop constraint if exists content_schedule_phase_check;
-- alter table public.content_schedule drop column if exists phase;
-- commit;
