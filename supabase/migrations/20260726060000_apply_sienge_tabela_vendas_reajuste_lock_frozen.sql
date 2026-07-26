-- Trava: o reajuste de INCC nunca deve afetar unidades já vendidas ou permutadas
-- (preço congelado). Reaplica a função inteira com o filtro adicional.
create or replace function public.apply_sienge_tabela_vendas_reajuste(
  p_project_id text,
  p_unidade_ids uuid[],
  p_percentual numeric,
  p_descricao text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revisao_id uuid;
  v_numero int;
  v_unidades text[];
  v_count int;
begin
  select array_agg(unidade order by unidade), count(*) into v_unidades, v_count
  from sienge_tabela_vendas
  where project_id = p_project_id
    and situacao in ('disponivel', 'bloqueada')
    and (p_unidade_ids is null or id = any(p_unidade_ids));

  select coalesce(max(numero), 0) + 1 into v_numero
  from sienge_tabela_vendas_revisoes where project_id = p_project_id;

  insert into sienge_tabela_vendas_revisoes
    (project_id, numero, tipo, percentual, unidades_afetadas, unidades, descricao)
  values
    (p_project_id, v_numero, case when p_unidade_ids is null then 'geral' else 'seletiva' end,
     p_percentual, coalesce(v_count, 0), v_unidades, p_descricao)
  returning id into v_revisao_id;

  update sienge_tabela_vendas
  set valor_tabela = round(valor_tabela * (1 + p_percentual / 100), 2),
      updated_at = now()
  where project_id = p_project_id
    and situacao in ('disponivel', 'bloqueada')
    and (p_unidade_ids is null or id = any(p_unidade_ids));

  return v_revisao_id;
end;
$$;
