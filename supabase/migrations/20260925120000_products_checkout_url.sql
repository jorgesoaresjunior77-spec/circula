-- =====================================================================
-- Loja — V1 integração Hotmart: checkout externo para ebook/course
-- =====================================================================
-- Adiciona SOMENTE a coluna checkout_url a public.products. Opcional
-- (nullable), sem default. Quando preenchida, o frontend abre esse link
-- diretamente (ver ProductCard.tsx) em vez de acionar o fluxo Asaas —
-- decisão tomada só no cliente; nada aqui muda product_orders,
-- product_entitlements, product_payouts, RPCs ou RLS existente.
--
-- FORA de escopo (permanece como está): tipos elegíveis (ebook/course é
-- regra de formulário em ProductManager, não constraint de banco — dá
-- para ampliar depois sem nova migration), qualquer integração/API/
-- webhook Hotmart, sincronização de preço ou de vendas.
--
-- Idempotente: add column if not exists / drop constraint if exists +
-- add constraint.
-- =====================================================================

begin;

alter table public.products
  add column if not exists checkout_url text;

-- Só valida FORMATO (https://) quando preenchido; não amarra a domínio
-- específico da Hotmart, então serve para qualquer checkout externo
-- futuro sem precisar de nova migration.
alter table public.products
  drop constraint if exists products_checkout_url_https_check;

alter table public.products
  add constraint products_checkout_url_https_check
  check (checkout_url is null or checkout_url ~* '^https://');

commit;
