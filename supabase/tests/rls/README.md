# Suíte de Testes de RLS do Círcula — Fase 12.1

Rede de regressão **permanente** para as políticas de Row-Level Security do
Círcula. Protege o endurecimento feito na Fase 12 (em especial a 12.4 —
narrowing do Master) e serve de contrato executável para as subfases
seguintes (12.2 billing, 12.3 discovery, …).

## O que ela garante

- **Não altera schema.** Não é uma migration. Não roda `db push`.
- **Não altera dados reais.** Cada cenário roda em **uma transação
  encerrada em `ROLLBACK`**. Escritas que *deveriam* passar também são
  desfeitas (via `raise 'RLSSUITE_OK'`, que rola o savepoint implícito do
  bloco PL/pgSQL). Fixtures sintéticas (comunidades B/C) são criadas
  dentro da transação e somem no rollback.
- **Reproduzível e idempotente.** Rodar N vezes seguidas deixa o banco
  byte-idêntico. Verificado: após 3 execuções, todas as contagens e
  status voltam ao valor original e não sobra nenhuma linha `[rls-suite]`.
- **Testa o caminho real da API.** As personas são simuladas com
  `set_config('request.jwt.claims', …)` + `set local role authenticated`
  (ou `anon`) — exatamente o que o PostgREST faz numa chamada REST
  autenticada. Testar aqui == testar a API direta (`supabase-js`,
  `curl`, etc.).

## Como rodar

Pré-requisitos: Node 18+, Supabase CLI (via `npx`), projeto já linkado
(`npx supabase link`). A suíte roda contra o **projeto LINKED** (produção)
— seguro, porque tudo é rollback.

```bash
supabase/tests/rls/run.sh            # roda a suíte inteira
supabase/tests/rls/run.sh 30         # só cenários cujo nome contém "30"
supabase/tests/rls/run.sh --json     # imprime o JSON agregado ao final
node supabase/tests/rls/run.mjs      # equivalente (run.sh é só um wrapper)
```

Exit code: **0** se todas as asserções non-gap passam; **1** em qualquer
falha real (ou fixtures inválidas, ou erro de execução). Falhas marcadas
`[GAP]` são reportadas à parte e **não** derrubam o exit code.

## Estrutura

| Arquivo | Papel |
|---|---|
| `_framework.sql` | Helpers reutilizáveis. É **concatenado** por `run.mjs` antes de cada cenário. Abre `begin;`, cria as temp tables `_r` (resultados) e `_fx` (fixtures), define `pg_temp.as_persona/as_anon/done` e as asserções `expect_count / expect_bool / expect_locked / expect_write / expect_rpc`. Não fecha a transação — o cenário faz isso. |
| `00_fixtures_check.sql` | Standalone, read-only. Confere que todos os UUIDs base existem, que os sintéticos **não** pré-existem e que a migration 12.4 está aplicada. Se falhar, a suíte aborta (os outros cenários dariam falso positivo). |
| `10_member_active.sql` | Persona **Member ativo**. |
| `20_member_blocked.sql` | Persona **Member bloqueado** (2 modelos de bloqueio). |
| `30_professional.sql` | Persona **Professional** dona da comunidade. |
| `40_master.sql` | Persona **Master** (pós-12.4). |
| `50_isolation_bypass_rpc.sql` | Transversais: isolamento entre comunidades, UUID inexistente, `anon`, bypass via API, RPC / `SECURITY DEFINER` / escalada. |
| `run.mjs` / `run.sh` | Runner: concatena framework + cenário, executa via `supabase db query --linked`, lê o array `results` e imprime PASS/FAIL/GAP + resumo + exit code. |

Cada cenário termina, obrigatoriamente, com:

```sql
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
```

(`supabase db query` devolve só o resultado da **última** instrução — por
isso o `jsonb_agg` vem por último, logo antes do `rollback`.)

## Personas (fixtures reais)

