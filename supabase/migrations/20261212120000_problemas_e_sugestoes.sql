-- "Encontrou algum problema? Me notifique": a membro escreve o que está errado (ou uma sugestão)
-- e a profissional recebe no sino e vê a lista no Painel.
begin;

create table if not exists public.member_feedback (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  tipo        text not null check (tipo in ('problema', 'sugestao')),
  texto       text not null check (char_length(btrim(texto)) between 5 and 2000),
  lido        boolean not null default false,
  criado_em   timestamptz not null default now()
);
create index if not exists member_feedback_criado_idx on public.member_feedback (criado_em desc);
alter table public.member_feedback enable row level security;

drop policy if exists "member_feedback_select" on public.member_feedback;
create policy "member_feedback_select" on public.member_feedback for select to authenticated
  using (profile_id = auth.uid() or public.is_city_admin());
revoke all on table public.member_feedback from public, anon, authenticated;
grant select on table public.member_feedback to authenticated;
grant all on table public.member_feedback to service_role;

alter table public.social_notifications drop constraint if exists social_notifications_type_check;
alter table public.social_notifications add constraint social_notifications_type_check check (
  type = any (array['post_comment','post_reaction','circle_join','event_rsvp','direct_message','help_request',
    'membership_requested','membership_approved','membership_rejected','circle_request','circle_request_approved',
    'nutri_plan','nutri_appointment','nutri_message','nutri_request','nutri_update','nutri_link',
    'city_claim','city_claim_result','city_category_request','feedback']::text[])
);

create or replace function public.feedback_send(p_tipo text, p_texto text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_texto text := btrim(coalesce(p_texto, '')); v_nome text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_tipo not in ('problema', 'sugestao') then raise exception 'tipo_invalido'; end if;
  if char_length(v_texto) not between 5 and 2000 then raise exception 'texto_invalido'; end if;
  insert into public.member_feedback (profile_id, tipo, texto) values (v_uid, p_tipo, v_texto);
  select coalesce(nullif(split_part(btrim(coalesce(full_name, '')), ' ', 1), ''), 'Participante') into v_nome from public.profiles where id = v_uid;
  perform public.city_notify_admins(
    'feedback',
    case when p_tipo = 'problema' then 'Problema relatado' else 'Sugestão nova' end,
    v_nome || ': ' || left(v_texto, 120)
  );
end $$;
revoke all on function public.feedback_send(text, text) from public, anon;
grant execute on function public.feedback_send(text, text) to authenticated;

create or replace function public.feedback_list()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id, 'tipo', f.tipo, 'texto', f.texto, 'lido', f.lido, 'criado_em', f.criado_em,
      'nome', coalesce(nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''), 'Participante')
    ) order by f.lido, f.criado_em desc)
    from (select * from public.member_feedback order by criado_em desc limit 300) f
    left join public.profiles p on p.id = f.profile_id
  ), '[]'::jsonb);
end $$;
revoke all on function public.feedback_list() from public, anon;
grant execute on function public.feedback_list() to authenticated;

create or replace function public.feedback_mark(p_id uuid, p_lido boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  update public.member_feedback set lido = p_lido where id = p_id;
end $$;
revoke all on function public.feedback_mark(uuid, boolean) from public, anon;
grant execute on function public.feedback_mark(uuid, boolean) to authenticated;

-- contador das bolinhas passa a incluir os relatos novos
create or replace function public.city_pending_counts()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_city_admin() then return jsonb_build_object('claims', 0, 'categorias', 0, 'denuncias', 0, 'feedback', 0); end if;
  return jsonb_build_object(
    'claims', (select count(*) from public.city_claims where status = 'pendente'),
    'categorias', (select count(*) from public.city_categories where status = 'pendente'),
    'denuncias', (select count(*) from public.city_reports where status = 'aberta'),
    'feedback', (select count(*) from public.member_feedback where not lido)
  );
end $$;
revoke all on function public.city_pending_counts() from public, anon;
grant execute on function public.city_pending_counts() to authenticated;

commit;
-- ROLLBACK (manual): drop function feedback_send, feedback_list, feedback_mark; drop table member_feedback; (recriar o CHECK sem 'feedback')
