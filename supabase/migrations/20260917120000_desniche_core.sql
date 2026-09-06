-- =====================================================================
-- FASE 16.1-D — Des-nicho do núcleo do Círcula
-- =====================================================================
-- Duas regras de produto novas:
--   1. O núcleo do Círcula é AGNÓSTICO AO NICHO. Nada específico de
--      nutrição/alimentação vive no produto base.
--   2. (tratada em outra etapa) Cada Professional define o preço da
--      própria comunidade.
--
-- Esta migration remove do BANCO os dois artefatos de nicho:
--
--   A) `community_content.type = 'recipe'`
--      - "Receita" deixa de ser um tipo de conteúdo de primeira classe.
--      - Conteúdo de receita continua podendo existir como conteúdo
--        genérico da Professional (type 'material'/'article') ou como
--        produto da Loja (e-book etc.) — a Loja NÃO é tocada.
--      - Verificação read-only ANTES desta migration (2026-09-06):
--          community_content total .................. 2 linhas
--          community_content type='recipe' .......... 1 linha
--          community_content ingredients not null ... 1 linha
--      - A linha existente NÃO é apagada: é convertida para
--        type='material', com os ingredientes preservados dentro de
--        `body` (append). Depois `ingredients` volta a NULL.
--      - A coluna `ingredients` (aditiva, migration `20260902120000`)
--        NÃO é removida aqui (drop de coluna é destrutivo). Ela fica
--        nullable e 100% vazia; um drop seguro pode ser feito numa
--        etapa futura, depois de confirmado que nada mais a lê.
--      - O CHECK `community_content_type_check` é recriado SEM 'recipe'.
--
--   B) `help_requests.audience = 'nutri'`
--      - Renomeado para o termo genérico 'professional' (o pedido é
--        "para a responsável pela comunidade").
--      - Verificação read-only ANTES desta migration (2026-09-06):
--          help_requests total .................. 1 linha
--          help_requests audience='nutri' ...... 0 linhas
--          help_requests audience='community' .. 1 linha
--      - O UPDATE é defensivo (nenhuma linha 'nutri' hoje) e roda ANTES
--        da troca do CHECK, então é seguro mesmo se surgir alguma linha.
--      - O CHECK `help_requests_audience_check` é recriado como
--        ('professional','community'). O valor 'community' é preservado.
--      - As policies de `help_requests` filtram por `audience='community'`
--        (que continua igual) — NENHUMA policy muda. O trigger
--        `notify_on_help_request` não olha `audience` — não muda.
--
-- NÃO altera: RLS/policies, GRANTs, billing, subscriptions, payment_charges,
-- Asaas, Split, Loja (products/product_orders/product_payouts), Storage,
-- autenticação, `platform_overview()` (segue emitindo `recipes_published`
-- e `communities_with_recipes` = 0 — vestigial e inofensivo; limpeza
-- adiada porque a função também lê billing, que está congelado).
--
-- Transacional. Idempotente o suficiente para reexecução
-- (drop constraint if exists + add). Reversível (rodapé).
-- =====================================================================

begin;

-- ---- A) community_content: converte 'recipe' -> 'material' -----------
update public.community_content
set body = case
             when ingredients is null or btrim(ingredients) = '' then body
             when body is null or btrim(body) = ''
               then 'Ingredientes:' || chr(10) || ingredients
             else body || chr(10) || chr(10) || 'Ingredientes:' || chr(10) || ingredients
           end,
    type = 'material',
    ingredients = null
where type = 'recipe';

alter table public.community_content
  drop constraint if exists community_content_type_check;

alter table public.community_content
  add constraint community_content_type_check check (
    type = any (array[
      'article'::text, 'tip'::text,
      'material'::text, 'video'::text, 'educational'::text
    ])
  );

-- ---- B) help_requests: audience 'nutri' -> 'professional' ------------
update public.help_requests
set audience = 'professional'
where audience = 'nutri';

alter table public.help_requests
  drop constraint if exists help_requests_audience_check;

alter table public.help_requests
  add constraint help_requests_audience_check check (
    audience = any (array['professional'::text, 'community'::text])
  );

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- alter table public.help_requests drop constraint if exists help_requests_audience_check;
-- alter table public.help_requests
--   add constraint help_requests_audience_check
--   check (audience = any (array['nutri'::text, 'community'::text]));
-- update public.help_requests set audience = 'nutri' where audience = 'professional';
--
-- alter table public.community_content drop constraint if exists community_content_type_check;
-- alter table public.community_content
--   add constraint community_content_type_check
--   check (type = any (array['recipe'::text,'article'::text,'tip'::text,
--                            'material'::text,'video'::text,'educational'::text]));
-- -- (a conversão recipe->material NÃO é revertida automaticamente:
-- --  os ingredientes já estão dentro de `body`.)
-- commit;
-- =====================================================================