| Persona | profile_id | Papel |
|---|---|---|
| `master` | `18004064-…` | role=master, não é dono de nenhuma comunidade |
| `prof` | `1c20d81a-…` | role=professional, **dono da comunidade A** ("Fluir & Florescer") |
| `member` | `94bc64f8-…` | role=member, **membro ativo de A**, participante do desafio |

Comunidade **A** = `077aeceb-…` (real, `is_discoverable=true`).
Comunidades **B** / **C** = sintéticas, criadas e destruídas na transação.
Por causa do `UNIQUE(communities.owner_id)`, o dono da sintética varia por
cenário (nunca o Prof, que já é dono de A; nunca a própria persona sob
teste, senão `owns_community()` liberaria o acesso).

## Tabelas e políticas cobertas

`posts`, `post_comments`, `post_reactions`, `profiles`, `community_members`,
`community_content`, `joy_moments`, `challenge_progress`,
`challenge_completions`, `communities`, `community_challenges`,
`subscriptions`, `daily_mood_entries`, `help_requests`, `saved_items`,
`checkin_responses`, `point_ledger`, `messages` — SELECT / INSERT /
UPDATE / DELETE conforme aplicável, mais os GRANTs de tabela do role
`authenticated` (que são a primeira trava, antes da RLS) e as funções
`SECURITY DEFINER`: `can_view_post`, `owns_community`, `is_master`,
`is_community_member`, `platform_overview/communities/professionals`,
`community_metrics`, `community_participants_overview`,
`community_posts_moderation`, `moderate_post`.

## Gaps conhecidos (esperados hoje, fechados por subfases futuras)

Marcados `[GAP]` no código (`p_gap => true`). A suíte os reporta em
separado e **não** falha por causa deles.

| Gap | Fecha em |
|---|---|
| Member com `subscriptions.status='blocked'` mas `community_members.status='active'` **ainda lê e escreve** conteúdo pago (a RLS de conteúdo olha só `community_members.status`, não a assinatura). | **12.2** — trigger que sincroniza `subscriptions.status` → `community_members.status`. Quando entrar, os 2 testes `[GAP]` de `20_member_blocked.sql` viram PASS sozinhos. |

## Notas de arquitetura descobertas pela suíte (não são bugs)

- O role `authenticated` **não** tem GRANT `UPDATE`/`DELETE` em
  `community_members`, nem `DELETE` em `communities`. Logo as policies
  `community_members_update/_delete` e `communities_delete` (que citam
  `is_master()` / `owns_community()`) ficam **inalcançáveis pelo cliente**
  — gestão de membros e remoção de comunidade são server-side
  (service_role / webhook). É uma trava a mais.
- `posts` não tem GRANT `UPDATE`/`DELETE` para `authenticated`: edição/
  remoção de post é só via RPC `moderate_post` (dona/Master).
- O `anon` não tem GRANT `SELECT` na maioria das tabelas: a leitura
  anônima é barrada com `permission denied` antes da RLS. Descoberta
  pública de comunidades, quando existir, será por RPC própria.
- O trigger `prevent_role_escalation` deixa o `UPDATE … set role=…`
  "passar" (afeta 1 linha) mas reverte o valor silenciosamente — por
  isso o teste de escalada do Member espera `ALLOWED` e confirma logo
  depois que `role` continua `member`.

## Quando um teste falhar

1. **`00_fixtures_check` falhou** → os UUIDs base mudaram no banco.
   Atualize o bloco `_fx` em `_framework.sql` e as contagens esperadas.
2. **Falha real num cenário** → uma policy ou GRANT mudou. Ou é
   regressão (conserte a policy) ou é mudança intencional (ajuste a
   asserção e documente aqui).
3. **`erro de execução` num cenário** → veja a mensagem; normalmente é
   uma coluna `NOT NULL` nova numa tabela usada em fixture, ou o
   `UNIQUE(owner_id)` batendo (dono sintético errado).
