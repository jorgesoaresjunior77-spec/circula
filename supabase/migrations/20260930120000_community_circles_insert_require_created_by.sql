-- =====================================================================
-- community_circles — exige created_by = auth.uid() no INSERT
-- =====================================================================
-- Contexto (auditoria de RLS, etapa anterior a esta migration):
--   • `community_circles_insert` (`20260827000000_baseline_remote_schema`)
--     exigia só `owns_community(community_id)` no WITH CHECK. Nada
--     vinculava a coluna `created_by` a quem de fato executou o INSERT.
--   • Confirmado por execução real (auditoria de `community_circles` +
--     `circle_members`): a dona da comunidade conseguia criar um círculo
--     atribuindo `created_by` a QUALQUER `profile_id` válido, inclusive
--     um perfil sem nenhuma relação com o círculo.
--   • Impacto rastreado até o único consumidor real de `created_by`:
--     o trigger `notify_on_circle_join()` (`20260831150000_social_
--     notifications`), que lê `community_circles.created_by` para decidir
--     quem recebe a notificação "Nova participante no seu círculo" toda
--     vez que alguém entra no círculo. Autoria forjada = notificação
--     indevida para o perfil forjado. Sem evidência de escalada de
--     privilégio ou acesso a dado que a dona já não tivesse — só a
--     própria dona da comunidade pode forjar (nunca um member comum,
--     que já é bloqueado no INSERT por `owns_community()`).
--   • Mesmo padrão já usado em `community_engagement_commands_insert`
--     (`created_by = auth.uid()` já exigido ali desde a criação) e em
--     `help_request_replies_insert` (`profile_id = auth.uid()`) — esta
--     migration só alinha `community_circles` ao padrão que já existe
--     no resto do projeto.
--
-- Escopo desta migration: SOMENTE o WITH CHECK do INSERT de
-- `community_circles`. Mantém intactos:
--   • `community_circles_select` / `_update` / `_delete` (inalteradas);
--   • `circle_members` (policies, grants, trigger — nada tocado);
--   • `notify_on_circle_join()` (inalterada);
--   • grants da tabela (`insert, select, update, delete` para
--     `authenticated`, preservados — a mudança é só no WITH CHECK);
--   • todas as demais tabelas/policies/RPCs do projeto.
--
-- Comportamento antes -> depois:
--   • dona + created_by = auth.uid()      -> ALLOWED  -> ALLOWED (sem mudança)
--   • dona + created_by de outro perfil   -> ALLOWED  -> BLOCKED (correção)
--   • member (não-dona)                   -> BLOCKED  -> BLOCKED (sem mudança,
--     já falhava em owns_community(), agora falha nas duas cláusulas)
--   • dona tentando criar em comunidade alheia -> BLOCKED -> BLOCKED (sem mudança)
--
-- Idempotente (`drop policy if exists` + `create policy`) e reversível
-- (rodapé).
-- =====================================================================

begin;

drop policy if exists "community_circles_insert" on public.community_circles;
create policy "community_circles_insert"
  on public.community_circles for insert to authenticated
  with check (
    owns_community(community_id)
    and created_by = auth.uid()
  );

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- drop policy if exists "community_circles_insert" on public.community_circles;
-- create policy "community_circles_insert"
--   on public.community_circles for insert to authenticated
--   with check (owns_community(community_id));
-- commit;
-- =====================================================================
