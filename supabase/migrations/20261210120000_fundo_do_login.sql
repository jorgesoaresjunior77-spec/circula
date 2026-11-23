-- Foto de fundo da tela de login (9:16), cadastrada no Painel pela profissional.
-- A tela de login é vista SEM conta, então a leitura é pública (só a URL de uma imagem
-- que está no bucket público `avatars`); quem grava é a administração (master/profissional).
begin;

create table if not exists public.app_public_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.app_public_settings enable row level security;

drop policy if exists "app_public_settings_select" on public.app_public_settings;
create policy "app_public_settings_select" on public.app_public_settings for select to public using (true);

create or replace function public.set_login_background(p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_city_admin() then
    raise exception 'bloqueado';
  end if;
  if p_url is null or length(trim(p_url)) = 0 then
    delete from public.app_public_settings where key = 'login_background';
  else
    if p_url !~ '^https://' or length(p_url) > 500 then
      raise exception 'url_invalida';
    end if;
    insert into public.app_public_settings (key, value, updated_at) values ('login_background', p_url, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
end $$;
revoke all on function public.set_login_background(text) from public, anon;
grant execute on function public.set_login_background(text) to authenticated;

commit;
-- rollback: drop function public.set_login_background(text); drop table public.app_public_settings;
