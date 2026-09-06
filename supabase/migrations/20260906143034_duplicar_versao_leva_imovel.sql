-- =============================================================================
-- Duplicar versão precisa levar o imóvel junto
-- -----------------------------------------------------------------------------
-- A cópia enumera colunas uma a uma, então `imovel` — criado em 20260906141844
-- — ficaria de fora e toda unidade da versão nova nasceria sem imóvel. Num
-- empreendimento de terceiros isso significa a tabela inteira sem o vínculo que
-- liga a linha ao cadastro do imóvel: a LP abriria cada unidade sem fotos, sem
-- descrição e sem informações, e a única pista de que faltava algo seria a
-- coluna Imóvel vazia.
--
-- O imóvel é dado da unidade, como `descricao` e `situacao` (que já vinham
-- juntos), e não da condição comercial: duplicar "à vista" para "financiado"
-- copia as mesmas unidades dos mesmos imóveis.
-- =============================================================================

create or replace function public.duplicar_sienge_tabela_vendas_versao(p_versao_id uuid, p_nome text default null::text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    (project_id, versao_id, vinculo_key, titulo, quantidade, quantidade_coluna_key, operacao, percentual, coluna_base_key, sort_order)
  select project_id, v_nova, vinculo_key, titulo, quantidade, quantidade_coluna_key, operacao, percentual, coluna_base_key, sort_order
    from sienge_calculo_regras where versao_id = p_versao_id;

  -- Validações referenciam regras por id (prefixo 'regra:'), e os ids mudam na
  -- cópia. Copiar as fórmulas apontaria para regras da versão de origem, dando
  -- número errado silenciosamente — então a versão nova começa sem validações,
  -- para serem remontadas sobre as próprias regras.
  --
  -- Unidades: nome, imóvel, situação e comprador vêm juntos porque descrevem a
  -- unidade, não a condição comercial. Os valores vêm como ponto de partida
  -- para edição.
  insert into sienge_tabela_vendas
    (project_id, versao_id, unidade, imovel, valor_tabela, situacao, campos_extra, margens,
     descricao, comprador, situacao_motivo, venda_confirmada_em)
  select project_id, v_nova, unidade, imovel, valor_tabela, situacao, campos_extra, margens,
         descricao, comprador, situacao_motivo, venda_confirmada_em
    from sienge_tabela_vendas where versao_id = p_versao_id;

  return v_nova;
end;
$function$;

-- CREATE OR REPLACE reaplica o ACL padrão do schema; sem isto o grant fechado
-- em 20260906132610 voltaria a abrir nesta função.
revoke execute on function public.duplicar_sienge_tabela_vendas_versao(uuid, text) from public, anon;
