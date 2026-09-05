#!/usr/bin/env bash
# Runner da Suíte de Testes de RLS do Círcula (Fase 12.1).
# Fina camada sobre run.mjs — ver README.md.
#
#   ./run.sh            roda a suíte inteira
#   ./run.sh 30         roda só o(s) cenário(s) cujo nome contém "30"
#   ./run.sh --json     imprime o JSON agregado ao final
#
# Requer: Node 18+, Supabase CLI (via npx), projeto já linkado
# (`npx supabase link`). Não altera schema nem dados: cada cenário roda
# numa transação encerrada em ROLLBACK.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/run.mjs" "$@"
