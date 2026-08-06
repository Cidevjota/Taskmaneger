-- =============================================================================
-- Reajuste passa a ser POR VERSÃO — conserta o "Atualizar Valor" mudo.
-- -----------------------------------------------------------------------------
-- 20260805000000_tabela_vendas_versoes.sql acrescentou versao_id NOT NULL em
-- sienge_tabela_vendas_revisoes, mas a função de reajuste continuou sendo a de
-- 20260804000000 — que insere a revisão sem versao_id. O INSERT violava o NOT
-- NULL, a exceção derrubava a função inteira e o UPDATE dos valores era
-- desfeito junto: da UI, clicar em "Aplicar Reajuste" não mudava nada e não
-- explicava por quê.
--
-- Além do versao_id na revisão, o reajuste passa a ser recortado pela versão:
--
--   • unidades reajustadas: só as da versão escolhida (colunas vinculadas em
--     sienge_tabela_vendas_config continuam replicando para as irmãs via
--     trigger, que é o comportamento desenhado — o que não pode acontecer é
--     uma versão de estudo arrastar a principal por uma coluna livre);
--   • snapshot: só as unidades da versão, senão reverter devolveria valores de
--     versões que aquele reajuste nunca tocou;
--   • numeração: max(numero) dentro da versão, coerente com a constraint
--     (project_id, versao_id, numero) criada na migration das versões.
--
-- As três assinaturas antigas são removidas: com a nova elas seriam overloads
-- ambíguas para o PostgREST, e nenhuma delas consegue mais gravar uma revisão
-- válida.
-- =============================================================================

drop function if exists public.apply_sienge_tabela_vendas_reajuste(text, uuid[], numeric, text);
drop function if exists public.apply_sienge_tabela_vendas_reajuste(text, uuid[], numeric, text, text);
drop function if exists public.apply_sienge_tabela_vendas_reajuste(text, uuid[], numeric, text, text, text[]);

create or replace function public.apply_sienge_tabela_vendas_reajuste(
  p_project_id text,
  p_unidade_ids uuid[],
  p_percentual numeric,
  p_descricao text default null,
  p_motivo text default null,
  p_colunas text[] default null,
  -- Nulo cai na versão principal: mantém utilizável qualquer chamada antiga que
  -- só conheça project_id, em vez de falhar por falta de parâmetro.
  p_versao_id uuid default null
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
  v_versao_id uuid := p_versao_id;
  v_colunas text[] := case when p_colunas is null or array_length(p_colunas, 1) is null
                       then array['valor_tabela'] else p_colunas end;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'O motivo da alteração é obrigatório.';
  end if;

  if v_versao_id is null then
    select id into v_versao_id
      from sienge_tabela_vendas_versoes
     where project_id = p_project_id and principal;
  end if;

  if v_versao_id is null then
    raise exception 'Nenhuma versão de tabela de vendas para este empreendimento.';
  end if;

  -- A versão tem que ser deste projeto: sem a checagem, um id de outro projeto
  -- gravaria uma revisão órfã que nunca apareceria no histórico de ninguém.
  if not exists (
    select 1 from sienge_tabela_vendas_versoes
     where id = v_versao_id and project_id = p_project_id
  ) then
    raise exception 'A versão informada não pertence a este empreendimento.';
  end if;

  -- Sem filtro de situação: todas as unidades da versão (ou as selecionadas)
  -- são reajustadas, vendidas e em permuta inclusive.
  select array_agg(unidade order by unidade), count(*) into v_unidades, v_count
  from sienge_tabela_vendas
  where project_id = p_project_id
    and versao_id = v_versao_id
    and (p_unidade_ids is null or id = any(p_unidade_ids));

  select jsonb_agg(jsonb_build_object(
           'id', id, 'valor_tabela', valor_tabela, 'campos_extra', campos_extra,
           'margens', margens
         ))
    into v_snapshot
    from sienge_tabela_vendas
   where project_id = p_project_id
     and versao_id = v_versao_id;

  select coalesce(max(numero), 0) + 1 into v_numero
  from sienge_tabela_vendas_revisoes
  where project_id = p_project_id and versao_id = v_versao_id;

  insert into sienge_tabela_vendas_revisoes
    (project_id, versao_id, numero, tipo, percentual, unidades_afetadas, unidades, descricao, motivo, snapshot, colunas)
  values
    (p_project_id, v_versao_id, v_numero,
     case when p_unidade_ids is null then 'geral' else 'seletiva' end,
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
    and t.versao_id = v_versao_id
    and (p_unidade_ids is null or t.id = any(p_unidade_ids));

  return v_revisao_id;
end;
$$;

revoke all on function public.apply_sienge_tabela_vendas_reajuste(text, uuid[], numeric, text, text, text[], uuid) from public;
grant execute on function public.apply_sienge_tabela_vendas_reajuste(text, uuid[], numeric, text, text, text[], uuid) to authenticated;

-- A margem tem o mesmo problema de recorte: ela é a base do reajuste de uma
-- coluna, e gravá-la no projeto inteiro mexia na margem de versões que o
-- usuário nem tinha aberto. Passa a valer para a versão escolhida (nulo =
-- principal, mesmo critério do reajuste).
drop function if exists public.set_sienge_tabela_vendas_margem(text, uuid[], text, numeric);

create or replace function public.set_sienge_tabela_vendas_margem(
  p_project_id text,
  p_unidade_ids uuid[],
  p_coluna text,
  p_valor numeric,
  p_versao_id uuid default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afetadas int;
  v_versao_id uuid := p_versao_id;
begin
  if p_coluna is null or btrim(p_coluna) = '' then
    raise exception 'A coluna da margem é obrigatória.';
  end if;

  if v_versao_id is null then
    select id into v_versao_id
      from sienge_tabela_vendas_versoes
     where project_id = p_project_id and principal;
  end if;

  if v_versao_id is null then
    raise exception 'Nenhuma versão de tabela de vendas para este empreendimento.';
  end if;

  update sienge_tabela_vendas
     set margens = case
           when p_valor is null or p_valor = 0
             then coalesce(margens, '{}'::jsonb) - p_coluna
           else jsonb_set(coalesce(margens, '{}'::jsonb), array[p_coluna], to_jsonb(p_valor), true)
         end,
         updated_at = now()
   where project_id = p_project_id
     and versao_id = v_versao_id
     and (p_unidade_ids is null or id = any(p_unidade_ids));

  get diagnostics v_afetadas = row_count;
  return v_afetadas;
end;
$$;

revoke all on function public.set_sienge_tabela_vendas_margem(text, uuid[], text, numeric, uuid) from public;
grant execute on function public.set_sienge_tabela_vendas_margem(text, uuid[], text, numeric, uuid) to authenticated;
