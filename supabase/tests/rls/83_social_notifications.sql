-- =====================================================================
-- 83 — NOTIFICAÇÕES SOCIAIS: social_notifications (+ Realtime, 20260925130000)
-- =====================================================================
-- Cobre a RLS de `public.social_notifications`, que nunca tinha cenário
-- próprio nesta suíte (a tabela existe desde `20260831150000` e nunca
-- foi coberta). A adição da tabela à publicação `supabase_realtime`
-- (`20260925130000_social_notifications_realtime.sql`) não altera RLS
-- nem grants — o Realtime (`postgres_changes`) entrega ao assinante
-- exatamente o que a policy de SELECT já libera, então as mesmas
-- asserções abaixo cobrem tanto o caminho REST quanto o caminho Realtime.
--
--   • social_notifications_select — só a própria (`profile_id = auth.uid()`).
--     SEM `is_master()`: ao contrário de outras tabelas (subscription/
--     product_payouts), o Master NÃO tem visão de plataforma aqui —
--     decisão já registrada em "Dados BLOQUEADOS para o Master" (Fase 9).
--     Testado abaixo explicitamente (isolamento vale também para Master).
--   • social_notifications_update_own — só marca a própria como lida.
--   • Sem policy de INSERT/DELETE para `authenticated` — só gatilhos
--     SECURITY DEFINER e `service_role` escrevem.
--
-- Fixtures sintéticas (3 notificações, uma por persona real) são criadas
-- como `postgres` (dono da tabela -> ignora RLS) e somem no ROLLBACK
-- final. NADA é persistido.
-- =====================================================================

insert into public.social_notifications
  (id, profile_id, actor_profile_id, type, title, body)
values
  ('f0000000-0000-4000-8000-0000000000f1', pg_temp.fx('member'), pg_temp.fx('prof'),
   'post_comment', '[rls-suite] comentário no seu post', 'Prof comentou.'),
  ('f0000000-0000-4000-8000-0000000000f2', pg_temp.fx('prof'), pg_temp.fx('member'),
   'post_reaction', '[rls-suite] reação no seu post', 'Member reagiu.'),
  ('f0000000-0000-4000-8000-0000000000f3', pg_temp.fx('master'), pg_temp.fx('member'),
   'circle_join', '[rls-suite] novo círculo', 'Member entrou num círculo.');

-- ================= SELECT — cada usuária só a própria =================

select pg_temp.expect_count('member: vê a própria notificação',
  pg_temp.fx('member'),
  format('select count(*) from public.social_notifications where id = %L', 'f0000000-0000-4000-8000-0000000000f1'), 1);

select pg_temp.expect_count('member: NÃO vê notificação do prof (isolamento)',
  pg_temp.fx('member'),
  format('select count(*) from public.social_notifications where id = %L', 'f0000000-0000-4000-8000-0000000000f2'), 0);

select pg_temp.expect_count('member: NÃO vê notificação do master (isolamento)',
  pg_temp.fx('member'),
  format('select count(*) from public.social_notifications where id = %L', 'f0000000-0000-4000-8000-0000000000f3'), 0);

select pg_temp.expect_count('prof: vê a própria notificação',
  pg_temp.fx('prof'),
  format('select count(*) from public.social_notifications where id = %L', 'f0000000-0000-4000-8000-0000000000f2'), 1);

select pg_temp.expect_count('prof: NÃO vê notificação do member (isolamento)',
  pg_temp.fx('prof'),
  format('select count(*) from public.social_notifications where id = %L', 'f0000000-0000-4000-8000-0000000000f1'), 0);

-- Master: vê a PRÓPRIA notificação (é uma usuária como qualquer outra
-- aqui), mas NÃO tem bypass de plataforma — regra real do projeto
-- (diferente de subscription_payouts/product_payouts, onde is_master()
-- dá visão de tudo).
select pg_temp.expect_count('master: vê a própria notificação',
  pg_temp.fx('master'),
  format('select count(*) from public.social_notifications where id = %L', 'f0000000-0000-4000-8000-0000000000f3'), 1);

select pg_temp.expect_count('master: NÃO vê notificação do member (sem bypass de plataforma)',
  pg_temp.fx('master'),
  format('select count(*) from public.social_notifications where id = %L', 'f0000000-0000-4000-8000-0000000000f1'), 0);

select pg_temp.expect_count('master: NÃO vê notificação do prof (sem bypass de plataforma)',
  pg_temp.fx('master'),
  format('select count(*) from public.social_notifications where id = %L', 'f0000000-0000-4000-8000-0000000000f2'), 0);

-- anon não vê nada
select pg_temp.expect_locked('anon: NÃO vê social_notifications',
  null,
  'select count(*) from public.social_notifications');

-- ================= UPDATE — só marca a PRÓPRIA como lida ==============

select pg_temp.expect_write('member: marca a própria notificação como lida -> PERMITIDO',
  pg_temp.fx('member'),
  format('update public.social_notifications set read_at = now() where id = %L',
         'f0000000-0000-4000-8000-0000000000f1'), true);

select pg_temp.expect_write('member: marca notificação do prof como lida -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.social_notifications set read_at = now() where id = %L',
         'f0000000-0000-4000-8000-0000000000f2'), false);

select pg_temp.expect_write('prof: marca notificação do member como lida -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('update public.social_notifications set read_at = now() where id = %L',
         'f0000000-0000-4000-8000-0000000000f1'), false);

select pg_temp.expect_write('master: marca notificação do member como lida -> BLOQUEADO (sem bypass)',
  pg_temp.fx('master'),
  format('update public.social_notifications set read_at = now() where id = %L',
         'f0000000-0000-4000-8000-0000000000f1'), false);

-- WITH CHECK: member não consegue "roubar" a notificação do prof
-- reatribuindo profile_id para si mesma.
select pg_temp.expect_write('member: tenta reatribuir profile_id da notificação do prof -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.social_notifications set profile_id = %L where id = %L',
         pg_temp.fx('member'), 'f0000000-0000-4000-8000-0000000000f2'), false);

-- ================= INSERT/DELETE — só gatilhos/service_role ============
-- Sem GRANT de INSERT/DELETE para authenticated (nem policy) — qualquer
-- tentativa direta é barrada antes mesmo de chegar a uma policy.

select pg_temp.expect_write('member: INSERT direto para si mesma -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.social_notifications (profile_id, type, title) values (%L,''post_comment'',''forjada'')',
         pg_temp.fx('member')), false);

select pg_temp.expect_write('member: INSERT forjando notificação para o prof -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.social_notifications (profile_id, type, title) values (%L,''post_comment'',''forjada'')',
         pg_temp.fx('prof')), false);

select pg_temp.expect_write('member: DELETE da própria notificação -> BLOQUEADO',
  pg_temp.fx('member'),
  format('delete from public.social_notifications where id = %L',
         'f0000000-0000-4000-8000-0000000000f1'), false);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
