-- =====================================================================
-- Nutri integrada (paciente <-> nutricionista).
--  1) Avisos no sino (social_notifications): novos tipos 'nutri_*'.
--  2) Agenda: pedido de cancelamento/reagendamento pela paciente e trava de
--     horário duplicado (mesma comunidade, data e hora).
--  3) Vínculo: a participante PEDE ("Sou paciente da Nutri"); só a dona da
--     comunidade aprova e liga à ficha (nutri_patients.linked_profile_id).
--  4) Isenção de 100% da assinatura do Círculo: só a dona concede, só para
--     paciente vinculada, com registro (quem, quando, origem).
--  5) Orientações/tarefas da nutricionista, medidas e fotos de evolução
--     (bucket PRIVADO), tudo visível só para a paciente e para a dona.
--  6) get_my_nutri_area(): o que a paciente enxerga, sem dados internos.
-- Aditiva, transacional e reversível (rollback no fim).
-- =====================================================================
begin;

-- ---- 1) tipos de aviso ------------------------------------------------
alter table public.social_notifications drop constraint if exists social_notifications_type_check;
alter table public.social_notifications add constraint social_notifications_type_check check (
  type = any (array['post_comment','post_reaction','circle_join','event_rsvp','direct_message','help_request',
    'membership_requested','membership_approved','membership_rejected','circle_request','circle_request_approved',
    'nutri_plan','nutri_appointment','nutri_message','nutri_request','nutri_update','nutri_link']::text[])
);

-- ---- funções auxiliares ----------------------------------------------
create or replace function public.is_my_patient(p_patient uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.nutri_patients
                  where id = p_patient and linked_profile_id = auth.uid() and status = 'ativo');
$$;
revoke all on function public.is_my_patient(uuid) from public, anon;
grant execute on function public.is_my_patient(uuid) to authenticated;

create or replace function public.nutri_notify(p_to uuid, p_type text, p_title text, p_body text, p_community uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_to is null then return; end if;
  insert into public.social_notifications (profile_id, actor_profile_id, type, title, body, related_community_id)
  values (p_to, auth.uid(), p_type, p_title, p_body, p_community);
end $$;
revoke all on function public.nutri_notify(uuid, text, text, text, uuid) from public, anon, authenticated;

-- ---- 2) agenda ---------------------------------------------------------
alter table public.nutri_consultations
  add column if not exists patient_request text check (patient_request is null or patient_request in ('reagendar')),
  add column if not exists patient_request_note text check (patient_request_note is null or char_length(patient_request_note) <= 500),
  add column if not exists patient_request_at timestamptz,
  add column if not exists canceled_by text check (canceled_by is null or canceled_by in ('paciente','nutri'));

create unique index if not exists nutri_consultations_no_double_booking
  on public.nutri_consultations (community_id, scheduled_on, scheduled_time)
  where status = 'agendada' and scheduled_time is not null;

