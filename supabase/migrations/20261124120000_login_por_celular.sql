-- Login por celular (2026-11-18).
-- O celular (DDD + 9 + 8 dígitos, só números: 51996509660) é o login. O e-mail
-- continua na conta do Supabase Auth (cadastro e recuperação de senha).
--
-- O celular fica numa tabela PRIVADA: só a própria pessoa lê a linha dela e
-- ninguém escreve direto (a escrita passa pela RPC set_my_login_phone ou pelo
-- gatilho do cadastro). Quem faz a troca "celular + senha -> sessão" é a edge
-- function login-with-phone, com a service role.

create table if not exists public.login_phones (
  profile_id uuid primary key references auth.users (id) on delete cascade,
  phone text not null unique check (phone ~ '^[1-9][0-9]9[0-9]{8}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.login_phones enable row level security;

drop policy if exists login_phones_select_own on public.login_phones;
create policy login_phones_select_own on public.login_phones
  for select to authenticated
  using (profile_id = auth.uid());

-- Normaliza o que a pessoa digitou: só dígitos, sem o 55 do país. Devolve null
-- se não for um celular válido (DDD + 9 + 8 dígitos).
create or replace function public.normalize_login_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  d text;
begin
  if p_phone is null then
    return null;
  end if;
  d := regexp_replace(p_phone, '\D', '', 'g');
  if length(d) = 13 and left(d, 2) = '55' then
    d := substr(d, 3);
  end if;
  if d ~ '^[1-9][0-9]9[0-9]{8}$' then
    return d;
  end if;
  return null;
end;
$$;

-- A própria pessoa define/troca o celular de login (tela "Cadastre seu celular").
create or replace function public.set_my_login_phone(p_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n text := public.normalize_login_phone(p_phone);
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if n is null then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  insert into public.login_phones (profile_id, phone)
  values (uid, n)
  on conflict (profile_id) do update set phone = excluded.phone, updated_at = now();
exception
  when unique_violation then
    raise exception 'phone_in_use' using errcode = '23505';
end;
$$;

revoke all on function public.set_my_login_phone(text) from public, anon;
grant execute on function public.set_my_login_phone(text) to authenticated;

-- Cadastro: o celular vem em raw_user_meta_data.phone (o app manda no signUp).
-- Celular inválido/ausente: a conta nasce sem celular e o app pede depois.
-- Celular já usado por outra conta: o cadastro falha (unique_violation).
create or replace function public.capture_login_phone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n text := public.normalize_login_phone(new.raw_user_meta_data ->> 'phone');
begin
  if n is not null then
    insert into public.login_phones (profile_id, phone) values (new.id, n);
  end if;
  return new;
end;
$$;

drop trigger if exists capture_login_phone on auth.users;
create trigger capture_login_phone
  after insert on auth.users
  for each row execute function public.capture_login_phone();
