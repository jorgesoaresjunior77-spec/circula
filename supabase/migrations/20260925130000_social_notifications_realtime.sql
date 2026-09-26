-- =====================================================================
-- Notificações sociais — habilita Realtime
-- =====================================================================
-- Contexto: `social_notifications` já é gerada inteiramente no banco
-- (6 triggers AFTER INSERT cobrindo comentário, reação, entrada em
-- círculo, RSVP, comentário de desafio e mensagem direta — migration
-- `20260831150000_social_notifications.sql` + `20260831170000` +
-- `20260923120000`). O que falta é só a ENTREGA em tempo real: hoje o
-- sino (`NotificationBell`/`useSocialNotifications`) só busca de novo
-- no mount e ao abrir o painel — uma notificação nova só aparece depois
-- que a usuária reabre manualmente.
--
-- `public.messages` já está na publicação `supabase_realtime` desde a
-- `20260831170000_messages_notifications_realtime.sql`, e o padrão de
-- subscription no cliente (`useConversations.ts`) já está validado em
-- produção. Esta migration replica exatamente o mesmo passo de infra
-- para `social_notifications`: só inclui a tabela na publicação.
--
-- Não cria/altera tabela, coluna, função ou policy. A RLS de
-- `social_notifications_select` (profile_id = auth.uid()) já existente
-- continua sendo o que decide o que cada subscription recebe — Realtime
-- respeita RLS na entrega, mesma garantia que já vale para `messages`.
--
-- Idempotente, aditivo, reversível (rodapé).
-- =====================================================================

begin;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'social_notifications'
     )
  then
    execute 'alter publication supabase_realtime add table public.social_notifications';
  end if;
end $$;

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- alter publication supabase_realtime drop table public.social_notifications;
-- commit;
-- =====================================================================