create or replace function public.nutri_consultation_notify()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_patient record; v_owner uuid; v_when text;
begin
  select linked_profile_id, full_name into v_patient from public.nutri_patients where id = new.patient_id;
  select owner_id into v_owner from public.communities where id = new.community_id;
  v_when := to_char(new.scheduled_on, 'DD/MM') || coalesce(' às ' || new.scheduled_time, '');
  -- só avisa a paciente quando a mudança vem da nutricionista
  if auth.uid() is not distinct from v_owner and v_patient.linked_profile_id is not null then
    if tg_op = 'INSERT' and new.status = 'agendada' then
      perform public.nutri_notify(v_patient.linked_profile_id, 'nutri_appointment', 'Novo compromisso na agenda', 'Sua consulta foi marcada para ' || v_when || '.', new.community_id);
    elsif tg_op = 'UPDATE' and new.status = 'agendada' and (new.scheduled_on is distinct from old.scheduled_on or new.scheduled_time is distinct from old.scheduled_time) then
      perform public.nutri_notify(v_patient.linked_profile_id, 'nutri_appointment', 'Horário alterado', 'Sua consulta agora é em ' || v_when || '.', new.community_id);
    elsif tg_op = 'UPDATE' and new.status = 'cancelada' and old.status <> 'cancelada' then
      perform public.nutri_notify(v_patient.linked_profile_id, 'nutri_appointment', 'Consulta cancelada', 'Sua consulta de ' || v_when || ' foi cancelada.', new.community_id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists nutri_consultation_notify on public.nutri_consultations;
create trigger nutri_consultation_notify after insert or update on public.nutri_consultations
  for each row execute function public.nutri_consultation_notify();

create or replace function public.patient_cancel_consultation(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare c record; v_owner uuid; v_name text;
begin
  select * into c from public.nutri_consultations where id = p_id;
  if c.id is null or not public.is_my_patient(c.patient_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if c.status <> 'agendada' then raise exception 'not_scheduled'; end if;
  update public.nutri_consultations set status = 'cancelada', canceled_by = 'paciente', patient_request = null where id = p_id;
  select owner_id into v_owner from public.communities where id = c.community_id;
  select full_name into v_name from public.nutri_patients where id = c.patient_id;
  perform public.nutri_notify(v_owner, 'nutri_request', 'Consulta cancelada pela paciente',
    coalesce(v_name, 'A paciente') || ' cancelou a consulta de ' || to_char(c.scheduled_on, 'DD/MM') || coalesce(' às ' || c.scheduled_time, '') || '.', c.community_id);
end $$;
revoke all on function public.patient_cancel_consultation(uuid) from public, anon;
grant execute on function public.patient_cancel_consultation(uuid) to authenticated;

create or replace function public.patient_request_reschedule(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare c record; v_owner uuid; v_name text;
begin
  select * into c from public.nutri_consultations where id = p_id;
  if c.id is null or not public.is_my_patient(c.patient_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if c.status <> 'agendada' then raise exception 'not_scheduled'; end if;
  update public.nutri_consultations
     set patient_request = 'reagendar', patient_request_note = left(p_note, 500), patient_request_at = now()
   where id = p_id;
  select owner_id into v_owner from public.communities where id = c.community_id;
  select full_name into v_name from public.nutri_patients where id = c.patient_id;
  perform public.nutri_notify(v_owner, 'nutri_request', 'Pedido de reagendamento',
    coalesce(v_name, 'A paciente') || ' pediu para reagendar a consulta de ' || to_char(c.scheduled_on, 'DD/MM') || coalesce(' às ' || c.scheduled_time, '') || '.', c.community_id);
end $$;
revoke all on function public.patient_request_reschedule(uuid, text) from public, anon;
grant execute on function public.patient_request_reschedule(uuid, text) to authenticated;

-- ---- avisos de plano alimentar ----------------------------------------
create or replace function public.nutri_plan_notify()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_linked uuid;
begin
  if not new.shared_with_patient then return new; end if;
  select linked_profile_id into v_linked from public.nutri_patients where id = new.patient_id;
  if tg_op = 'INSERT' then
    perform public.nutri_notify(v_linked, 'nutri_plan', 'Novo plano alimentar', 'Sua nutricionista compartilhou um plano alimentar com você.', new.community_id);
  elsif old.shared_with_patient is not true then
    perform public.nutri_notify(v_linked, 'nutri_plan', 'Novo plano alimentar', 'Sua nutricionista compartilhou um plano alimentar com você.', new.community_id);
  elsif new.meals is distinct from old.meals or new.goals is distinct from old.goals or new.guidance is distinct from old.guidance then
    perform public.nutri_notify(v_linked, 'nutri_plan', 'Seu plano foi atualizado', 'Há mudanças no seu plano alimentar. Vale conferir.', new.community_id);
  end if;
  return new;
end $$;
drop trigger if exists nutri_plan_notify on public.nutri_plans;
create trigger nutri_plan_notify after insert or update on public.nutri_plans
  for each row execute function public.nutri_plan_notify();

-- ---- 3) vínculo pedido pela participante -------------------------------
create table if not exists public.nutri_link_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists nutri_link_requests_one_open on public.nutri_link_requests (profile_id, community_id) where status = 'pendente';
alter table public.nutri_link_requests enable row level security;
drop policy if exists "nutri_link_requests_select" on public.nutri_link_requests;
create policy "nutri_link_requests_select" on public.nutri_link_requests for select to authenticated
  using (profile_id = auth.uid() or public.owns_community(community_id));
-- escrita só pelas funções abaixo.

create or replace function public.request_nutri_link()
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_comm uuid; v_id uuid; v_owner uuid; v_name text;
begin
  if auth.uid() is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if exists (select 1 from public.nutri_patients where linked_profile_id = auth.uid() and status = 'ativo') then return null; end if;
  select cm.community_id into v_comm from public.community_members cm
   where cm.profile_id = auth.uid() order by cm.joined_at desc nulls last limit 1;
  if v_comm is null then return null; end if;
  insert into public.nutri_link_requests (profile_id, community_id) values (auth.uid(), v_comm)
  on conflict do nothing returning id into v_id;
  if v_id is null then return null; end if;
  select owner_id into v_owner from public.communities where id = v_comm;
  select full_name into v_name from public.profiles where id = auth.uid();
  perform public.nutri_notify(v_owner, 'nutri_link', 'Nova paciente pedindo vínculo', coalesce(v_name, 'Uma participante') || ' marcou "Sou paciente da Nutri". Confirme na área Nutri.', v_comm);
  return v_id;
end $$;
revoke all on function public.request_nutri_link() from public, anon;
grant execute on function public.request_nutri_link() to authenticated;

create or replace function public.list_nutri_link_requests(p_community uuid)
returns table (id uuid, profile_id uuid, full_name text, created_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select r.id, r.profile_id, p.full_name, r.created_at
    from public.nutri_link_requests r join public.profiles p on p.id = r.profile_id
   where r.community_id = p_community and r.status = 'pendente' and public.owns_community(p_community)
   order by r.created_at;
$$;
revoke all on function public.list_nutri_link_requests(uuid) from public, anon;
grant execute on function public.list_nutri_link_requests(uuid) to authenticated;

-- p_patient nulo + aprovar => cria a ficha com o nome da participante
create or replace function public.decide_nutri_link(p_request uuid, p_approve boolean, p_patient uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r record; v_patient uuid := p_patient; v_name text;
begin
  select * into r from public.nutri_link_requests where id = p_request and status = 'pendente';
  if r.id is null then raise exception 'request_not_found'; end if;
  if not public.owns_community(r.community_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_approve then
    if v_patient is null then
      select full_name into v_name from public.profiles where id = r.profile_id;
      insert into public.nutri_patients (community_id, full_name, linked_profile_id)
      values (r.community_id, coalesce(v_name, 'Paciente'), r.profile_id) returning id into v_patient;
    else
      update public.nutri_patients set linked_profile_id = r.profile_id, status = 'ativo'
       where id = v_patient and community_id = r.community_id;
      if not found then raise exception 'patient_not_found'; end if;
    end if;
    perform public.nutri_notify(r.profile_id, 'nutri_link', 'Vínculo confirmado', 'Sua nutricionista confirmou você como paciente. O botão Nutri já está no menu.', r.community_id);
  end if;
  update public.nutri_link_requests
     set status = case when p_approve then 'aprovado' else 'recusado' end, decided_by = auth.uid(), decided_at = now()
   where id = p_request;
end $$;
revoke all on function public.decide_nutri_link(uuid, boolean, uuid) from public, anon;
grant execute on function public.decide_nutri_link(uuid, boolean, uuid) to authenticated;

-- ---- 4) isenção de 100% da assinatura do Círculo -------------------------
create table if not exists public.nutri_exemptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.nutri_patients (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  origin text not null default 'paciente_nutri' check (origin in ('paciente_nutri')),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  note text check (note is null or char_length(note) <= 300)
);
create unique index if not exists nutri_exemptions_one_active on public.nutri_exemptions (patient_id) where revoked_at is null;
alter table public.nutri_exemptions enable row level security;
drop policy if exists "nutri_exemptions_select" on public.nutri_exemptions;
create policy "nutri_exemptions_select" on public.nutri_exemptions for select to authenticated
  using (public.owns_community(community_id) or profile_id = auth.uid() or public.is_master());

create or replace function public.grant_nutri_exemption(p_patient uuid, p_note text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare pt record; v_plan uuid; v_sub uuid;
begin
  select * into pt from public.nutri_patients where id = p_patient;
  if pt.id is null then raise exception 'patient_not_found'; end if;
  if not public.owns_community(pt.community_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if pt.linked_profile_id is null then raise exception 'patient_not_linked'; end if;
  if exists (select 1 from public.nutri_exemptions where patient_id = p_patient and revoked_at is null) then return; end if;

  select id, plan_id into v_sub, v_plan from public.subscriptions
   where subject = 'community' and profile_id = pt.linked_profile_id and community_id = pt.community_id
   order by created_at desc limit 1;
  if v_sub is null then
    select id into v_plan from public.billing_plans where subject = 'community' order by created_at limit 1;
    if v_plan is null then raise exception 'no_plan'; end if;
    insert into public.subscriptions (subject, profile_id, community_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
    values ('community', pt.linked_profile_id, pt.community_id, v_plan, 'active', now(), now(), now() + interval '100 years');
  else
    update public.subscriptions
       set status = 'active', current_period_end = now() + interval '100 years', grace_period_ends_at = null,
           canceled_at = null, updated_at = now()
     where id = v_sub;
  end if;
  insert into public.nutri_exemptions (patient_id, profile_id, community_id, granted_by, note)
  values (p_patient, pt.linked_profile_id, pt.community_id, auth.uid(), p_note);
  perform public.nutri_notify(pt.linked_profile_id, 'nutri_update', 'Assinatura isenta', 'Sua nutricionista liberou o Círculo para você, sem cobrança.', pt.community_id);
end $$;
revoke all on function public.grant_nutri_exemption(uuid, text) from public, anon;
grant execute on function public.grant_nutri_exemption(uuid, text) to authenticated;

-- Ao retirar a isenção, a assinatura volta a ser tratada como encerrada (a cobrança normal assume).
create or replace function public.revoke_nutri_exemption(p_patient uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare pt record;
begin
  select * into pt from public.nutri_patients where id = p_patient;
  if pt.id is null then raise exception 'patient_not_found'; end if;
  if not public.owns_community(pt.community_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.nutri_exemptions set revoked_at = now(), revoked_by = auth.uid()
   where patient_id = p_patient and revoked_at is null;
  if found then
    update public.subscriptions set status = 'canceled', canceled_at = now(), current_period_end = now(), updated_at = now()
     where subject = 'community' and profile_id = pt.linked_profile_id and community_id = pt.community_id
       and asaas_subscription_id is null;
  end if;
end $$;
revoke all on function public.revoke_nutri_exemption(uuid) from public, anon;
grant execute on function public.revoke_nutri_exemption(uuid) to authenticated;

-- ---- 5) orientações/tarefas, medidas e fotos -----------------------------
create table if not exists public.nutri_patient_updates (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.nutri_patients (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  kind text not null check (kind in ('orientacao','tarefa','mensagem')),
  title text not null check (char_length(title) between 1 and 160),
  body text check (body is null or char_length(body) <= 4000),
  done_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists nutri_patient_updates_idx on public.nutri_patient_updates (patient_id, created_at desc);

create table if not exists public.nutri_body_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.nutri_patients (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  taken_on date not null default current_date,
  arm_cm numeric(5,1) check (arm_cm is null or arm_cm between 5 and 120),
  thigh_cm numeric(5,1) check (thigh_cm is null or thigh_cm between 10 and 150),
  waist_cm numeric(5,1) check (waist_cm is null or waist_cm between 30 and 250),
  abdomen_cm numeric(5,1) check (abdomen_cm is null or abdomen_cm between 30 and 250),
  hip_cm numeric(5,1) check (hip_cm is null or hip_cm between 40 and 250),
  other_label text check (other_label is null or char_length(other_label) <= 60),
  other_cm numeric(5,1) check (other_cm is null or other_cm between 5 and 250),
  notes text check (notes is null or char_length(notes) <= 500),
  source text not null default 'paciente' check (source in ('paciente','nutri')),
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists nutri_body_entries_idx on public.nutri_body_entries (patient_id, taken_on desc);

create table if not exists public.nutri_progress_photos (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.nutri_patients (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  taken_on date not null default current_date,
  view text not null default 'frente' check (view in ('frente','lado','costas')),
  file_path text not null check (char_length(file_path) <= 400),
  source text not null default 'paciente' check (source in ('paciente','nutri')),
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists nutri_progress_photos_idx on public.nutri_progress_photos (patient_id, taken_on desc);

do $$
declare t text;
begin
  foreach t in array array['nutri_patient_updates','nutri_body_entries','nutri_progress_photos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_owner" on public.%I', t, t);
    execute format('create policy "%s_owner" on public.%I for all to authenticated using (public.owns_community(community_id)) with check (public.owns_community(community_id))', t, t);
  end loop;
end $$;

-- a paciente lê e registra as próprias medidas/fotos; lê as orientações
drop policy if exists "nutri_patient_updates_mine" on public.nutri_patient_updates;
create policy "nutri_patient_updates_mine" on public.nutri_patient_updates for select to authenticated using (public.is_my_patient(patient_id));
drop policy if exists "nutri_body_entries_mine_select" on public.nutri_body_entries;
create policy "nutri_body_entries_mine_select" on public.nutri_body_entries for select to authenticated using (public.is_my_patient(patient_id));
drop policy if exists "nutri_body_entries_mine_insert" on public.nutri_body_entries;
create policy "nutri_body_entries_mine_insert" on public.nutri_body_entries for insert to authenticated
  with check (public.is_my_patient(patient_id) and source = 'paciente' and created_by = auth.uid()
    and community_id = (select community_id from public.nutri_patients where id = patient_id));
drop policy if exists "nutri_body_entries_mine_delete" on public.nutri_body_entries;
create policy "nutri_body_entries_mine_delete" on public.nutri_body_entries for delete to authenticated using (public.is_my_patient(patient_id) and source = 'paciente');
drop policy if exists "nutri_progress_photos_mine_select" on public.nutri_progress_photos;
create policy "nutri_progress_photos_mine_select" on public.nutri_progress_photos for select to authenticated using (public.is_my_patient(patient_id));
drop policy if exists "nutri_progress_photos_mine_insert" on public.nutri_progress_photos;
create policy "nutri_progress_photos_mine_insert" on public.nutri_progress_photos for insert to authenticated
  with check (public.is_my_patient(patient_id) and source = 'paciente' and created_by = auth.uid()
    and community_id = (select community_id from public.nutri_patients where id = patient_id));
drop policy if exists "nutri_progress_photos_mine_delete" on public.nutri_progress_photos;
create policy "nutri_progress_photos_mine_delete" on public.nutri_progress_photos for delete to authenticated using (public.is_my_patient(patient_id) and source = 'paciente');

-- bucket privado: {community_id}/{patient_id}/arquivo
insert into storage.buckets (id, name, public, file_size_limit)
values ('nutri-progress', 'nutri-progress', false, 10485760)
on conflict (id) do nothing;
drop policy if exists "nutri_progress_select" on storage.objects;
create policy "nutri_progress_select" on storage.objects for select to authenticated
  using (bucket_id = 'nutri-progress' and (
    public.owns_community(((storage.foldername(name))[1])::uuid)
    or public.is_my_patient(((storage.foldername(name))[2])::uuid)));
drop policy if exists "nutri_progress_insert" on storage.objects;
create policy "nutri_progress_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'nutri-progress' and (
    public.owns_community(((storage.foldername(name))[1])::uuid)
    or public.is_my_patient(((storage.foldername(name))[2])::uuid)));
drop policy if exists "nutri_progress_delete" on storage.objects;
create policy "nutri_progress_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'nutri-progress' and (
    public.owns_community(((storage.foldername(name))[1])::uuid)
    or public.is_my_patient(((storage.foldername(name))[2])::uuid)));

-- avisos: orientação nova -> paciente; medida/foto nova -> nutricionista
create or replace function public.nutri_update_notify()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_linked uuid; v_name text; v_owner uuid;
begin
  select linked_profile_id, full_name into v_linked, v_name from public.nutri_patients where id = new.patient_id;
  select owner_id into v_owner from public.communities where id = new.community_id;
  if tg_table_name = 'nutri_patient_updates' then
    perform public.nutri_notify(v_linked, case when new.kind = 'mensagem' then 'nutri_message' else 'nutri_message' end,
      case new.kind when 'tarefa' then 'Nova tarefa da sua nutricionista' when 'mensagem' then 'Mensagem da sua nutricionista' else 'Nova orientação' end,
      new.title, new.community_id);
  elsif new.source = 'paciente' then
    perform public.nutri_notify(v_owner, 'nutri_update', 'Atualização de paciente',
      coalesce(v_name, 'Uma paciente') || case when tg_table_name = 'nutri_progress_photos' then ' enviou uma foto de evolução.' else ' registrou novas medidas.' end, new.community_id);
  end if;
  return new;
end $$;
drop trigger if exists nutri_updates_notify on public.nutri_patient_updates;
create trigger nutri_updates_notify after insert on public.nutri_patient_updates for each row execute function public.nutri_update_notify();
drop trigger if exists nutri_body_notify on public.nutri_body_entries;
create trigger nutri_body_notify after insert on public.nutri_body_entries for each row execute function public.nutri_update_notify();
drop trigger if exists nutri_photo_notify on public.nutri_progress_photos;
create trigger nutri_photo_notify after insert on public.nutri_progress_photos for each row execute function public.nutri_update_notify();

-- a paciente marca a tarefa como feita
create or replace function public.complete_nutri_task(p_id uuid, p_done boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update public.nutri_patient_updates u set done_at = case when p_done then now() else null end
   where u.id = p_id and u.kind = 'tarefa' and public.is_my_patient(u.patient_id);
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
end $$;
revoke all on function public.complete_nutri_task(uuid, boolean) from public, anon;
grant execute on function public.complete_nutri_task(uuid, boolean) to authenticated;

-- ---- 6) área da paciente -----------------------------------------------
create or replace function public.get_my_nutri_area()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_patient record; v_base jsonb;
begin
  if auth.uid() is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select id, community_id, full_name into v_patient from public.nutri_patients
   where linked_profile_id = auth.uid() and status = 'ativo' order by created_at desc limit 1;
  if v_patient.id is null then return null; end if;
  v_base := coalesce(public.get_my_nutri_plan(), '{}'::jsonb);
  return v_base || jsonb_build_object(
    'patient_id', v_patient.id,
    'community_id', v_patient.community_id,
    'exempt', exists (select 1 from public.nutri_exemptions where patient_id = v_patient.id and revoked_at is null),
    'appointments', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'status', c.status,
        'scheduled_on', c.scheduled_on, 'scheduled_time', c.scheduled_time, 'patient_request', c.patient_request,
        'canceled_by', c.canceled_by) order by c.scheduled_on desc, c.scheduled_time desc), '[]'::jsonb)
      from (select * from public.nutri_consultations where patient_id = v_patient.id order by scheduled_on desc limit 30) c),
    'updates', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'kind', u.kind, 'title', u.title, 'body', u.body,
        'done_at', u.done_at, 'created_at', u.created_at) order by u.created_at desc), '[]'::jsonb)
      from (select * from public.nutri_patient_updates where patient_id = v_patient.id order by created_at desc limit 60) u)
  );
end $$;
revoke all on function public.get_my_nutri_area() from public, anon;
grant execute on function public.get_my_nutri_area() to authenticated;

commit;

-- ROLLBACK (manual):
--   drop function get_my_nutri_area(), complete_nutri_task(uuid,boolean), nutri_update_notify(), revoke_nutri_exemption(uuid),
--     grant_nutri_exemption(uuid,text), decide_nutri_link(uuid,boolean,uuid), list_nutri_link_requests(uuid), request_nutri_link(),
--     nutri_plan_notify(), patient_request_reschedule(uuid,text), patient_cancel_consultation(uuid), nutri_consultation_notify(),
--     nutri_notify(uuid,text,text,text,uuid), is_my_patient(uuid) cascade;
--   drop table nutri_progress_photos, nutri_body_entries, nutri_patient_updates, nutri_exemptions, nutri_link_requests;
--   drop index nutri_consultations_no_double_booking;
