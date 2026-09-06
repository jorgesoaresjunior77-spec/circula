-- =====================================================================
-- FASE 16.1-P — Preço da assinatura POR COMUNIDADE (Regra de Produto 2)
-- =====================================================================
-- Cada Professional define quanto o Member paga na SUA comunidade.
-- R$ 14,90 (1490 centavos) é o PISO, não um preço fixo/global.
--
-- Fonte única do preço/ciclo: nova tabela `community_billing_settings`
-- (1 linha por comunidade). O piso é um CHECK constraint — inviolável
-- por qualquer cliente, RPC ou SQL direto. A escrita passa SÓ pela RPC
-- `set_community_price` (SECURITY DEFINER + guard `owns_community`), no
-- padrão do projeto (`award_points_manual`, `moderate_post`).
--
-- NÃO TOCA (verificado): billing_plans, subscriptions, payment_charges,
-- create_community_trial(), resolve_split(), asaas-*, Split, e NENHUMA
-- policy/grant/RLS existente. O snapshot de preço por-assinatura é da
-- Fase 16.2 (documentado, não criado aqui).
--
-- Idempotente (create ... if not exists / or replace / drop if exists /
-- on conflict do nothing). Transacional. Reversível (rodapé).
-- =====================================================================

begin;

-- ---- 1. tabela -----------------------------------------------------
create table if not exists public.community_billing_settings (
  community_id   uuid not null,
  price_cents    integer not null,
  billing_cycle  text not null default 'MONTHLY',
  currency       text not null default 'BRL',
  updated_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint community_billing_settings_pkey primary key (community_id),
  constraint community_billing_settings_community_id_fkey
    foreign key (community_id) references public.communities (id) on delete cascade,
  constraint community_billing_settings_updated_by_fkey
    foreign key (updated_by) references public.profiles (id) on delete set null,
  -- PISO R$ 14,90 — enforcement real do mínimo
  constraint community_billing_settings_price_min check (price_cents >= 1490),
  constraint community_billing_settings_billing_cycle_check
    check (billing_cycle = any (array['MONTHLY'::text,'SEMIANNUALLY'::text,'YEARLY'::text])),
  constraint community_billing_settings_currency_check check (currency = 'BRL'::text)
);

create or replace trigger set_community_billing_settings_updated_at
  before update on public.community_billing_settings
  for each row execute function public.set_updated_at();

-- ---- 2. RLS (só 1 policy nova, tabela nova) ----------------------
alter table public.community_billing_settings enable row level security;

drop policy if exists "community_billing_settings_select" on public.community_billing_settings;
create policy "community_billing_settings_select"
  on public.community_billing_settings for select to public
  using (true);
-- Sem policy de INSERT/UPDATE/DELETE: escrita só via RPC (DEFINER) e
-- service_role (Edge Functions da Fase 16.2).

-- ---- 3. grants (só a tabela nova) -------------------------------
grant select                 on table public.community_billing_settings to authenticated;
grant select, insert, update on table public.community_billing_settings to service_role;
-- Nada para anon. Nenhum DELETE para ninguém. Master não ganha escrita.

-- ---- 4. RPC: única via de escrita para a dona da comunidade -----
create or replace function public.set_community_price(
  p_community_id uuid,
  p_price_cents integer,
  p_billing_cycle text default 'MONTHLY'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- só a Professional dona desta comunidade
  if not public.owns_community(p_community_id) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  -- piso R$ 14,90 no SERVIDOR (não confia no frontend)
  if p_price_cents is null or p_price_cents < 1490 then
    raise exception 'O preço mínimo da assinatura é R$ 14,90.'
      using errcode = 'check_violation';
  end if;

  if p_billing_cycle is null
     or p_billing_cycle <> all (array['MONTHLY','SEMIANNUALLY','YEARLY']) then
    raise exception 'Ciclo de cobrança inválido.' using errcode = 'check_violation';
  end if;

  insert into public.community_billing_settings
    (community_id, price_cents, billing_cycle, updated_by)
  values
    (p_community_id, p_price_cents, p_billing_cycle, auth.uid())
  on conflict (community_id) do update
    set price_cents   = excluded.price_cents,
        billing_cycle = excluded.billing_cycle,
        updated_by    = auth.uid(),
        updated_at    = now();
end;
$function$;

revoke all on function public.set_community_price(uuid, integer, text) from public;
grant execute on function public.set_community_price(uuid, integer, text) to authenticated;

-- ---- 5. default para comunidades NOVAS (R$ 14,90) --------------
create or replace function public.create_default_community_billing_settings()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.community_billing_settings (community_id, price_cents, billing_cycle)
  values (new.id, 1490, 'MONTHLY')
  on conflict (community_id) do nothing;
  return new;
end;
$function$;

create or replace trigger communities_create_default_billing_settings
  after insert on public.communities
  for each row execute function public.create_default_community_billing_settings();

-- ---- 6. BACKFILL das comunidades existentes (R$ 14,90/mês) -----
insert into public.community_billing_settings (community_id, price_cents, billing_cycle)
select id, 1490, 'MONTHLY' from public.communities
on conflict (community_id) do nothing;

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- drop trigger if exists communities_create_default_billing_settings on public.communities;
-- drop function if exists public.create_default_community_billing_settings();
-- drop function if exists public.set_community_price(uuid, integer, text);
-- drop policy if exists "community_billing_settings_select" on public.community_billing_settings;
-- drop table if exists public.community_billing_settings;
-- commit;
-- =====================================================================
