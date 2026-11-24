-- Carro em Dia: o filtro de placa pegava "Ano 2014". Placa é ABC-1234, ABC1234 ou ABC1D23 (sem espaço no meio).
create or replace function public.car_clean_text(p text)
returns text language sql immutable set search_path to 'public' as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p, ''),
          '\m[A-Za-z]{3}-?([0-9]{4}|[0-9][A-Za-z][0-9]{2})\M', '[placa removida]', 'g'),
        '(\(?\d{2}\)?[\s.-]?)?9?\d{4}[\s.-]?\d{4}', '[telefone removido]', 'g'),
      '\d{3}\.?\d{3}\.?\d{3}-?\d{2}', '[CPF removido]', 'g'));
$$;
