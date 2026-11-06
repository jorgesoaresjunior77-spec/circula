-- =====================================================================
-- Agenda pessoal do membro — compromissos e observações
-- =====================================================================
-- Uma tabela nova, PRIVADA: cada pessoa só enxerga e altera os próprios
-- compromissos. Nem a profissional dona da comunidade nem a master leem
-- a agenda de outra pessoa (é dado pessoal, sem finalidade de gestão).
--
-- `starts_at`/`ends_at` são timestamptz (instante absoluto); o app grava
-- e exibe no fuso oficial America/Sao_Paulo, o mesmo do Meu Jardim.
-- `all_day` marca compromisso sem hora (o app grava 00:00 do dia).
--
-- Sem lembretes automáticos: não existe hoje no app um canal de envio
-- (push/e-mail agendado) para eles, então a coluna não existe — nada de
-- campo que prometa um aviso que ninguém vai receber.
--
-- Idempotente (if not exists / drop policy if exists) e reversível
-- (rodapé). Não altera nenhuma tabela existente.
-- =====================================================================

begin;

create table if not exists public.member_appointments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  notes text check (notes is null or char_length(notes) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_appointments_end_after_start check (ends_at is null or ends_at >= starts_at)
);

create index if not exists member_appointments_profile_starts_idx
  on public.member_appointments (profile_id, starts_at);

-- updated_at sempre do servidor (o cliente não escolhe).
create or replace function public.member_appointments_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.member_appointments_touch() from public, anon, authenticated;

drop trigger if exists member_appointments_touch on public.member_appointments;
create trigger member_appointments_touch before update on public.member_appointments
  for each row execute function public.member_appointments_touch();

alter table public.member_appointments enable row level security;

drop policy if exists "member_appointments_select" on public.member_appointments;
create policy "member_appointments_select" on public.member_appointments
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists "member_appointments_insert" on public.member_appointments;
create policy "member_appointments_insert" on public.member_appointments
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists "member_appointments_update" on public.member_appointments;
create policy "member_appointments_update" on public.member_appointments
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "member_appointments_delete" on public.member_appointments;
create policy "member_appointments_delete" on public.member_appointments
  for delete to authenticated using (profile_id = auth.uid());

revoke all on table public.member_appointments from public, anon;
grant select, insert, update, delete on table public.member_appointments to authenticated;

commit;

-- ---- Rollback (manual) ------------------------------------------
-- drop table if exists public.member_appointments cascade;
-- drop function if exists public.member_appointments_touch();
