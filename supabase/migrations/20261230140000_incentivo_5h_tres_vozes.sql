-- Incentivo diário no Feed às 5h (Brasília), regra automática pedida em 28/11/2026.
-- Três vozes que se revezam um dia cada: Nutri Marluce, App Círcula e Comunidade Fluir & Florescer.
-- Só mensagens CADASTRADAS pela equipe (Painel → Agenda de conteúdos → Incentivo das 5h): nada é gerado
-- por IA. Se uma voz ainda não tem mensagem ativa, o dia passa para a próxima voz que tiver.
-- Os 14 textos que já existiam ficam na voz da Nutri Marluce.
begin;

alter table public.daily_morning_messages add column if not exists signer text not null default 'marluce';
alter table public.daily_morning_messages drop constraint if exists daily_morning_messages_signer_check;
alter table public.daily_morning_messages add constraint daily_morning_messages_signer_check
  check (signer in ('marluce', 'circula', 'fluir'));
alter table public.daily_morning_messages add column if not exists updated_at timestamptz not null default now();

-- Quem cadastra: a profissional dona de comunidade (Marluce) ou o master.
create or replace function public.can_edit_morning_messages()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.is_master() or exists (select 1 from public.communities where owner_id = auth.uid());
$$;
revoke all on function public.can_edit_morning_messages() from public, anon;
grant execute on function public.can_edit_morning_messages() to authenticated;

drop policy if exists daily_morning_messages_staff on public.daily_morning_messages;
create policy daily_morning_messages_staff on public.daily_morning_messages for all to authenticated
  using (public.can_edit_morning_messages()) with check (public.can_edit_morning_messages());
grant select, insert, update, delete on table public.daily_morning_messages to authenticated;
grant usage, select on sequence public.daily_morning_messages_id_seq to authenticated;

create or replace function public.post_bom_dia_marluce()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_voices  text[] := array['marluce', 'circula', 'fluir'];
  v_titles  text[] := array['Bom dia da Nutri Marluce', 'Bom dia do Círcula', 'Bom dia do Fluir & Florescer'];
  v_day     integer;
  v_signer  text;
  v_title   text;
  v_total   integer;
  v_msg     text;
  v_count   integer := 0;
  k         integer;
  i         integer;
  c record;
begin
  v_day := (extract(epoch from (now() at time zone 'America/Sao_Paulo')::date)::bigint / 86400)::integer;

  -- a voz do dia (gira um por dia); sem mensagem ativa, passa para a próxima
  for k in 0..2 loop
    i := ((v_day + k) % 3) + 1;
    select count(*) into v_total from public.daily_morning_messages where active and signer = v_voices[i];
    if v_total > 0 then
      v_signer := v_voices[i];
      v_title := v_titles[i];
      exit;
    end if;
  end loop;
  if v_signer is null then return 0; end if;

  -- dentro da voz, as mensagens vão na ordem do cadastro, uma por vez que a voz aparece
  select body into v_msg
  from (
    select body, row_number() over (order by id) - 1 as n
    from public.daily_morning_messages where active and signer = v_signer
  ) m
  where m.n = (v_day / 3) % v_total;

  for c in select id, owner_id from public.communities where owner_id is not null loop
    -- um único incentivo por comunidade por dia (horário de Brasília)
    if not exists (
      select 1 from public.posts
      where community_id = c.id and author_id = c.owner_id and title like 'Bom dia%'
        and (created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
    ) then
      insert into public.posts (community_id, author_id, content, title, post_type)
      values (c.id, c.owner_id, v_msg, v_title, 'standard');
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;
revoke all on function public.post_bom_dia_marluce() from public, anon, authenticated;

commit;
-- ROLLBACK (manual): recriar post_bom_dia_marluce() da migration 20261205140000;
--   drop policy daily_morning_messages_staff; revoke dos grants; drop function can_edit_morning_messages();
--   alter table daily_morning_messages drop column signer, drop column updated_at;
