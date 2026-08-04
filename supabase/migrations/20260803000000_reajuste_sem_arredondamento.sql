-- =============================================================================
-- Reajuste de tabela de vendas deixa de arredondar a 2 casas decimais.
-- -----------------------------------------------------------------------------
-- valor_tabela e campos_extra (colunas moeda/número) já são `numeric`/`jsonb`
-- sem escala fixa — o `round(..., 2)` aplicado ao gravar o reajuste era o único
-- ponto do fluxo que truncava precisão de verdade, e não deveria: o valor deve
-- carregar toda a precisão do cálculo (percentual × valor), a exibição de 2
-- casas é só uma escolha de apresentação (ver SiengeVendasTable, que agora tem
-- toggle para 8 casas). Reaplica a função da migration anterior
-- (20260802060000_reajuste_colunas_selecionaveis.sql) só trocando os dois
-- `round(..., 2)` por multiplicação direta.
-- =============================================================================

create or replace function public.apply_sienge_tabela_vendas_reajuste(
  p_project_id text,
  p_unidade_ids uuid[],
  p_percentual numeric,
  p_descricao text default null,
  p_motivo text default null,
  p_colunas text[] default null
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
  v_snapshot jsonb;
  v_colunas text[] := case when p_colunas is null or array_length(p_colunas, 1) is null
                       then array['valor_tabela'] else p_colunas end;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'O motivo da alteração é obrigatório.';
  end if;

  -- Sem filtro de situação: todas as unidades do empreendimento (ou as
  -- selecionadas) são reajustadas, vendidas e em permuta inclusive.
  select array_agg(unidade order by unidade), count(*) into v_unidades, v_count
  from sienge_tabela_vendas
  where project_id = p_project_id
    and (p_unidade_ids is null or id = any(p_unidade_ids));

  select jsonb_agg(jsonb_build_object(
           'id', id, 'valor_tabela', valor_tabela, 'campos_extra', campos_extra
         ))
    into v_snapshot
    from sienge_tabela_vendas
   where project_id = p_project_id;

  select coalesce(max(numero), 0) + 1 into v_numero
  from sienge_tabela_vendas_revisoes where project_id = p_project_id;

  insert into sienge_tabela_vendas_revisoes
    (project_id, numero, tipo, percentual, unidades_afetadas, unidades, descricao, motivo, snapshot, colunas)
  values
    (p_project_id, v_numero, case when p_unidade_ids is null then 'geral' else 'seletiva' end,
     p_percentual, coalesce(v_count, 0), v_unidades, p_descricao, btrim(p_motivo),
     coalesce(v_snapshot, '[]'::jsonb), v_colunas)
  returning id into v_revisao_id;

  update sienge_tabela_vendas
  set valor_tabela = case when 'valor_tabela' = any(v_colunas)
                       then valor_tabela * (1 + p_percentual / 100)
                       else valor_tabela end,
      campos_extra = (
        select coalesce(jsonb_object_agg(
                 e.key,
                 case
                   when e.key = any(v_colunas) and (e.value #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$'
                     then to_jsonb((e.value #>> '{}')::numeric * (1 + p_percentual / 100))
                   else e.value
                 end
               ), '{}'::jsonb)
          from jsonb_each(campos_extra) as e(key, value)
      ),
      updated_at = now()
  where project_id = p_project_id
    and (p_unidade_ids is null or id = any(p_unidade_ids));

  return v_revisao_id;
end;
$$;
