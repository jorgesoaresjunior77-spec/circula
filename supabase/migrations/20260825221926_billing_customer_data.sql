begin;

create table if not exists public.billing_customer_data (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  document_type text not null,
  document_number text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_customer_data_document_type_check check (document_type in ('CPF', 'CNPJ')),
  constraint billing_customer_data_document_number_format check (
    (document_type = 'CPF' and document_number ~ '^[0-9]{11}$')
    or (document_type = 'CNPJ' and document_number ~ '^[0-9]{14}$')
  )
);

create or replace trigger set_billing_customer_data_updated_at
before update on public.billing_customer_data
for each row execute function public.set_updated_at();

alter table public.billing_customer_data enable row level security;

drop policy if exists "billing_customer_data_select" on public.billing_customer_data;
create policy "billing_customer_data_select"
on public.billing_customer_data for select
using (profile_id = auth.uid() or public.is_master());

drop policy if exists "billing_customer_data_insert" on public.billing_customer_data;
create policy "billing_customer_data_insert"
on public.billing_customer_data for insert
with check (profile_id = auth.uid());

drop policy if exists "billing_customer_data_update" on public.billing_customer_data;
create policy "billing_customer_data_update"
on public.billing_customer_data for update
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

commit;
