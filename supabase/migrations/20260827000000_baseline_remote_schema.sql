-- =====================================================================
-- BASELINE DO SCHEMA REMOTO — Círcula
-- Projeto Supabase: kdqtanqywjpwbnjedafn  (retrato de 2026-08-27)
-- =====================================================================
-- Este arquivo versiona no Git o schema que JÁ EXISTE no banco remoto,
-- construído manualmente no SQL editor ao longo das FASES 1–4.
--
-- FONTE DE VERDADE: o banco remoto. Este arquivo foi gerado a partir de
-- introspecção somente-leitura (pg_catalog / information_schema).
--
-- NAO EXECUTAR ESTE ARQUIVO CONTRA O REMOTO.
-- A reconciliação do remoto deve ser feita apenas por:
--     supabase migration repair --status applied 20260827000000
-- (isso só cria/preenche supabase_migrations.schema_migrations; nenhuma DDL roda no remoto)
--
-- É idempotente: pode ser aplicado num banco vazio OU num banco que já
-- tenha as migrations 20260821083002 / 20260825221926 aplicadas.
--
-- NENHUMA inconsistência apontada pela auditoria foi corrigida aqui.
-- NENHUM objeto "órfão" foi removido. Preservação fiel.
-- =====================================================================

set check_function_bodies = false;

-- =====================================================================
-- 1. EXTENSÕES
-- =====================================================================
create extension if not exists "pgcrypto"  with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- =====================================================================
-- 2. ENUMS
-- =====================================================================
do $$ begin create type public.user_role as enum ('master', 'professional', 'member');
exception when duplicate_object then null; end $$;

