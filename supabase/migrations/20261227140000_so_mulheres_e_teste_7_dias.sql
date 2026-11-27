-- Círcula é só para mulheres (pedido de 2026-11-27).
-- 1) public.gender_hint(nome, e-mail): 'male' (nome claramente masculino), 'ambiguous' (nome usado pelos dois, ou
--    nome fora da lista com e-mail masculino) ou null. Mesma lista de src/lib/genderCheck.ts.
-- 2) handle_new_user: nome masculino -> o cadastro é recusado (exceção 'so_mulheres'); nome ambíguo de membro ->
--    profiles.gender_review = true.
-- 3) join_community_by_invite: quem está em revisão entra como 'pending' (a profissional aprova ou recusa) em vez
--    de 'active'. O resto da função não muda.
-- 4) Teste grátis da membro: 21 dias para quem entra até 31/12/2026 23:59:59 (Brasília); a partir de 01/01/2027,
--    7 dias (create_community_trial). O teste da profissional não muda.
-- Reversível: rollback no fim.
begin;

alter table public.profiles add column if not exists gender_review boolean not null default false;

create or replace function public.first_word_plain(p text)
returns text
language sql
immutable
set search_path to ''
as $fn$
  select coalesce((
    select w from unnest(regexp_split_to_array(
      lower(translate(coalesce(p, ''),
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')),
      '[^a-z]+')) with ordinality as t(w, i)
    where w <> ''
    order by i
    limit 1
  ), '')
$fn$;

create or replace function public.gender_hint(p_name text, p_email text default null)
returns text
language plpgsql
immutable
set search_path to ''
as $fn$
declare
  v_first text := public.first_word_plain(p_name);
  v_mail  text := public.first_word_plain(split_part(coalesce(p_email, ''), '@', 1));
  v_male  text[] := array['abel','abner','adao','ademir','adilson','adriano','adolfo','afonso','agostinho','alberto','alcides','aldo','alexandre','alfredo','almir','aloisio','alvaro','amadeu','amauri','americo','anderson','andre','anibal','anselmo','anthony','antonio','armando','arnaldo','arthur','artur','augusto','aurelio','benedito','benjamin','bento','bernardo','breno','bruno','caetano','caio','carlos','cassio','cauan','caua','celso','cesar','cicero','claudio','cleber','cleiton','cristiano','cristovao','daniel','danilo','davi','david','denis','diego','diogo','domingos','douglas','edgar','edilson','edmilson','edson','eduardo','edvaldo','elias','elton','emanuel','emerson','enrico','enzo','erick','eric','ernesto','evandro','everton','ezequiel','fabiano','fabio','fabricio','felipe','fernando','flavio','francisco','frederico','gabriel','gael','geraldo','gerson','gilberto','gilmar','gilson','giovanni','gustavo','heitor','helio','henrique','hugo','humberto','igor','ismael','isaac','ivan','jair','jairo','jefferson','jeferson','joao','joaquim','joel','jonas','jonathan','jorge','jose','josue','juliano','julio','junior','jurandir','kaique','kaua','kauan','kevin','lauro','leandro','leonardo','lorenzo','luan','lucas','luciano','lucio','luis','luiz','manoel','manuel','marcelo','marcio','marco','marcos','mario','mateus','matheus','mauricio','mauro','miguel','milton','moises','murilo','natan','nathan','nelson','nicolas','nilton','orlando','osvaldo','oswaldo','otavio','otto','pablo','patrick','paulo','pedro','pietro','rafael','raphael','raimundo','raul','reginaldo','reinaldo','renan','renato','ricardo','roberto','robson','rodolfo','rodrigo','rogerio','romario','ronaldo','ruan','rubens','rui','samuel','sandro','saulo','sebastiao','sergio','severino','sidnei','sidney','silvio','tadeu','thales','tales','theo','thiago','tiago','thomas','tomas','ulisses','vagner','valdemar','valdir','valter','vanderlei','vicente','vinicius','vitor','victor','wagner','waldir','walter','wanderley','washington','wellington','wesley','william','willian','wilson','yuri']::text[];
  v_amb   text[] := array['alex','altair','ariel','cris','dagmar','dani','darci','darcy','edir','eli','francis','gil','jaci','jean','joaci','juraci','kim','nadir','neri','noa','rene','sasha','valdeci']::text[];
begin
  if v_first = any (v_male) then
    return 'male';
  end if;
  if v_first = any (v_amb) then
    return 'ambiguous';
  end if;
  if v_mail <> '' and v_mail = any (v_male) then
    return 'ambiguous';
  end if;
  return null;
end;
$fn$;

grant execute on function public.first_word_plain(text) to anon, authenticated;
grant execute on function public.gender_hint(text, text) to anon, authenticated;

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_role public.user_role;
  v_hint text;
begin
  -- Fase 15.1 — cadastro público: `account_type='professional'` no
  -- metadata do signup faz o perfil nascer professional. Qualquer
  -- outro valor (ou ausência) -> 'member' (default histórico).
  -- NUNCA 'master'.
  v_role := case
    when new.raw_user_meta_data ->> 'account_type' = 'professional'
      then 'professional'::public.user_role
    else 'member'::public.user_role
  end;

  -- Círcula é só para mulheres: nome claramente masculino não entra (membro ou profissional).
  v_hint := public.gender_hint(new.raw_user_meta_data ->> 'full_name', new.email);
  if v_hint = 'male' then
    raise exception 'so_mulheres' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, full_name, role, gender_review)
  values (new.id, new.raw_user_meta_data ->> 'full_name', v_role, v_role = 'member' and coalesce(v_hint = 'ambiguous', false));

  -- Trial de plataforma de 21 dias para o novo professional. Espelha
  -- o corpo de `create_platform_trial()`. Mesmo guard de unicidade do
  -- índice `subscriptions_platform_unique_idx`.
  if v_role = 'professional' then
    if not exists (
      select 1 from public.subscriptions
      where subject = 'platform'
        and profile_id = new.id
        and status <> 'canceled'
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

create or replace function public.member_trial_length(p_at timestamptz default now())
returns interval
language sql
immutable
set search_path to ''
as $fn$
  select case when p_at < '2027-01-01 00:00:00-03'::timestamptz then interval '21 days' else interval '7 days' end
$fn$;

create or replace function public.create_community_trial()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from public.subscriptions
    where subject = 'community' and profile_id = new.profile_id
      and community_id = new.community_id and status <> 'canceled'
  ) then
    -- 21 dias para quem entra até 31/12/2026 23:59:59 (Brasília); 7 dias a partir de 01/01/2027.
    insert into public.subscriptions (
      subject, profile_id, community_id, plan_id, status,
      trial_ends_at, current_period_start, current_period_end
    )
    values (
      'community', new.profile_id, new.community_id,
      (select id from public.billing_plans where code = 'member_monthly'),
      'trial', now() + public.member_trial_length(now()), now(), now() + public.member_trial_length(now())
    );
  end if;
  return new;
end;
$function$;

create or replace function public.join_community_by_invite(p_token text, p_ref uuid default null::uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid       uuid := auth.uid();
  v_community uuid;
  v_role      public.user_role;
  v_status    public.membership_status;
  v_review    boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select community_id into v_community
  from public.community_invite_links
  where token = p_token and revoked_at is null;

  if v_community is null then
    raise exception 'invalid_invite' using errcode = 'P0002';
  end if;

  select role, gender_review into v_role, v_review from public.profiles where id = v_uid;
  if v_role is distinct from 'member'::public.user_role then
    raise exception 'not_member' using errcode = '42501';
  end if;

  -- Nome que pode ser masculino: a entrada fica esperando a aprovação da profissional
  -- (quem já está ativa não é afetada).
  if coalesce(v_review, false) and not exists (
    select 1 from public.community_members
    where community_id = v_community and profile_id = v_uid and status = 'active'
  ) then
    insert into public.community_members (community_id, profile_id, status)
    values (v_community, v_uid, 'pending')
    on conflict (community_id, profile_id) do nothing;
    return v_community;
  end if;

  insert into public.community_members (community_id, profile_id, status)
  values (v_community, v_uid, 'active')
  on conflict (community_id, profile_id)
  do update set status = 'active' where public.community_members.status = 'pending';

  select status into v_status
  from public.community_members
  where community_id = v_community and profile_id = v_uid;

  if v_status is distinct from 'active'::public.membership_status then
    raise exception 'not_active' using errcode = '42501';
  end if;

  -- indicação: só vale se quem indicou é membro ativa desta comunidade
  if p_ref is not null and p_ref <> v_uid and exists (
    select 1 from public.community_members
    where community_id = v_community and profile_id = p_ref and status = 'active'
  ) then
    insert into public.referrals (invitee_id, inviter_id, community_id)
    values (v_uid, p_ref, v_community)
    on conflict (invitee_id) do nothing;
  end if;

  return v_community;
end;
$function$;

commit;

-- rollback:
--   restaurar handle_new_user, create_community_trial e join_community_by_invite como estavam antes
--   (corpos em 20260915120000_public_signup_professional.sql e no baseline: trial fixo de 21 dias, join sem revisão);
--   drop function public.member_trial_length(timestamptz); drop function public.gender_hint(text, text);
--   drop function public.first_word_plain(text); alter table public.profiles drop column gender_review;
