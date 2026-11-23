-- Conferência (NÃO altera nada): pedidos de Círculo que já tiveram decisão (reviewed_at preenchido)
-- mas continuam com status 'pending'. Se a lista vier vazia, não há nada para corrigir.
select id, community_id, suggested_name, status, reviewed_at, reviewed_by, created_at
from public.circle_requests
where status = 'pending' and reviewed_at is not null
order by reviewed_at;

-- Correção (só depois de conferir a lista acima; idempotente: rodar de novo não muda mais nada).
-- Marca como 'approved' os que foram decididos mas ficaram em 'pending'.
-- Se algum deles foi recusado de fato, troque 'approved' por 'rejected' para esse id.
-- update public.circle_requests set status = 'approved'
-- where status = 'pending' and reviewed_at is not null;
