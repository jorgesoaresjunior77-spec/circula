-- Carro em Dia: categorias de serviços automotivos em "Na minha cidade".
-- Só cria as CATEGORIAS que faltavam (nenhum estabelecimento): quem aparece em cada uma são os
-- profissionais e lugares realmente cadastrados no Círcula. Idempotente.
begin;

insert into public.city_categories (nome, nome_normalizado, grupo, status)
select v.nome, v.norm, 'carros', 'ativa'
from (values
  ('Concessionárias', 'concessionaria'),
  ('Lojas de veículos', 'loja de veiculo'),
  ('Lojas de pneus', 'loja de pneu'),
  ('Centro automotivo', 'centro automotivo'),
  ('Serviços de bateria', 'servico de bateria'),
  ('Troca de óleo', 'troca de oleo'),
  ('Estética automotiva', 'estetica automotiva'),
  ('Guincho', 'guincho'),
  ('Despachante', 'despachante'),
  ('Peças e acessórios', 'peca e acessorio')
) as v(nome, norm)
where not exists (select 1 from public.city_categories c where c.nome_normalizado = v.norm);

commit;
-- ROLLBACK (manual): delete from public.city_categories where nome_normalizado in ('concessionaria','loja de veiculo','loja de pneu','centro automotivo','servico de bateria','troca de oleo','estetica automotiva','guincho','despachante','peca e acessorio') and not exists (select 1 from public.city_places where categoria_id = city_categories.id);