do $$ begin create type public.membership_status as enum ('active', 'pending', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin create type public.billing_cycle as enum ('MONTHLY', 'SEMIANNUALLY', 'YEARLY');
exception when duplicate_object then null; end $$;

do $$ begin create type public.subscription_subject as enum ('platform', 'community');
exception when duplicate_object then null; end $$;

do $$ begin create type public.subscription_status as enum ('trial', 'active', 'past_due', 'canceled', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin create type public.notification_channel as enum ('in_app', 'email');
exception when duplicate_object then null; end $$;

do $$ begin create type public.notification_milestone as enum ('d3', 'd2', 'd1', 'due_today', 'past_due', 'blocked');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- 3. TABELAS  (colunas, defaults, PK, FK, UNIQUE, CHECK inline)
--    Ordem topológica para permitir FKs inline.
-- =====================================================================

-- ---- profiles --------------------------------------------------------
create table if not exists public.profiles (
  id           uuid not null,
  role         public.user_role not null default 'member'::public.user_role,
  full_name    text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  interests    text[] not null default '{}'::text[],
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade
);
-- coluna adicionada fora da migration original:
alter table public.profiles add column if not exists interests text[] not null default '{}'::text[];

-- ---- communities ---------------------------------------------------
create table if not exists public.communities (
  id              uuid not null default gen_random_uuid(),
  name            text not null,
  slug            text not null,
  description     text,
  owner_id        uuid not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  is_discoverable boolean not null default true,
  constraint communities_pkey primary key (id),
  constraint communities_owner_id_key unique (owner_id),
  constraint communities_slug_key unique (slug),
  constraint communities_owner_id_fkey foreign key (owner_id) references public.profiles (id)
);
alter table public.communities add column if not exists is_discoverable boolean not null default true;

-- ---- community_members --------------------------------------------
create table if not exists public.community_members (
  id           uuid not null default gen_random_uuid(),
  community_id uuid not null,
  profile_id   uuid not null,
  status       public.membership_status not null default 'active'::public.membership_status,
  joined_at    timestamptz not null default now(),
  constraint community_members_pkey primary key (id),
  constraint community_members_community_id_profile_id_key unique (community_id, profile_id),
  constraint community_members_community_id_fkey foreign key (community_id) references public.communities (id) on delete cascade,
  constraint community_members_profile_id_fkey foreign key (profile_id) references public.profiles (id) on delete cascade
);

-- ---- community_questions -----------------------------------------
create table if not exists public.community_questions (
  id           uuid not null default gen_random_uuid(),
  community_id uuid not null,
  content      text not null,
  is_active    boolean not null default true,
  created_by   uuid not null,
  created_at   timestamptz not null default now(),
  constraint community_questions_pkey primary key (id),
  constraint community_questions_community_id_fkey foreign key (community_id) references public.communities (id) on delete cascade,
  constraint community_questions_created_by_fkey foreign key (created_by) references public.profiles (id) on delete cascade
);

-- ---- community_challenges ---------------------------------------
create table if not exists public.community_challenges (
  id           uuid not null default gen_random_uuid(),
  community_id uuid not null,
  title        text not null,
  description  text,
  is_active    boolean not null default true,
  created_by   uuid not null,
  created_at   timestamptz not null default now(),
  constraint community_challenges_pkey primary key (id),
  constraint community_challenges_community_id_fkey foreign key (community_id) references public.communities (id) on delete cascade,
  constraint community_challenges_created_by_fkey foreign key (created_by) references public.profiles (id) on delete cascade
);

-- ---- challenge_activities -------------------------------------
create table if not exists public.challenge_activities (
  id           uuid not null default gen_random_uuid(),
  challenge_id uuid not null,
  day_number   integer not null,
  content      text not null,
  constraint challenge_activities_pkey primary key (id),
  constraint challenge_activities_challenge_id_day_number_key unique (challenge_id, day_number),
  constraint challenge_activities_day_number_check check (day_number >= 1),
  constraint challenge_activities_challenge_id_fkey foreign key (challenge_id) references public.community_challenges (id) on delete cascade
);

-- ---- challenge_participants ---------------------------------
create table if not exists public.challenge_participants (
  id           uuid not null default gen_random_uuid(),
  challenge_id uuid not null,
  profile_id   uuid not null,
  joined_at    timestamptz not null default now(),
  constraint challenge_participants_pkey primary key (id),
  constraint challenge_participants_challenge_id_profile_id_key unique (challenge_id, profile_id),
  constraint challenge_participants_challenge_id_fkey foreign key (challenge_id) references public.community_challenges (id) on delete cascade,
  constraint challenge_participants_profile_id_fkey foreign key (profile_id) references public.profiles (id) on delete cascade
);

-- ---- challenge_progress ------------------------------------
create table if not exists public.challenge_progress (
  id           uuid not null default gen_random_uuid(),
  challenge_id uuid not null,
  profile_id   uuid not null,
  day_number   integer not null,
  completed_at timestamptz not null default now(),
  constraint challenge_progress_pkey primary key (id),
  constraint challenge_progress_challenge_id_profile_id_day_number_key unique (challenge_id, profile_id, day_number),
  constraint challenge_progress_day_number_check check (day_number >= 1),
  constraint challenge_progress_challenge_id_fkey foreign key (challenge_id) references public.community_challenges (id) on delete cascade,
  constraint challenge_progress_profile_id_fkey foreign key (profile_id) references public.profiles (id) on delete cascade
);

-- ---- challenge_comments -----------------------------------
create table if not exists public.challenge_comments (
  id           uuid not null default gen_random_uuid(),
  challenge_id uuid not null,
  author_id    uuid not null,
  content      text not null,
  created_at   timestamptz not null default now(),
  constraint challenge_comments_pkey primary key (id),
  constraint challenge_comments_challenge_id_fkey foreign key (challenge_id) references public.community_challenges (id) on delete cascade,
  constraint challenge_comments_author_id_fkey foreign key (author_id) references public.profiles (id)
);

-- ---- community_circles ------------------------------------
create table if not exists public.community_circles (
  id           uuid not null default gen_random_uuid(),
  community_id uuid not null,
  name         text not null,
  created_by   uuid not null,
  created_at   timestamptz not null default now(),
  constraint community_circles_pkey primary key (id),
  constraint community_circles_community_id_fkey foreign key (community_id) references public.communities (id) on delete cascade,
  constraint community_circles_created_by_fkey foreign key (created_by) references public.profiles (id)
);

-- ---- circle_members --------------------------------------
create table if not exists public.circle_members (
  id         uuid not null default gen_random_uuid(),
  circle_id  uuid not null,
  profile_id uuid not null,
  joined_at  timestamptz not null default now(),
  constraint circle_members_pkey primary key (id),
  constraint circle_members_circle_id_profile_id_key unique (circle_id, profile_id),
  constraint circle_members_circle_id_fkey foreign key (circle_id) references public.community_circles (id) on delete cascade,
  constraint circle_members_profile_id_fkey foreign key (profile_id) references public.profiles (id)
);

-- ---- community_checkins ----------------------------------
create table if not exists public.community_checkins (
  id           uuid not null default gen_random_uuid(),
  community_id uuid not null,
  content      text not null,
  is_active    boolean not null default true,
  created_by   uuid not null,
  created_at   timestamptz not null default now(),
  constraint community_checkins_pkey primary key (id),
  constraint community_checkins_community_id_fkey foreign key (community_id) references public.communities (id) on delete cascade,
  constraint community_checkins_created_by_fkey foreign key (created_by) references public.profiles (id)
);

-- ---- checkin_instances ---------------------------------
create table if not exists public.checkin_instances (
  id           uuid not null default gen_random_uuid(),
  community_id uuid not null,
  checkin_id   uuid,
  content      text not null,
  published_by uuid not null,
  created_at   timestamptz not null default now(),
  constraint checkin_instances_pkey primary key (id),
  constraint checkin_instances_community_id_fkey foreign key (community_id) references public.communities (id) on delete cascade,
  constraint checkin_instances_checkin_id_fkey foreign key (checkin_id) references public.community_checkins (id) on delete set null,
  constraint checkin_instances_published_by_fkey foreign key (published_by) references public.profiles (id)
);

-- ---- checkin_responses --------------------------------
create table if not exists public.checkin_responses (
  id                  uuid not null default gen_random_uuid(),
  checkin_instance_id uuid not null,
  profile_id          uuid not null,
  mood                text not null,
  wants_to_share      boolean not null default false,
  created_at          timestamptz not null default now(),
  constraint checkin_responses_pkey primary key (id),
  constraint checkin_responses_checkin_instance_id_profile_id_key unique (checkin_instance_id, profile_id),
  constraint checkin_responses_mood_check check (mood = any (array['great'::text, 'good'::text, 'okay'::text, 'hard'::text])),
  constraint checkin_responses_checkin_instance_id_fkey foreign key (checkin_instance_id) references public.checkin_instances (id) on delete cascade,
  constraint checkin_responses_profile_id_fkey foreign key (profile_id) references public.profiles (id)
);

-- ---- community_engagement_commands -------------------
create table if not exists public.community_engagement_commands (
  id           uuid not null default gen_random_uuid(),
  community_id uuid not null,
  title        text not null,
  content      text not null,
  is_active    boolean not null default true,
  created_by   uuid not null,
  created_at   timestamptz not null default now(),
  constraint community_engagement_commands_pkey primary key (id),
  constraint community_engagement_commands_community_id_fkey foreign key (community_id) references public.communities (id) on delete cascade,
  constraint community_engagement_commands_created_by_fkey foreign key (created_by) references public.profiles (id)
);

-- ---- engagement_command_instances  (ÓRFÃ — preservada) ----
create table if not exists public.engagement_command_instances (
  id           uuid not null default gen_random_uuid(),
  community_id uuid not null,
  command_id   uuid,
  title        text not null,
  content      text not null,
  published_by uuid not null,
  created_at   timestamptz not null default now(),
  constraint engagement_command_instances_pkey primary key (id),
  constraint engagement_command_instances_community_id_fkey foreign key (community_id) references public.communities (id) on delete cascade,
  constraint engagement_command_instances_command_id_fkey foreign key (command_id) references public.community_engagement_commands (id) on delete set null,
  constraint engagement_command_instances_published_by_fkey foreign key (published_by) references public.profiles (id)
);

-- ---- posts ------------------------------------------
create table if not exists public.posts (
  id                    uuid not null default gen_random_uuid(),
  community_id           uuid not null,
  author_id             uuid not null,
  content               text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  post_type             text not null default 'standard'::text,
  question_id           uuid,
  title                 text,
  engagement_command_id uuid,
  constraint posts_pkey primary key (id),
  constraint posts_post_type_check check (post_type = any (array['standard'::text, 'daily_question'::text, 'checkin_share'::text, 'engagement_command'::text])),
  constraint posts_community_id_fkey foreign key (community_id) references public.communities (id) on delete cascade,
  constraint posts_author_id_fkey foreign key (author_id) references public.profiles (id) on delete cascade,
  constraint posts_question_id_fkey foreign key (question_id) references public.community_questions (id) on delete set null,
  constraint posts_engagement_command_id_fkey foreign key (engagement_command_id) references public.community_engagement_commands (id)
);
alter table public.posts add column if not exists post_type text not null default 'standard'::text;
alter table public.posts add column if not exists question_id uuid;
alter table public.posts add column if not exists title text;
alter table public.posts add column if not exists engagement_command_id uuid;

-- ---- post_comments ---------------------------------
create table if not exists public.post_comments (
  id         uuid not null default gen_random_uuid(),
  post_id    uuid not null,
  author_id  uuid not null,
  content    text not null,
  created_at timestamptz not null default now(),
  constraint post_comments_pkey primary key (id),
  constraint post_comments_post_id_fkey foreign key (post_id) references public.posts (id) on delete cascade,
  constraint post_comments_author_id_fkey foreign key (author_id) references public.profiles (id) on delete cascade
);

-- ---- post_reactions -------------------------------
create table if not exists public.post_reactions (
  id         uuid not null default gen_random_uuid(),
  post_id    uuid not null,
  profile_id uuid not null,
  created_at timestamptz not null default now(),
  constraint post_reactions_pkey primary key (id),
  constraint post_reactions_post_id_profile_id_key unique (post_id, profile_id),
  constraint post_reactions_post_id_fkey foreign key (post_id) references public.posts (id) on delete cascade,
  constraint post_reactions_profile_id_fkey foreign key (profile_id) references public.profiles (id) on delete cascade
);

-- ---- billing_plans -------------------------------
create table if not exists public.billing_plans (
  id            uuid not null default gen_random_uuid(),
  subject       public.subscription_subject not null,
  code          text not null,
  name          text not null,
  price_cents   integer not null,
  billing_cycle public.billing_cycle not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint billing_plans_pkey primary key (id),
  constraint billing_plans_code_key unique (code),
  constraint billing_plans_price_cents_check check (price_cents > 0)
);

-- ---- subscriptions ------------------------------
create table if not exists public.subscriptions (
  id                   uuid not null default gen_random_uuid(),
  subject              public.subscription_subject not null,
  profile_id           uuid not null,
  community_id         uuid,
  plan_id              uuid not null,
  next_plan_id         uuid,
  status               public.subscription_status not null default 'trial'::public.subscription_status,
  trial_ends_at        timestamptz not null,
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz not null,
  grace_period_ends_at timestamptz,
  canceled_at          timestamptz,
  asaas_customer_id    text,
  asaas_subscription_id text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint subscriptions_pkey primary key (id),
  constraint subscriptions_community_id_matches_subject check (
    ((subject = 'platform'::public.subscription_subject) and (community_id is null))
    or ((subject = 'community'::public.subscription_subject) and (community_id is not null))
  ),
  constraint subscriptions_profile_id_fkey foreign key (profile_id) references public.profiles (id) on delete cascade,
  constraint subscriptions_community_id_fkey foreign key (community_id) references public.communities (id) on delete cascade,
  constraint subscriptions_plan_id_fkey foreign key (plan_id) references public.billing_plans (id),
  constraint subscriptions_next_plan_id_fkey foreign key (next_plan_id) references public.billing_plans (id)
);

-- ---- payment_charges ---------------------------
create table if not exists public.payment_charges (
  id              uuid not null default gen_random_uuid(),
  subscription_id uuid not null,
  asaas_payment_id text,
  status          text not null default 'PENDING'::text,
  amount_cents    integer not null,
  due_date        date not null,
  paid_at         timestamptz,
  billing_type    text,
  invoice_url     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint payment_charges_pkey primary key (id),
  constraint payment_charges_asaas_payment_id_key unique (asaas_payment_id),
  constraint payment_charges_amount_cents_check check (amount_cents > 0),
  constraint payment_charges_subscription_id_fkey foreign key (subscription_id) references public.subscriptions (id) on delete cascade
);

-- ---- webhook_events ---------------------------
create table if not exists public.webhook_events (
  id             uuid not null default gen_random_uuid(),
  asaas_event_id text not null,
  event_type     text not null,
  payload        jsonb not null,
  received_at    timestamptz not null default now(),
  processed_at   timestamptz,
  constraint webhook_events_pkey primary key (id),
  constraint webhook_events_asaas_event_id_key unique (asaas_event_id)
);

-- ---- billing_notifications_log ---------------
create table if not exists public.billing_notifications_log (
  id              uuid not null default gen_random_uuid(),
  subscription_id uuid not null,
  milestone       public.notification_milestone not null,
  channel         public.notification_channel not null,
  sent_at         timestamptz not null default now(),
  constraint billing_notifications_log_pkey primary key (id),
  constraint billing_notifications_log_subscription_id_milestone_channel_key unique (subscription_id, milestone, channel),
  constraint billing_notifications_log_subscription_id_fkey foreign key (subscription_id) references public.subscriptions (id) on delete cascade
);

-- ---- notifications  (sem consumidor no app — preservada) --
create table if not exists public.notifications (
  id                      uuid not null default gen_random_uuid(),
  profile_id              uuid not null,
  type                    text not null,
  title                   text not null,
  body                    text not null,
  related_subscription_id uuid,
  read_at                 timestamptz,
  created_at              timestamptz not null default now(),
  constraint notifications_pkey primary key (id),
  constraint notifications_profile_id_fkey foreign key (profile_id) references public.profiles (id) on delete cascade,
  constraint notifications_related_subscription_id_fkey foreign key (related_subscription_id) references public.subscriptions (id) on delete set null
);

-- ---- subscription_status_history  (preservada) -----------
create table if not exists public.subscription_status_history (
  id              uuid not null default gen_random_uuid(),
  subscription_id uuid not null,
  old_status      public.subscription_status,
  new_status      public.subscription_status not null,
  reason          text,
  created_at      timestamptz not null default now(),
  constraint subscription_status_history_pkey primary key (id),
  constraint subscription_status_history_subscription_id_fkey foreign key (subscription_id) references public.subscriptions (id) on delete cascade
);

-- ---- billing_customer_data ----------------------------
create table if not exists public.billing_customer_data (
  id              uuid not null default gen_random_uuid(),
  profile_id      uuid not null,
  document_type   text not null,
  document_number text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint billing_customer_data_pkey primary key (id),
  constraint billing_customer_data_profile_id_key unique (profile_id),
  constraint billing_customer_data_document_type_check check (document_type = any (array['CPF'::text, 'CNPJ'::text])),
  constraint billing_customer_data_document_number_format check (
    ((document_type = 'CPF'::text) and (document_number ~ '^[0-9]{11}$'::text))
    or ((document_type = 'CNPJ'::text) and (document_number ~ '^[0-9]{14}$'::text))
  ),
  constraint billing_customer_data_profile_id_fkey foreign key (profile_id) references public.profiles (id) on delete cascade
);

-- ---- platform_split_settings  (ÓRFÃ — preservada) --------
create table if not exists public.platform_split_settings (
  id                  uuid not null default gen_random_uuid(),
  professional_percent numeric(5,2) not null,
  circula_percent     numeric(5,2) not null,
  effective_from      timestamptz not null default now(),
  created_by          uuid not null,
  created_at          timestamptz not null default now(),
  constraint platform_split_settings_pkey primary key (id),
  constraint platform_split_settings_professional_percent_check check ((professional_percent >= (0)::numeric) and (professional_percent <= (100)::numeric)),
  constraint platform_split_settings_circula_percent_check check ((circula_percent >= (0)::numeric) and (circula_percent <= (100)::numeric)),
  constraint platform_split_settings_totals_100 check ((professional_percent + circula_percent) = (100)::numeric),
  constraint platform_split_settings_created_by_fkey foreign key (created_by) references public.profiles (id)
);

-- ---- revenue_split_rules  (ÓRFÃ — preservada) -----------
create table if not exists public.revenue_split_rules (
  id              uuid not null default gen_random_uuid(),
  min_amount_cents integer not null,
  max_amount_cents integer,
  circula_percent numeric(5,2) not null,
  effective_from  timestamptz not null default now(),
  created_by      uuid not null,
  created_at      timestamptz not null default now(),
  constraint revenue_split_rules_pkey primary key (id),
  constraint revenue_split_rules_circula_percent_check check ((circula_percent >= (0)::numeric) and (circula_percent <= (100)::numeric)),
  constraint revenue_split_rules_created_by_fkey foreign key (created_by) references public.profiles (id)
);

-- =====================================================================
-- 4. ÍNDICES (não implícitos de PK/UNIQUE)
--    community_questions permanece SÓ com PK (fiel ao remoto).
-- =====================================================================
create index if not exists challenge_activities_challenge_id_idx           on public.challenge_activities using btree (challenge_id);
create index if not exists challenge_comments_challenge_id_created_at_idx   on public.challenge_comments using btree (challenge_id, created_at);
create index if not exists challenge_participants_challenge_id_idx          on public.challenge_participants using btree (challenge_id);
create index if not exists challenge_progress_challenge_id_idx             on public.challenge_progress using btree (challenge_id);
create index if not exists challenge_progress_profile_id_idx               on public.challenge_progress using btree (profile_id);
create index if not exists checkin_instances_checkin_id_idx               on public.checkin_instances using btree (checkin_id);
create index if not exists checkin_instances_community_id_idx             on public.checkin_instances using btree (community_id);
create index if not exists checkin_responses_checkin_instance_id_idx      on public.checkin_responses using btree (checkin_instance_id);
create index if not exists checkin_responses_profile_id_idx              on public.checkin_responses using btree (profile_id);
create index if not exists circle_members_circle_id_idx                  on public.circle_members using btree (circle_id);
create index if not exists circle_members_circle_id_joined_at_idx        on public.circle_members using btree (circle_id, joined_at);
create index if not exists circle_members_profile_id_idx                 on public.circle_members using btree (profile_id);
create index if not exists communities_owner_id_idx                      on public.communities using btree (owner_id);
create index if not exists community_challenges_community_id_idx         on public.community_challenges using btree (community_id);
create index if not exists community_checkins_community_id_idx           on public.community_checkins using btree (community_id);
create index if not exists community_circles_community_id_idx            on public.community_circles using btree (community_id);
create index if not exists community_engagement_commands_community_id_idx on public.community_engagement_commands using btree (community_id);
create index if not exists community_members_community_id_idx            on public.community_members using btree (community_id);
create index if not exists community_members_profile_id_idx             on public.community_members using btree (profile_id);
create index if not exists engagement_command_instances_command_id_idx   on public.engagement_command_instances using btree (command_id);
create index if not exists engagement_command_instances_community_id_idx  on public.engagement_command_instances using btree (community_id);
create index if not exists notifications_profile_id_idx                  on public.notifications using btree (profile_id, read_at);
create index if not exists payment_charges_due_date_idx                  on public.payment_charges using btree (due_date);
create index if not exists payment_charges_status_idx                    on public.payment_charges using btree (status);
create index if not exists payment_charges_subscription_id_idx           on public.payment_charges using btree (subscription_id);
create index if not exists post_comments_post_id_idx                     on public.post_comments using btree (post_id);
create index if not exists post_reactions_post_id_idx                    on public.post_reactions using btree (post_id);
create index if not exists posts_author_id_idx                           on public.posts using btree (author_id);
create index if not exists posts_community_id_idx                        on public.posts using btree (community_id);
create index if not exists posts_engagement_command_id_idx               on public.posts using btree (engagement_command_id);
create index if not exists subscription_status_history_subscription_id_idx on public.subscription_status_history using btree (subscription_id);
create index if not exists subscriptions_community_id_idx                on public.subscriptions using btree (community_id);
create index if not exists subscriptions_profile_id_idx                 on public.subscriptions using btree (profile_id);
create index if not exists subscriptions_status_idx                     on public.subscriptions using btree (status);
create unique index if not exists subscriptions_platform_unique_idx  on public.subscriptions using btree (profile_id)               where ((subject = 'platform'::public.subscription_subject)  and (status <> 'canceled'::public.subscription_status));
create unique index if not exists subscriptions_community_unique_idx on public.subscriptions using btree (profile_id, community_id) where ((subject = 'community'::public.subscription_subject) and (status <> 'canceled'::public.subscription_status));

-- =====================================================================
-- 5. FUNÇÕES  (DDL exata do catálogo remoto — create or replace)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.role <> old.role and not public.is_master() then
    new.role = old.role;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_master()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'master'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_professional()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'professional'
  );
$function$;

CREATE OR REPLACE FUNCTION public.owns_community(p_community_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.communities
    where id = p_community_id and owner_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.owns_community(p_community_id uuid, p_enforce_billing boolean)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.communities
    where id = p_community_id and owner_id = auth.uid()
  )
  and (
    not p_enforce_billing or public.professional_platform_active(auth.uid())
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_community_member(p_community_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.community_members
    where community_id = p_community_id
      and profile_id = auth.uid()
      and status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_community_member(p_community_id uuid, p_enforce_billing boolean)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.community_members
    where community_id = p_community_id
      and profile_id = auth.uid()
      and status = 'active'
  )
  and (
    not p_enforce_billing or public.has_active_access(auth.uid(), p_community_id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.community_owner_of_profile(p_profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.community_members cm
    join public.communities c on c.id = cm.community_id
    where cm.profile_id = p_profile_id and c.owner_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.shares_active_community(p_profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.community_members cm1
    join public.community_members cm2 on cm2.community_id = cm1.community_id
    where cm1.profile_id = auth.uid()
      and cm2.profile_id = p_profile_id
      and cm1.status = 'active'
      and cm2.status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.professional_platform_active(p_professional_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (
      select status <> 'blocked'
      from public.subscriptions
      where subject = 'platform' and profile_id = p_professional_id
      order by created_at desc
      limit 1
    ),
    true
  );
$function$;

CREATE OR REPLACE FUNCTION public.community_subscription_active(p_member_id uuid, p_community_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (
      select status <> 'blocked'
      from public.subscriptions
      where subject = 'community' and profile_id = p_member_id and community_id = p_community_id
      order by created_at desc
      limit 1
    ),
    true
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_active_access(p_profile_id uuid, p_community_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.is_master()
    or (
      public.professional_platform_active(
        (select owner_id from public.communities where id = p_community_id)
      )
      and (
        (select owner_id from public.communities where id = p_community_id) = p_profile_id
        or public.community_subscription_active(p_profile_id, p_community_id)
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.can_view_post(p_post_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and (
        is_master()
        or owns_community(p.community_id)
        or is_community_member(p.community_id)
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_participate_in_post(p_post_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and (owns_community(p.community_id) or is_community_member(p.community_id))
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_view_challenge(p_challenge_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.community_challenges c
    where c.id = p_challenge_id
      and (is_master() or owns_community(c.community_id) or is_community_member(c.community_id))
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_participate_in_challenge(p_challenge_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.community_challenges c
    where c.id = p_challenge_id
      and (owns_community(c.community_id) or is_community_member(c.community_id))
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_view_circle(p_circle_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.community_circles cc
    where cc.id = p_circle_id
      and (
        public.is_master()
        or public.owns_community(cc.community_id)
        or public.is_community_member(cc.community_id)
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.challenge_current_day(p_challenge_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select least(
    coalesce(
      (select max(day_number) from public.challenge_activities where challenge_id = p_challenge_id),
      1
    ),
    greatest(
      1,
      (extract(epoch from (now() - (select created_at from public.community_challenges where id = p_challenge_id))) / 86400)::int + 1
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.challenge_participant_count(p_challenge_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int
  from public.challenge_participants
  where challenge_id = p_challenge_id;
$function$;

CREATE OR REPLACE FUNCTION public.challenge_today_completed_count(p_challenge_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(distinct profile_id)::int
  from public.challenge_progress
  where challenge_id = p_challenge_id
    and day_number = public.challenge_current_day(p_challenge_id);
$function$;

CREATE OR REPLACE FUNCTION public.circle_member_count(p_circle_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::integer
  from public.circle_members cm
  where cm.circle_id = p_circle_id;
$function$;

CREATE OR REPLACE FUNCTION public.community_member_count(p_community_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::integer
  from public.community_members
  where community_id = p_community_id
    and status = 'active';
$function$;

CREATE OR REPLACE FUNCTION public.find_member_by_email(p_community_id uuid, p_email text)
 RETURNS TABLE(id uuid, full_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not (
    public.is_master()
    or exists (
      select 1
      from public.communities c
      where c.id = p_community_id
        and c.owner_id = auth.uid()
    )
  ) then
    raise exception 'not authorized';
  end if;

  return query
    select p.id, p.full_name
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = lower(p_email)
      and p.role = 'member'
    limit 1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.publish_daily_question(p_community_id uuid)
 RETURNS posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_question public.community_questions;
  v_post public.posts;
begin
  if not owns_community(p_community_id) then
    raise exception 'not authorized';
  end if;

  select *
  into v_question
  from public.community_questions
  where community_id = p_community_id
    and is_active = true
  order by random()
  limit 1;

  if v_question.id is null then
    raise exception 'no active question available';
  end if;

  insert into public.posts (
    community_id,
    author_id,
    content,
    post_type,
    question_id
  )
  values (
    p_community_id,
    auth.uid(),
    v_question.content,
    'daily_question',
    v_question.id
  )
  returning *
  into v_post;

  return v_post;
end;
$function$;

CREATE OR REPLACE FUNCTION public.publish_checkin(p_community_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_checkin record;
  v_instance_id uuid;
begin
  if not public.owns_community(p_community_id) then
    raise exception 'not authorized';
  end if;

  select id, content
  into v_checkin
  from public.community_checkins
  where community_id = p_community_id
    and is_active = true
  order by random()
  limit 1;

  if v_checkin.id is null then
    raise exception 'no active checkin available';
  end if;

  insert into public.checkin_instances (community_id, checkin_id, content, published_by)
  values (p_community_id, v_checkin.id, v_checkin.content, auth.uid())
  returning id into v_instance_id;

  return v_instance_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.publish_engagement_command(p_community_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_command record;
  v_post_id uuid;
begin
  if not (public.is_professional() and public.owns_community(p_community_id)) then
    raise exception 'not_authorized';
  end if;

  select id, title, content
    into v_command
  from public.community_engagement_commands
  where community_id = p_community_id
    and is_active = true
  order by random()
  limit 1;

  if v_command.id is null then
    raise exception 'no_active_command';
  end if;

  insert into public.posts (community_id, author_id, content, post_type, title, engagement_command_id)
  values (p_community_id, auth.uid(), v_command.content, 'engagement_command', v_command.title, v_command.id)
  returning id into v_post_id;

  return v_post_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.community_metrics(p_community_id uuid, p_period_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total_members integer;
  v_active_members integer;
  v_inactive_members integer;
  v_new_members integer;
  v_posts_count integer;
  v_comments_count integer;
  v_reactions_count integer;
  v_challenge_progress_count integer;
  v_checkin_responses_count integer;
  v_circle_joins_count integer;
  v_period_start timestamptz;
  v_activity_window timestamptz := now() - interval '30 days';
begin
  if not (public.is_master() or public.owns_community(p_community_id)) then
    raise exception 'not_authorized';
  end if;

  v_period_start := now() - (p_period_days || ' days')::interval;

  select count(*) into v_total_members
  from public.community_members
  where community_id = p_community_id and status = 'active';

  select count(*) into v_new_members
  from public.community_members
  where community_id = p_community_id and status = 'active' and joined_at >= v_period_start;

  select count(*) into v_active_members
  from public.community_members cm
  where cm.community_id = p_community_id and cm.status = 'active'
    and (
      exists (
        select 1 from public.posts p
        where p.community_id = p_community_id and p.author_id = cm.profile_id
          and p.created_at >= v_activity_window
      )
      or exists (
        select 1 from public.post_comments pc
        join public.posts p on p.id = pc.post_id
        where p.community_id = p_community_id and pc.author_id = cm.profile_id
          and pc.created_at >= v_activity_window
      )
      or exists (
        select 1 from public.post_reactions pr
        join public.posts p on p.id = pr.post_id
        where p.community_id = p_community_id and pr.profile_id = cm.profile_id
          and pr.created_at >= v_activity_window
      )
      or exists (
        select 1 from public.checkin_responses cr
        join public.checkin_instances ci on ci.id = cr.checkin_instance_id
        where ci.community_id = p_community_id and cr.profile_id = cm.profile_id
          and cr.created_at >= v_activity_window
      )
      or exists (
        select 1 from public.challenge_progress chp
        join public.community_challenges cc on cc.id = chp.challenge_id
        where cc.community_id = p_community_id and chp.profile_id = cm.profile_id
          and chp.completed_at >= v_activity_window
      )
      or exists (
        select 1 from public.circle_members clm
        join public.community_circles ccl on ccl.id = clm.circle_id
        where ccl.community_id = p_community_id and clm.profile_id = cm.profile_id
          and clm.joined_at >= v_activity_window
      )
    );

  v_inactive_members := v_total_members - v_active_members;

  select count(*) into v_posts_count
  from public.posts
  where community_id = p_community_id and created_at >= v_period_start;

  select count(*) into v_comments_count
  from public.post_comments pc
  join public.posts p on p.id = pc.post_id
  where p.community_id = p_community_id and pc.created_at >= v_period_start;

  select count(*) into v_reactions_count
  from public.post_reactions pr
  join public.posts p on p.id = pr.post_id
  where p.community_id = p_community_id and pr.created_at >= v_period_start;

  select count(*) into v_challenge_progress_count
  from public.challenge_progress chp
  join public.community_challenges cc on cc.id = chp.challenge_id
  where cc.community_id = p_community_id and chp.completed_at >= v_period_start;

  select count(*) into v_checkin_responses_count
  from public.checkin_responses cr
  join public.checkin_instances ci on ci.id = cr.checkin_instance_id
  where ci.community_id = p_community_id and cr.created_at >= v_period_start;

  select count(*) into v_circle_joins_count
  from public.circle_members clm
  join public.community_circles ccl on ccl.id = clm.circle_id
  where ccl.community_id = p_community_id and clm.joined_at >= v_period_start;

  return jsonb_build_object(
    'total_members', v_total_members,
    'active_members', v_active_members,
    'inactive_members', v_inactive_members,
    'new_members', v_new_members,
    'posts_count', v_posts_count,
    'comments_count', v_comments_count,
    'reactions_count', v_reactions_count,
    'challenge_progress_count', v_challenge_progress_count,
    'checkin_responses_count', v_checkin_responses_count,
    'circle_joins_count', v_circle_joins_count
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_subscription_state(p_subscription_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sub record;
  v_now timestamptz := now();
  v_days_to_trial_end numeric;
  v_days_to_period_end numeric;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id;

  if not found then
    return null;
  end if;

  if v_sub.status = 'trial' then
    v_days_to_trial_end := extract(epoch from (v_sub.trial_ends_at - v_now)) / 86400.0;
    if v_days_to_trial_end <= 0 then
      return 'trial_expired';
    elsif v_days_to_trial_end <= 3 then
      return 'trial_ending';
    else
      return 'trial';
    end if;
  end if;

  if v_sub.status = 'active' then
    v_days_to_period_end := extract(epoch from (v_sub.current_period_end - v_now)) / 86400.0;
    if v_days_to_period_end <= 3 and v_days_to_period_end > 0 then
      return 'renewing_soon';
    else
      return 'active';
    end if;
  end if;

  return v_sub.status::text;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_platform_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.role = 'professional' and (old.role is distinct from 'professional') then
    if not exists (
      select 1 from public.subscriptions
      where subject = 'platform' and profile_id = new.id and status <> 'canceled'
    ) then
      insert into public.subscriptions (
        subject, profile_id, plan_id, status,
        trial_ends_at, current_period_start, current_period_end
      )
      values (
        'platform', new.id,
        (select id from public.billing_plans where code = 'professional_monthly'),
        'trial', now() + interval '21 days', now(), now() + interval '21 days'
      );
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_community_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from public.subscriptions
    where subject = 'community' and profile_id = new.profile_id
      and community_id = new.community_id and status <> 'canceled'
  ) then
    insert into public.subscriptions (
      subject, profile_id, community_id, plan_id, status,
      trial_ends_at, current_period_start, current_period_end
    )
    values (
      'community', new.profile_id, new.community_id,
      (select id from public.billing_plans where code = 'member_monthly'),
      'trial', now() + interval '21 days', now(), now() + interval '21 days'
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_subscription_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status is distinct from old.status then
    insert into public.subscription_status_history (subscription_id, old_status, new_status)
    values (new.id, old.status, new.status);
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

-- =====================================================================
-- 6. TRIGGERS  (create or replace trigger — PG17)
-- =====================================================================
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

create or replace trigger profiles_create_platform_trial
  after update of role on public.profiles
  for each row execute function public.create_platform_trial();

create or replace trigger set_communities_updated_at
  before update on public.communities
  for each row execute function public.set_updated_at();

create or replace trigger community_members_create_community_trial
  after insert on public.community_members
  for each row execute function public.create_community_trial();

create or replace trigger set_posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create or replace trigger set_billing_plans_updated_at
  before update on public.billing_plans
  for each row execute function public.set_updated_at();

create or replace trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create or replace trigger subscriptions_log_status_change
  after update of status on public.subscriptions
  for each row execute function public.log_subscription_status_change();

create or replace trigger set_payment_charges_updated_at
  before update on public.payment_charges
  for each row execute function public.set_updated_at();

create or replace trigger set_billing_customer_data_updated_at
  before update on public.billing_customer_data
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 7. EVENT TRIGGER  (habilita RLS automaticamente em tabelas novas de public)
-- =====================================================================
drop event trigger if exists ensure_rls;
create event trigger ensure_rls on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();

-- =====================================================================
-- 8. ROW LEVEL SECURITY  (habilitado em todas as 29 tabelas)
-- =====================================================================
alter table public.profiles                       enable row level security;
alter table public.communities                    enable row level security;
alter table public.community_members              enable row level security;
alter table public.community_questions            enable row level security;
alter table public.community_challenges           enable row level security;
alter table public.challenge_activities           enable row level security;
alter table public.challenge_participants         enable row level security;
alter table public.challenge_progress             enable row level security;
alter table public.challenge_comments             enable row level security;
alter table public.community_circles              enable row level security;
alter table public.circle_members                 enable row level security;
alter table public.community_checkins             enable row level security;
alter table public.checkin_instances              enable row level security;
alter table public.checkin_responses              enable row level security;
alter table public.community_engagement_commands  enable row level security;
alter table public.engagement_command_instances   enable row level security;
alter table public.posts                          enable row level security;
alter table public.post_comments                  enable row level security;
alter table public.post_reactions                 enable row level security;
alter table public.billing_plans                  enable row level security;
alter table public.subscriptions                  enable row level security;
alter table public.payment_charges                enable row level security;
alter table public.webhook_events                 enable row level security;
alter table public.billing_notifications_log      enable row level security;
alter table public.notifications                  enable row level security;
alter table public.subscription_status_history    enable row level security;
alter table public.billing_customer_data          enable row level security;
alter table public.platform_split_settings        enable row level security;
alter table public.revenue_split_rules            enable row level security;

-- =====================================================================
-- 9. POLICIES  (drop-if-exists + create — texto fiel ao catálogo remoto)
--    Papéis preservados exatamente ({public} vs {authenticated}).
-- =====================================================================

-- profiles ----------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to public
  using ((id = auth.uid()) or is_master() or community_owner_of_profile(id) or shares_active_community(id));
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update to public
  using ((id = auth.uid()) or is_master())
  with check ((id = auth.uid()) or is_master());

-- communities -----------------------------------------------------
drop policy if exists "communities_select" on public.communities;
create policy "communities_select" on public.communities for select to public
  using (is_master() or (owner_id = auth.uid()) or is_community_member(id) or (is_discoverable = true));
drop policy if exists "communities_insert" on public.communities;
create policy "communities_insert" on public.communities for insert to public
  with check ((owner_id = auth.uid()) and is_professional());
drop policy if exists "communities_update" on public.communities;
create policy "communities_update" on public.communities for update to public
  using (is_master() or (owner_id = auth.uid()))
  with check (is_master() or (owner_id = auth.uid()));
drop policy if exists "communities_delete" on public.communities;
create policy "communities_delete" on public.communities for delete to public
  using (is_master());

-- community_members --------------------------------------------
drop policy if exists "community_members_select" on public.community_members;
create policy "community_members_select" on public.community_members for select to public
  using (is_master() or (profile_id = auth.uid()) or owns_community(community_id));
drop policy if exists "community_members_insert" on public.community_members;
create policy "community_members_insert" on public.community_members for insert to public
  with check (
    is_master() or owns_community(community_id)
    or ((profile_id = auth.uid()) and (exists (
      select 1 from communities c
      where ((c.id = community_members.community_id) and (c.is_discoverable = true))
    )))
  );
drop policy if exists "community_members_update" on public.community_members;
create policy "community_members_update" on public.community_members for update to public
  using (is_master() or owns_community(community_id))
  with check (is_master() or owns_community(community_id));
drop policy if exists "community_members_delete" on public.community_members;
create policy "community_members_delete" on public.community_members for delete to public
  using (is_master() or owns_community(community_id));

-- community_questions -----------------------------------------
drop policy if exists "community_questions_select" on public.community_questions;
create policy "community_questions_select" on public.community_questions for select to public
  using (is_master() or owns_community(community_id));
drop policy if exists "community_questions_insert" on public.community_questions;
create policy "community_questions_insert" on public.community_questions for insert to public
  with check (owns_community(community_id) and (created_by = auth.uid()));
drop policy if exists "community_questions_update" on public.community_questions;
create policy "community_questions_update" on public.community_questions for update to public
  using (owns_community(community_id))
  with check (owns_community(community_id));
drop policy if exists "community_questions_delete" on public.community_questions;
create policy "community_questions_delete" on public.community_questions for delete to public
  using (owns_community(community_id));

-- community_challenges ---------------------------------------
drop policy if exists "community_challenges_select" on public.community_challenges;
create policy "community_challenges_select" on public.community_challenges for select to public
  using (is_master() or owns_community(community_id) or is_community_member(community_id));
drop policy if exists "community_challenges_insert" on public.community_challenges;
create policy "community_challenges_insert" on public.community_challenges for insert to public
  with check (owns_community(community_id) and (created_by = auth.uid()));
drop policy if exists "community_challenges_update" on public.community_challenges;
create policy "community_challenges_update" on public.community_challenges for update to public
  using (owns_community(community_id));
drop policy if exists "community_challenges_delete" on public.community_challenges;
create policy "community_challenges_delete" on public.community_challenges for delete to public
  using (owns_community(community_id));

-- challenge_activities -------------------------------------
drop policy if exists "challenge_activities_select" on public.challenge_activities;
create policy "challenge_activities_select" on public.challenge_activities for select to public
  using (can_view_challenge(challenge_id));
drop policy if exists "challenge_activities_insert" on public.challenge_activities;
create policy "challenge_activities_insert" on public.challenge_activities for insert to public
  with check (exists (
    select 1 from community_challenges c
    where ((c.id = challenge_activities.challenge_id) and owns_community(c.community_id))
  ));
drop policy if exists "challenge_activities_update" on public.challenge_activities;
create policy "challenge_activities_update" on public.challenge_activities for update to public
  using (exists (
    select 1 from community_challenges c
    where ((c.id = challenge_activities.challenge_id) and owns_community(c.community_id))
  ));
drop policy if exists "challenge_activities_delete" on public.challenge_activities;
create policy "challenge_activities_delete" on public.challenge_activities for delete to public
  using (exists (
    select 1 from community_challenges c
    where ((c.id = challenge_activities.challenge_id) and owns_community(c.community_id))
  ));

-- challenge_participants ----------------------------------
drop policy if exists "challenge_participants_select" on public.challenge_participants;
create policy "challenge_participants_select" on public.challenge_participants for select to public
  using (can_view_challenge(challenge_id));
drop policy if exists "challenge_participants_insert" on public.challenge_participants;
create policy "challenge_participants_insert" on public.challenge_participants for insert to public
  with check ((profile_id = auth.uid()) and can_participate_in_challenge(challenge_id));
drop policy if exists "challenge_participants_delete" on public.challenge_participants;
create policy "challenge_participants_delete" on public.challenge_participants for delete to public
  using (profile_id = auth.uid());

-- challenge_progress -------------------------------------
drop policy if exists "challenge_progress_select" on public.challenge_progress;
create policy "challenge_progress_select" on public.challenge_progress for select to public
  using (
    (profile_id = auth.uid())
    or (exists (
      select 1 from community_challenges c
      where ((c.id = challenge_progress.challenge_id) and (owns_community(c.community_id) or is_master()))
    ))
  );
drop policy if exists "challenge_progress_insert" on public.challenge_progress;
create policy "challenge_progress_insert" on public.challenge_progress for insert to public
  with check (
    (profile_id = auth.uid())
    and can_participate_in_challenge(challenge_id)
    and (day_number <= challenge_current_day(challenge_id))
  );
drop policy if exists "challenge_progress_delete" on public.challenge_progress;
create policy "challenge_progress_delete" on public.challenge_progress for delete to public
  using (profile_id = auth.uid());

-- challenge_comments  (roles = authenticated) ------------
drop policy if exists "challenge_comments_select" on public.challenge_comments;
create policy "challenge_comments_select" on public.challenge_comments for select to authenticated
  using (can_view_challenge(challenge_id));
drop policy if exists "challenge_comments_insert" on public.challenge_comments;
create policy "challenge_comments_insert" on public.challenge_comments for insert to authenticated
  with check ((author_id = auth.uid()) and can_participate_in_challenge(challenge_id));

-- community_circles  (roles = authenticated) -------------
drop policy if exists "community_circles_select" on public.community_circles;
create policy "community_circles_select" on public.community_circles for select to authenticated
  using (is_master() or owns_community(community_id) or is_community_member(community_id));
drop policy if exists "community_circles_insert" on public.community_circles;
create policy "community_circles_insert" on public.community_circles for insert to authenticated
  with check (owns_community(community_id));
drop policy if exists "community_circles_update" on public.community_circles;
create policy "community_circles_update" on public.community_circles for update to authenticated
  using (owns_community(community_id))
  with check (owns_community(community_id));
drop policy if exists "community_circles_delete" on public.community_circles;
create policy "community_circles_delete" on public.community_circles for delete to authenticated
  using (owns_community(community_id));

-- circle_members  (roles = authenticated) ---------------
drop policy if exists "circle_members_select" on public.circle_members;
create policy "circle_members_select" on public.circle_members for select to authenticated
  using (can_view_circle(circle_id));
drop policy if exists "circle_members_insert" on public.circle_members;
create policy "circle_members_insert" on public.circle_members for insert to authenticated
  with check ((profile_id = auth.uid()) and (exists (
    select 1 from community_circles cc
    where ((cc.id = circle_members.circle_id) and is_community_member(cc.community_id))
  )));
drop policy if exists "circle_members_delete" on public.circle_members;
create policy "circle_members_delete" on public.circle_members for delete to authenticated
  using (profile_id = auth.uid());

-- community_checkins  (roles = authenticated) -----------
drop policy if exists "community_checkins_select" on public.community_checkins;
create policy "community_checkins_select" on public.community_checkins for select to authenticated
  using (owns_community(community_id) or is_master());
drop policy if exists "community_checkins_insert" on public.community_checkins;
create policy "community_checkins_insert" on public.community_checkins for insert to authenticated
  with check (owns_community(community_id));
drop policy if exists "community_checkins_update" on public.community_checkins;
create policy "community_checkins_update" on public.community_checkins for update to authenticated
  using (owns_community(community_id))
  with check (owns_community(community_id));
drop policy if exists "community_checkins_delete" on public.community_checkins;
create policy "community_checkins_delete" on public.community_checkins for delete to authenticated
  using (owns_community(community_id));

-- checkin_instances  (roles = authenticated) ------------
drop policy if exists "checkin_instances_select" on public.checkin_instances;
create policy "checkin_instances_select" on public.checkin_instances for select to authenticated
  using (is_community_member(community_id) or owns_community(community_id) or is_master());
drop policy if exists "checkin_instances_insert" on public.checkin_instances;
create policy "checkin_instances_insert" on public.checkin_instances for insert to authenticated
  with check (owns_community(community_id));

-- checkin_responses  (roles = authenticated) ------------
drop policy if exists "checkin_responses_select" on public.checkin_responses;
create policy "checkin_responses_select" on public.checkin_responses for select to authenticated
  using (
    (profile_id = auth.uid())
    or (exists (
      select 1 from checkin_instances ci
      where ((ci.id = checkin_responses.checkin_instance_id) and owns_community(ci.community_id))
    ))
  );
drop policy if exists "checkin_responses_insert" on public.checkin_responses;
create policy "checkin_responses_insert" on public.checkin_responses for insert to authenticated
  with check (
    (profile_id = auth.uid())
    and (exists (
      select 1 from checkin_instances ci
      where ((ci.id = checkin_responses.checkin_instance_id) and is_community_member(ci.community_id))
    ))
  );

-- community_engagement_commands -------------------------
drop policy if exists "community_engagement_commands_select" on public.community_engagement_commands;
create policy "community_engagement_commands_select" on public.community_engagement_commands for select to public
  using (is_master() or owns_community(community_id) or is_community_member(community_id));
drop policy if exists "community_engagement_commands_insert" on public.community_engagement_commands;
create policy "community_engagement_commands_insert" on public.community_engagement_commands for insert to public
  with check (owns_community(community_id) and (created_by = auth.uid()));
drop policy if exists "community_engagement_commands_update" on public.community_engagement_commands;
create policy "community_engagement_commands_update" on public.community_engagement_commands for update to public
  using (owns_community(community_id))
  with check (owns_community(community_id));
drop policy if exists "community_engagement_commands_delete" on public.community_engagement_commands;
create policy "community_engagement_commands_delete" on public.community_engagement_commands for delete to public
  using (owns_community(community_id));

-- engagement_command_instances  (ÓRFÃ — só SELECT, preservada) --
drop policy if exists "engagement_command_instances_select" on public.engagement_command_instances;
create policy "engagement_command_instances_select" on public.engagement_command_instances for select to public
  using (is_master() or owns_community(community_id) or is_community_member(community_id));

-- posts -----------------------------------------------
drop policy if exists "posts_select" on public.posts;
create policy "posts_select" on public.posts for select to public
  using (is_master() or owns_community(community_id) or is_community_member(community_id));
drop policy if exists "posts_insert" on public.posts;
create policy "posts_insert" on public.posts for insert to public
  with check ((author_id = auth.uid()) and (owns_community(community_id) or is_community_member(community_id)));

-- post_comments --------------------------------------
drop policy if exists "post_comments_select" on public.post_comments;
create policy "post_comments_select" on public.post_comments for select to public
  using (can_view_post(post_id));
drop policy if exists "post_comments_insert" on public.post_comments;
create policy "post_comments_insert" on public.post_comments for insert to public
  with check ((author_id = auth.uid()) and can_participate_in_post(post_id));

-- post_reactions ------------------------------------
drop policy if exists "post_reactions_select" on public.post_reactions;
create policy "post_reactions_select" on public.post_reactions for select to public
  using (can_view_post(post_id));
drop policy if exists "post_reactions_insert" on public.post_reactions;
create policy "post_reactions_insert" on public.post_reactions for insert to public
  with check ((profile_id = auth.uid()) and can_participate_in_post(post_id));
drop policy if exists "post_reactions_delete" on public.post_reactions;
create policy "post_reactions_delete" on public.post_reactions for delete to public
  using (profile_id = auth.uid());

-- billing_plans -------------------------------------
drop policy if exists "billing_plans_select" on public.billing_plans;
create policy "billing_plans_select" on public.billing_plans for select to public
  using (true);
drop policy if exists "billing_plans_write" on public.billing_plans;
create policy "billing_plans_write" on public.billing_plans for all to public
  using (is_master())
  with check (is_master());

-- subscriptions ------------------------------------
drop policy if exists "subscriptions_select" on public.subscriptions;
create policy "subscriptions_select" on public.subscriptions for select to public
  using (
    (profile_id = auth.uid())
    or is_master()
    or ((subject = 'community'::subscription_subject) and owns_community(community_id, false))
  );
drop policy if exists "subscriptions_update_master" on public.subscriptions;
create policy "subscriptions_update_master" on public.subscriptions for update to public
  using (is_master())
  with check (is_master());

-- payment_charges ---------------------------------
drop policy if exists "payment_charges_select" on public.payment_charges;
create policy "payment_charges_select" on public.payment_charges for select to public
  using (
    is_master()
    or (exists (
      select 1 from subscriptions s
      where ((s.id = payment_charges.subscription_id)
        and ((s.profile_id = auth.uid())
          or ((s.subject = 'community'::subscription_subject) and owns_community(s.community_id, false))))
    ))
  );

-- billing_notifications_log ----------------------
drop policy if exists "billing_notifications_log_select" on public.billing_notifications_log;
create policy "billing_notifications_log_select" on public.billing_notifications_log for select to public
  using (is_master());

-- notifications ---------------------------------
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications for select to public
  using ((profile_id = auth.uid()) or is_master());
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update to public
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- subscription_status_history -------------------
drop policy if exists "subscription_status_history_select" on public.subscription_status_history;
create policy "subscription_status_history_select" on public.subscription_status_history for select to public
  using (
    is_master()
    or (exists (
      select 1 from subscriptions s
      where ((s.id = subscription_status_history.subscription_id)
        and ((s.profile_id = auth.uid())
          or ((s.subject = 'community'::subscription_subject) and owns_community(s.community_id, false))))
    ))
  );

-- billing_customer_data ------------------------
drop policy if exists "billing_customer_data_select" on public.billing_customer_data;
create policy "billing_customer_data_select" on public.billing_customer_data for select to public
  using ((profile_id = auth.uid()) or is_master());
drop policy if exists "billing_customer_data_insert" on public.billing_customer_data;
create policy "billing_customer_data_insert" on public.billing_customer_data for insert to public
  with check (profile_id = auth.uid());
drop policy if exists "billing_customer_data_update" on public.billing_customer_data;
create policy "billing_customer_data_update" on public.billing_customer_data for update to public
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- platform_split_settings  (ÓRFÃ — preservada) --
drop policy if exists "platform_split_settings_select" on public.platform_split_settings;
create policy "platform_split_settings_select" on public.platform_split_settings for select to public
  using (is_master() or is_professional());
drop policy if exists "platform_split_settings_insert" on public.platform_split_settings;
create policy "platform_split_settings_insert" on public.platform_split_settings for insert to public
  with check (is_master());

-- revenue_split_rules  (ÓRFÃ — preservada) ------
drop policy if exists "revenue_split_rules_select" on public.revenue_split_rules;
create policy "revenue_split_rules_select" on public.revenue_split_rules for select to public
  using (is_master() or is_professional());
drop policy if exists "revenue_split_rules_insert" on public.revenue_split_rules;
create policy "revenue_split_rules_insert" on public.revenue_split_rules for insert to public
  with check (is_master());

-- =====================================================================
-- 10. GRANTs
--     Base: o alvo é um projeto Supabase, onde os defaults de plataforma
--     (ALTER DEFAULT PRIVILEGES: anon/authenticated/service_role recebem
--     Dxtm=TRUNCATE/REFERENCES/TRIGGER/MAINTAIN em tabelas novas; funções
--     novas só executáveis por postgres) já existem. Abaixo estão apenas
--     os GRANTs DML/EXECUTE explícitos que o projeto adicionou, fiéis ao
--     relacl/proacl observado no remoto.
-- =====================================================================

-- ---- tabelas: DML explícito -----------------------------------
grant insert, select, update           on table public.billing_customer_data        to authenticated;
grant select                           on table public.billing_customer_data        to service_role;
grant select                           on table public.billing_notifications_log    to authenticated;
grant insert                           on table public.billing_notifications_log    to service_role;
grant insert, select, update, delete   on table public.billing_plans                to authenticated;
grant select                           on table public.billing_plans                to service_role;
grant insert, select, update, delete   on table public.challenge_activities         to authenticated;
grant insert, select                   on table public.challenge_comments           to authenticated;
grant insert, select, delete           on table public.challenge_participants       to authenticated;
grant insert, select, delete           on table public.challenge_progress           to authenticated;
grant insert, select                   on table public.checkin_instances            to authenticated;
grant insert, select                   on table public.checkin_responses            to authenticated;
grant insert, select, delete           on table public.circle_members               to authenticated;
grant insert, select                   on table public.communities                  to authenticated;
grant insert, select, update, delete   on table public.community_challenges         to authenticated;
grant insert, select, update, delete   on table public.community_checkins           to authenticated;
grant insert, select, update, delete   on table public.community_circles            to authenticated;
grant insert, select, update, delete   on table public.community_engagement_commands to authenticated;
grant insert, select                   on table public.community_members            to authenticated;
grant insert, select, update, delete   on table public.community_questions          to authenticated;
grant select                           on table public.engagement_command_instances to authenticated;
grant select, update                   on table public.notifications                to authenticated;
grant insert                           on table public.notifications                to service_role;
grant select                           on table public.payment_charges              to authenticated;
grant insert, select, update           on table public.payment_charges              to service_role;
grant insert, select                   on table public.platform_split_settings      to authenticated;
grant insert, select                   on table public.post_comments                to authenticated;
grant insert, select, delete           on table public.post_reactions               to authenticated;
grant insert, select                   on table public.posts                        to authenticated;
grant select, update                   on table public.profiles                     to authenticated;
grant select                           on table public.profiles                     to service_role;
grant insert, select                   on table public.revenue_split_rules          to authenticated;
grant select                           on table public.subscription_status_history  to authenticated;
grant select, update                   on table public.subscriptions                to authenticated;
grant select, update                   on table public.subscriptions                to service_role;
grant insert, update                   on table public.webhook_events               to service_role;

-- ---- funções: EXECUTE ---------------------------------------
-- (23) anon + authenticated + service_role
grant execute on function public.calculate_subscription_state(uuid)             to anon, authenticated, service_role;
grant execute on function public.can_view_circle(uuid)                          to anon, authenticated, service_role;
grant execute on function public.circle_member_count(uuid)                      to anon, authenticated, service_role;
grant execute on function public.community_metrics(uuid, integer)               to anon, authenticated, service_role;
grant execute on function public.community_owner_of_profile(uuid)               to anon, authenticated, service_role;
grant execute on function public.community_subscription_active(uuid, uuid)      to anon, authenticated, service_role;
grant execute on function public.create_community_trial()                       to anon, authenticated, service_role;
grant execute on function public.create_platform_trial()                        to anon, authenticated, service_role;
grant execute on function public.handle_new_user()                             to anon, authenticated, service_role;
grant execute on function public.has_active_access(uuid, uuid)                  to anon, authenticated, service_role;
grant execute on function public.is_community_member(uuid)                      to anon, authenticated, service_role;
grant execute on function public.is_community_member(uuid, boolean)             to anon, authenticated, service_role;
grant execute on function public.is_master()                                   to anon, authenticated, service_role;
grant execute on function public.is_professional()                             to anon, authenticated, service_role;
grant execute on function public.log_subscription_status_change()              to anon, authenticated, service_role;
grant execute on function public.owns_community(uuid)                          to anon, authenticated, service_role;
grant execute on function public.owns_community(uuid, boolean)                 to anon, authenticated, service_role;
grant execute on function public.prevent_role_escalation()                     to anon, authenticated, service_role;
grant execute on function public.professional_platform_active(uuid)            to anon, authenticated, service_role;
grant execute on function public.publish_checkin(uuid)                         to anon, authenticated, service_role;
grant execute on function public.publish_engagement_command(uuid)              to anon, authenticated, service_role;
grant execute on function public.rls_auto_enable()                             to anon, authenticated, service_role;
grant execute on function public.set_updated_at()                              to anon, authenticated, service_role;
grant execute on function public.shares_active_community(uuid)                 to anon, authenticated, service_role;
-- (10) somente authenticated
grant execute on function public.can_participate_in_challenge(uuid)            to authenticated;
grant execute on function public.can_participate_in_post(uuid)                 to authenticated;
grant execute on function public.can_view_challenge(uuid)                      to authenticated;
grant execute on function public.can_view_post(uuid)                           to authenticated;
grant execute on function public.challenge_current_day(uuid)                   to authenticated;
grant execute on function public.challenge_participant_count(uuid)             to authenticated;
grant execute on function public.challenge_today_completed_count(uuid)         to authenticated;
grant execute on function public.community_member_count(uuid)                  to authenticated;
grant execute on function public.find_member_by_email(uuid, text)              to authenticated;
grant execute on function public.publish_daily_question(uuid)                  to authenticated;

-- =====================================================================
-- 11. VIEWS / MATERIALIZED VIEWS
-- =====================================================================
-- Nenhuma. O schema remoto não possui views nem materialized views em public.

-- =====================================================================
-- FIM DO BASELINE
-- =====================================================================
