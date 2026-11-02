-- =====================================================================
-- Etapa 8/9 (evolução/experiência/gamificação) — Onboarding e Tour guiado
-- =====================================================================
-- NÃO APLICADA — preparada nesta etapa, aguardando autorização explícita
-- do usuário antes de rodar contra o banco remoto (Etapa 10).
--
-- v2 (pós-auditoria) — corrige o achado "precisa de correção" da
-- auditoria anterior: sem backfill, TODA conta já existente (qualquer
-- role) nasceria com `onboarding_completed_at = NULL` ao aplicar esta
-- migration — e o gate em Dashboard.tsx
-- (`profile.role === 'member' && profile.onboarding_completed_at ===
-- null`) é exatamente a condição de "primeira vez". Resultado sem a
-- correção: toda Member já cadastrada veria o onboarding pipocar no
-- próximo login, contradizendo o pedido original ("quando uma mulher
-- ingressar... PELA PRIMEIRA VEZ").
--
-- Escopo do backfill — só `role = 'member'`, não todos os perfis:
--   • o próprio gate em Dashboard.tsx já é `role === 'member'` — só
--     Member decide mostrar o onboarding; Professional e Master NUNCA
--     são afetados por este campo, aplicado o backfill ou não;
--   • onboarding é um conceito de Member por natureza (as perguntas —
--     "o que te fez entrar na comunidade", "quais assuntos te
--     interessam" — não fazem sentido para quem administra a
--     comunidade) — gravar `onboarding_completed_at = now()` numa conta
--     Professional/Master estaria afirmando algo falso (que ela "já
--     concluiu" um fluxo que nunca foi dela), por um campo que nem
--     precisava ser preenchido para o produto funcionar;
--   • `tour_completed_at` segue o mesmo escopo (`role = 'member'`) só
--     por consistência semântica com `onboarding_completed_at` — o tour
--     nunca é disparado sozinho (só manualmente, via "Rever o tour", ou
--     como continuação do onboarding), então não tinha risco de bug
--     igual ao do onboarding independente do escopo escolhido aqui.
-- Toda conta nova (qualquer role) criada DEPOIS desta migration nasce
-- com as 2 colunas em NULL (nenhum DEFAULT além do `jsonb '{}'` de
-- onboarding_answers) — uma Member nova continua recebendo o
-- onboarding normalmente, sem nenhuma mudança adicional de código.
--
-- 3 colunas novas em `profiles`, 100% aditivas:
--   onboarding_answers      jsonb  — respostas livres do onboarding
--                                    (ver OnboardingAnswers, profile.ts).
--                                    Os "assuntos de interesse" do
--                                    onboarding NÃO moram aqui — são
--                                    gravados em `profiles.interests`
--                                    (coluna já existente, mesmo array
--                                    de "Um pouco sobre mim") — sem
--                                    duplicar estrutura.
--   onboarding_completed_at timestamptz — `null` = ainda não concluiu
--                                    (ou pulou) o onboarding.
--   tour_completed_at       timestamptz — `null` = ainda não concluiu
--                                    (ou pulou) o tour guiado.
-- Nenhuma RLS nova: `profiles` já tem policy de UPDATE restrita à
-- própria dona (auth.uid() = id) — as 3 colunas novas entram sob a
-- MESMA policy, sem alteração nela.
--
-- 100% aditivo, idempotente, transacional, reversível.
-- =====================================================================

begin;

alter table public.profiles add column if not exists onboarding_answers jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;
alter table public.profiles add column if not exists tour_completed_at timestamptz;

-- ---- Backfill (correção pós-auditoria) -------------------------------
-- Só `role = 'member'` (ver justificativa no cabeçalho). `coalesce` é
-- defensivo (idempotência em caso de reaplicação manual) — na prática,
-- a coluna acabou de nascer, então é sempre NULL para toda linha aqui.
update public.profiles
  set onboarding_completed_at = coalesce(onboarding_completed_at, now()),
      tour_completed_at = coalesce(tour_completed_at, now())
  where role = 'member';

commit;

-- ---- Rollback (manual) ------------------------------------------
-- begin;
-- alter table public.profiles drop column if exists tour_completed_at;
-- alter table public.profiles drop column if exists onboarding_completed_at;
-- alter table public.profiles drop column if exists onboarding_answers;
-- commit;
