-- =============================================================================
-- "Adicionar versão" — duplica uma versão inteira no servidor.
-- -----------------------------------------------------------------------------
-- Uma versão nova nasce como cópia da atual, não vazia: a lista de unidades é o
-- inventário do empreendimento (as mesmas 275 unidades, a mesma situação), e o
-- que se quer variar é a condição comercial — colunas, regras e valores. Partir
-- da cópia deixa o usuário editar só o que difere.
--
-- Feito no banco porque copiar 275 unidades a partir do cliente seriam 275
-- round-trips, cada um disparando broadcast de realtime.
--
-- A nova versão nunca nasce principal nem visível na LP: virar a tabela oficial
-- ou ir para o corretor são decisões explícitas, não efeito colateral de criar
-- um cenário.
-- =============================================================================

create or replace function public.duplicar_sienge_tabela_vendas_versao(
  p_versao_id uuid,
  p_nome text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origem public.sienge_tabela_vendas_versoes%rowtype;
  v_nova uuid;
  v_sort int;
  v_nome text;
begin
  select * into v_origem from sienge_tabela_vendas_versoes where id = p_versao_id;
  if not found then
    raise exception 'Versão de origem não encontrada.';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort
    from sienge_tabela_vendas_versoes where project_id = v_origem.project_id;

  v_nome := coalesce(nullif(btrim(p_nome), ''), 'Versão ' || v_sort);

  insert into sienge_tabela_vendas_versoes (project_id, nome, sort_order, principal, lp_visivel)
  values (v_origem.project_id, v_nome, v_sort, false, false)
  returning id into v_nova;

  insert into sienge_tabela_vendas_colunas (project_id, versao_id, key, label, tipo, sort_order)
  select project_id, v_nova, key, label, tipo, sort_order
    from sienge_tabela_vendas_colunas where versao_id = p_versao_id;

  insert into sienge_calculo_regras
    (project_id, versao_id, titulo, quantidade, quantidade_coluna_key, operacao, percentual, coluna_base_key, sort_order)
  select project_id, v_nova, titulo, quantidade, quantidade_coluna_key, operacao, percentual, coluna_base_key, sort_order
    from sienge_calculo_regras where versao_id = p_versao_id;

  -- Validações referenciam regras por id (prefixo 'regra:'), e os ids mudam na
  -- cópia. Copiar as fórmulas apontaria para regras da versão de origem, dando
  -- número errado silenciosamente — então a versão nova começa sem validações,
  -- para serem remontadas sobre as próprias regras.
  --
  -- Unidades: nome, situação e comprador vêm juntos porque situação é sempre
  -- vinculada. Os valores vêm como ponto de partida para edição.
  insert into sienge_tabela_vendas
    (project_id, versao_id, unidade, valor_tabela, situacao, campos_extra, margens,
     descricao, comprador, situacao_motivo, venda_confirmada_em)
  select project_id, v_nova, unidade, valor_tabela, situacao, campos_extra, margens,
         descricao, comprador, situacao_motivo, venda_confirmada_em
    from sienge_tabela_vendas where versao_id = p_versao_id;

  return v_nova;
end;
$$;

revoke all on function public.duplicar_sienge_tabela_vendas_versao(uuid, text) from public;
grant execute on function public.duplicar_sienge_tabela_vendas_versao(uuid, text) to authenticated;

-- Trocar a principal precisa ser atômico: o índice único parcial
-- (project_id) where principal rejeita duas principais, então desmarcar e
-- marcar em dois UPDATEs separados do cliente falharia no meio do caminho.
create or replace function public.definir_versao_principal(
  p_versao_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project text;
begin
  select project_id into v_project from sienge_tabela_vendas_versoes where id = p_versao_id;
  if v_project is null then
    raise exception 'Versão não encontrada.';
  end if;

  update sienge_tabela_vendas_versoes
     set principal = false, updated_at = now()
   where project_id = v_project and principal and id <> p_versao_id;

  update sienge_tabela_vendas_versoes
     set principal = true, updated_at = now()
   where id = p_versao_id;
end;
$$;

revoke all on function public.definir_versao_principal(uuid) from public;
grant execute on function public.definir_versao_principal(uuid) to authenticated;
