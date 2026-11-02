#!/usr/bin/env bash
# =====================================================================
# Teste de CONCORRÊNCIA real — limite diário do motor de pontos
# (correção pós-auditoria, achado B: pg_advisory_xact_lock em
# _garden_award_points / _garden_recompute_completion, migration
# 20261030140000 v2).
# =====================================================================
# NÃO EXECUTÁVEL até a migration 20261030140000 ser aplicada no banco
# alvo — escrito e revisado nesta etapa, pendente de autorização.
#
# POR QUE ESTE TESTE NÃO USA O FRAMEWORK DE RLS (_framework.sql) — o
# framework roda CADA cenário como UMA transação só (uma conexão),
# terminando em ROLLBACK: perfeito para RLS, mas estruturalmente
# incapaz de testar uma corrida real entre DUAS conexões simultâneas.
# Este script abre conexões DE VERDADE em paralelo (processos `supabase
# db query --linked` em background) contra o PERFIL REAL `member` e a
# COMUNIDADE REAL `commA` (os mesmos fixtures fixos de _framework.sql)
# — grava e SEMPRE limpa depois (trap), mesmo se o teste falhar no meio.
#
# Diferente de TODOS os outros arquivos desta pasta: este FAZ COMMIT de
# verdade (ainda que limpe em seguida) — por isso não roda
# automaticamente via run.sh/run.mjs. Só rode manualmente, só depois da
# migration 20261030140000 estar aplicada, só com autorização.
#
# O QUE PROVA: dispara 5 comentários (fonte com limite diário = 3) no
# MESMO post real, em paralelo verdadeiro, pela mesma participante. Sem
# o advisory lock, duas requisições quase simultâneas poderiam ler a
# mesma contagem "ainda 2 de 3" antes de qualquer uma comitar, e as duas
# passariam — ultrapassando o limite. Com o lock, no máximo 3 das 5
# tentativas pontuam, nunca mais.
#
# Uso:
#   cd "C:\Users\jorge\Desktop\Circula"
#   bash supabase/tests/rls/concurrency_garden_daily_cap.sh
# =====================================================================
set -euo pipefail

MEMBER_ID="51008487-ee5e-4a15-86c9-d10a05596b08"
POST_ID="5d5b9f92-cc21-43df-856d-7f0e7b27c33d"   # postA — autor = prof, comunidade = commA
COMMUNITY_ID="077aeceb-7321-48ca-8c23-cb256823755a"
ATTEMPTS=5
DAILY_CAP=3
CREATED_IDS_FILE="$(mktemp)"

cleanup() {
  echo "Limpando comentários de teste criados..."
  if [ -s "$CREATED_IDS_FILE" ]; then
    local ids
    ids=$(paste -sd, "$CREATED_IDS_FILE")
    # DELETE dispara o gatilho de estorno (trg_garden_points_reverse_on_comment_delete)
    # — os pontos concedidos também são desfeitos automaticamente aqui.
    npx supabase db query --linked \
      "delete from public.post_comments where id in ($ids) and author_id = '$MEMBER_ID';" \
      >/dev/null 2>&1 || echo "AVISO: limpeza pode ter falhado parcialmente — verifique manualmente post_comments/garden_monthly_points para author_id=$MEMBER_ID."
  fi
  rm -f "$CREATED_IDS_FILE"
}
trap cleanup EXIT

echo "Baseline — pontos de 'comment' hoje, antes do teste:"
BASELINE=$(npx supabase db query --linked \
  "select count(*) from public.garden_monthly_points where profile_id='$MEMBER_ID' and community_id='$COMMUNITY_ID' and source='comment' and reversed_at is null and created_at >= date_trunc('day', now());" \
  2>/dev/null | grep -o '"count":"[0-9]*"' | grep -o '[0-9]*' || echo "0")
echo "  -> $BASELINE"

echo "Disparando $ATTEMPTS comentários em PARALELO real (limite diário = $DAILY_CAP)..."
PIDS=()
for i in $(seq 1 "$ATTEMPTS"); do
  (
    ID=$(npx supabase db query --linked \
      "insert into public.post_comments (post_id, author_id, content) values ('$POST_ID','$MEMBER_ID','[concurrency-test] tentativa $i') returning id;" \
      2>/dev/null | grep -o '"id":"[a-f0-9-]*"' | grep -o '[a-f0-9-]\{36\}')
    echo "$ID" >> "$CREATED_IDS_FILE"
  ) &
  PIDS+=($!)
done
for pid in "${PIDS[@]}"; do wait "$pid"; done

echo "Pontos de 'comment' hoje, depois do teste:"
AFTER=$(npx supabase db query --linked \
  "select count(*) from public.garden_monthly_points where profile_id='$MEMBER_ID' and community_id='$COMMUNITY_ID' and source='comment' and reversed_at is null and created_at >= date_trunc('day', now());" \
  2>/dev/null | grep -o '"count":"[0-9]*"' | grep -o '[0-9]*' || echo "0")
echo "  -> $AFTER"

DELTA=$((AFTER - BASELINE))
echo "Delta de pontos concedidos nesta corrida: $DELTA (esperado: <= $DAILY_CAP, nunca $ATTEMPTS)"

if [ "$DELTA" -le "$DAILY_CAP" ]; then
  echo "PASSOU — o limite diário resistiu à concorrência real."
  exit 0
else
  echo "FALHOU — $DELTA pontos concedidos, acima do limite diário de $DAILY_CAP. A corrida NÃO foi evitada."
  exit 1
fi
