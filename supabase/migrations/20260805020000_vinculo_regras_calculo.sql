-- =============================================================================
-- Vínculo entre versões também para colunas calculadas (regras).
-- -----------------------------------------------------------------------------
-- O vínculo de colunas reais (20260805000000) sincroniza VALOR: a mesma key em
-- campos_extra/valor_tabela é replicada entre versões via
-- sync_sienge_colunas_vinculadas. Uma regra não tem valor próprio guardado —
-- é sempre recalculada a partir de outras colunas — então "vincular" uma regra
-- não pode significar a mesma coisa. O que faz sentido sincronizar é a FÓRMULA:
-- percentual, quantidade, operação e coluna de referência.
--
-- O obstáculo é identidade: uma coluna real usa `key` como id estável entre
-- versões (definido na criação, nunca muda mesmo se o label mudar, e é copiado
-- verbatim por duplicar_sienge_tabela_vendas_versao). Uma regra só tinha `id`,
-- que MUDA a cada duplicação — não dá pra usar como elo. `vinculo_key` é esse
-- id estável para regras: gerado uma vez, preservado na cópia.
--
-- O vínculo em si continua morando em sienge_tabela_vendas_config.colunas_vinculadas
-- (mesmo array usado pelas colunas reais), com um prefixo próprio
-- ('vinculo_regra:') pra não colidir com REGRA_KEY_PREFIX ('regra:'), que é
-- outra coisa — aponta pra uma regra ESPECÍFICA de UMA versão dentro de uma
-- fórmula de validação, não pra um "conceito de regra" compartilhado entre
-- versões.
-- =============================================================================

alter table public.sienge_calculo_regras
  add column if not exists vinculo_key uuid not null default gen_random_uuid();

comment on column public.sienge_calculo_regras.vinculo_key is
  'Id estável entre versões da "mesma" regra — como key para colunas reais, mas nunca exposto/editável, só usado para casar linhas em duplicação e sincronismo.';

-- Sincroniza só os campos que definem o CÁLCULO (não título nem ordem — cada
-- versão pode nomear/posicionar a coluna calculada do seu jeito, igual a uma
-- coluna real vinculada pode ter label diferente por versão).
create or replace function public.sync_sienge_regras_vinculadas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys text[];
  v_marca text := 'vinculo_regra:' || NEW.vinculo_key::text;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  select colunas_vinculadas into v_keys
    from public.sienge_tabela_vendas_config where project_id = NEW.project_id;

  if v_keys is null or not (v_marca = any(v_keys)) then
    return null;
  end if;

  update public.sienge_calculo_regras r
     set quantidade = NEW.quantidade,
         quantidade_coluna_key = NEW.quantidade_coluna_key,
         operacao = NEW.operacao,
         percentual = NEW.percentual,
         coluna_base_key = NEW.coluna_base_key,
         updated_at = now()
   where r.project_id = NEW.project_id
     and r.vinculo_key = NEW.vinculo_key
     and r.id <> NEW.id
     and (r.quantidade is distinct from NEW.quantidade
       or r.quantidade_coluna_key is distinct from NEW.quantidade_coluna_key
       or r.operacao is distinct from NEW.operacao
       or r.percentual is distinct from NEW.percentual
       or r.coluna_base_key is distinct from NEW.coluna_base_key);

  return null;
end;
$$;

drop trigger if exists sienge_sync_regras_vinculadas on public.sienge_calculo_regras;
create trigger sienge_sync_regras_vinculadas
  after update on public.sienge_calculo_regras
  for each row
  when (OLD.quantidade is distinct from NEW.quantidade
     or OLD.quantidade_coluna_key is distinct from NEW.quantidade_coluna_key
     or OLD.operacao is distinct from NEW.operacao
     or OLD.percentual is distinct from NEW.percentual
     or OLD.coluna_base_key is distinct from NEW.coluna_base_key)
  execute function public.sync_sienge_regras_vinculadas();

-- Reaplica duplicar_sienge_tabela_vendas_versao (20260805010000) só trocando o
-- insert de regras para preservar vinculo_key em vez de deixar gerar um novo —
-- sem isso, marcar vínculo na origem e na cópia nunca se encontrariam.
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
    (project_id, versao_id, vinculo_key, titulo, quantidade, quantidade_coluna_key, operacao, percentual, coluna_base_key, sort_order)
  select project_id, v_nova, vinculo_key, titulo, quantidade, quantidade_coluna_key, operacao, percentual, coluna_base_key, sort_order
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
