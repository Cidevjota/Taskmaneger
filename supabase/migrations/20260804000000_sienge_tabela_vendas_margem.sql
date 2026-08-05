-- =============================================================================
-- Margem: parte do valor que NÃO acompanha o reajuste.
-- -----------------------------------------------------------------------------
-- Até aqui um reajuste de X% multiplicava o valor inteiro. Na prática parte do
-- valor de uma unidade é custo fixo que não deve ser indexado (comissão travada,
-- taxa, parcela já negociada). A margem é esse pedaço congelado: o percentual
-- incide só sobre o resto e a margem volta somada por cima.
--
--   valor 100, margem 10, reajuste +10%
--   → (100 - 10) × 1,10 + 10 = 99 + 10 = 109
--
-- A margem é POR UNIDADE e POR COLUNA — `margens` é um jsonb com as mesmas keys
-- aceitas em p_colunas do reajuste ('valor_tabela' e keys de colunas extras),
-- então um reajuste que marca várias colunas desconta a margem de cada uma
-- separadamente. Coluna sem entrada em `margens` reajusta o valor cheio, que é
-- exatamente o comportamento anterior — a migration é retrocompatível.
-- =============================================================================

alter table public.sienge_tabela_vendas
  add column if not exists margens jsonb not null default '{}'::jsonb;

comment on column public.sienge_tabela_vendas.margens is
  'Parcela congelada do valor, por coluna: {"valor_tabela": 10, "adesao": 5}. O reajuste aplica o percentual só sobre (valor - margem) e soma a margem de volta.';

-- Leitura tolerante do jsonb: margem ausente, nula ou não-numérica vira 0 em vez
-- de estourar o cast no meio do UPDATE de reajuste da tabela inteira.
create or replace function public.sienge_margem_de(p_margens jsonb, p_key text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_margens is null then 0
    when coalesce(p_margens ->> p_key, '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then (p_margens ->> p_key)::numeric
    else 0
  end;
$$;

-- A margem é limitada ao próprio valor: margem maior que o valor congelaria mais
-- do que existe e o percentual passaria a incidir sobre uma base negativa,
-- diminuindo o valor num reajuste positivo. Nesse caso o valor inteiro fica
-- congelado — que é a leitura correta de "essa parte não reajusta".
create or replace function public.sienge_reajusta_com_margem(
  p_valor numeric,
  p_margem numeric,
  p_percentual numeric
) returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_valor is null then null
    else m + (p_valor - m) * (1 + p_percentual / 100)
  end
  from (select least(greatest(coalesce(p_margem, 0), 0), greatest(coalesce(p_valor, 0), 0)) as m) s;
$$;

-- Reaplica a função de reajuste (última versão em
-- 20260803000000_reajuste_sem_arredondamento.sql) trocando a multiplicação
-- direta pelo cálculo com margem. Sem margem cadastrada o resultado é idêntico
-- ao anterior. O snapshot passa a levar `margens` para que reverter uma revisão
-- devolva a tabela ao estado exato de antes do reajuste.
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
           'id', id, 'valor_tabela', valor_tabela, 'campos_extra', campos_extra,
           'margens', margens
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

  update sienge_tabela_vendas t
  set valor_tabela = case when 'valor_tabela' = any(v_colunas)
                       then sienge_reajusta_com_margem(
                              t.valor_tabela,
                              sienge_margem_de(t.margens, 'valor_tabela'),
                              p_percentual)
                       else t.valor_tabela end,
      campos_extra = (
        select coalesce(jsonb_object_agg(
                 e.key,
                 case
                   when e.key = any(v_colunas) and (e.value #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$'
                     then to_jsonb(sienge_reajusta_com_margem(
                            (e.value #>> '{}')::numeric,
                            sienge_margem_de(t.margens, e.key),
                            p_percentual))
                   else e.value
                 end
               ), '{}'::jsonb)
          from jsonb_each(t.campos_extra) as e(key, value)
      ),
      updated_at = now()
  where t.project_id = p_project_id
    and (p_unidade_ids is null or t.id = any(p_unidade_ids));

  return v_revisao_id;
end;
$$;

-- Reverter também devolve as margens vigentes na hora do reajuste. Revisões
-- antigas não têm a chave no snapshot; nesse caso `b.margens` vem null e o
-- coalesce mantém a margem atual em vez de zerá-la.
create or replace function public.reverter_sienge_tabela_vendas_revisao(
  p_revisao_id uuid
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rev public.sienge_tabela_vendas_revisoes%rowtype;
  v_afetadas int;
begin
  select * into v_rev from sienge_tabela_vendas_revisoes where id = p_revisao_id;
  if not found then
    raise exception 'Revisão não encontrada.';
  end if;
  if v_rev.snapshot is null or jsonb_array_length(v_rev.snapshot) = 0 then
    raise exception 'Esta revisão não tem backup e não pode ser revertida.';
  end if;

  update sienge_tabela_vendas u
     set valor_tabela = b.valor_tabela,
         campos_extra = b.campos_extra,
         margens = coalesce(b.margens, u.margens),
         updated_at = now()
    from jsonb_to_recordset(v_rev.snapshot)
      as b(id uuid, valor_tabela numeric, campos_extra jsonb, margens jsonb)
   where u.id = b.id
     and u.project_id = v_rev.project_id;

  get diagnostics v_afetadas = row_count;

  update sienge_tabela_vendas_revisoes
     set revertida_em = now()
   where id = p_revisao_id;

  return v_afetadas;
end;
$$;

-- Gravação em lote da margem de uma coluna. Um upsert por unidade a partir do
-- client custaria 124 round-trips numa tabela real; e a edição de margem quase
-- sempre é "essas N unidades passam a ter margem X".
-- p_valor nulo ou zero remove a key, mantendo `margens` enxuto — assim "sem
-- margem" e "margem zero" são o mesmo estado, sem key órfã sobrando.
create or replace function public.set_sienge_tabela_vendas_margem(
  p_project_id text,
  p_unidade_ids uuid[],
  p_coluna text,
  p_valor numeric
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afetadas int;
begin
  if p_coluna is null or btrim(p_coluna) = '' then
    raise exception 'A coluna da margem é obrigatória.';
  end if;

  update sienge_tabela_vendas
     set margens = case
           when p_valor is null or p_valor = 0
             then coalesce(margens, '{}'::jsonb) - p_coluna
           else jsonb_set(coalesce(margens, '{}'::jsonb), array[p_coluna], to_jsonb(p_valor), true)
         end,
         updated_at = now()
   where project_id = p_project_id
     and (p_unidade_ids is null or id = any(p_unidade_ids));

  get diagnostics v_afetadas = row_count;
  return v_afetadas;
end;
$$;

revoke all on function public.set_sienge_tabela_vendas_margem(text, uuid[], text, numeric) from public;
grant execute on function public.set_sienge_tabela_vendas_margem(text, uuid[], text, numeric) to authenticated;
