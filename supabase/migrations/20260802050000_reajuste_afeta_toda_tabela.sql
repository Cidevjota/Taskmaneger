-- =============================================================================
-- Reajuste de valor de tabela passa a afetar TODAS as unidades, inclusive
-- vendidas e em permuta
-- -----------------------------------------------------------------------------
-- Esclarecimento de modelo (não é mudança de opinião, é a regra correta desde
-- o início): o valor da Tabela de Vendas nunca foi "congelado" no sentido de
-- parar de acompanhar reajuste. O que é congelado é a CÓPIA gravada em
-- sienge_vendas no instante em que a unidade vira vendida/permuta — é essa
-- cópia (não o valor vivo da tabela) que alimenta VGV e orçamento real.
--
-- A tabela viva continua reajustando todo mundo, inclusive quem já comprou:
-- é bom para o cliente ver quanto a unidade dele valorizou desde a compra.
--
-- Consequência: a recuperação retroativa de reajustes "perdidos" ao sair de
-- vendida/permuta (baseada em frozen_since) não faz mais sentido — nada é
-- perdido, porque nada deixa de ser reajustado. Essa lógica é removida da
-- trigger. A coluna frozen_since fica na tabela (histórico), mas a trigger
-- para de escrever nela.
-- =============================================================================

create or replace function public.apply_sienge_tabela_vendas_reajuste(
  p_project_id text,
  p_unidade_ids uuid[],
  p_percentual numeric,
  p_descricao text default null,
  p_motivo text default null
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
    (project_id, numero, tipo, percentual, unidades_afetadas, unidades, descricao, motivo, snapshot)
  values
    (p_project_id, v_numero, case when p_unidade_ids is null then 'geral' else 'seletiva' end,
     p_percentual, coalesce(v_count, 0), v_unidades, p_descricao, btrim(p_motivo),
     coalesce(v_snapshot, '[]'::jsonb))
  returning id into v_revisao_id;

  update sienge_tabela_vendas
  set valor_tabela = round(valor_tabela * (1 + p_percentual / 100), 2),
      updated_at = now()
  where project_id = p_project_id
    and (p_unidade_ids is null or id = any(p_unidade_ids));

  return v_revisao_id;
end;
$$;

-- ─── Trigger: sem recuperação retroativa de reajuste ──────────────────────
-- O congelamento continua existindo só para o snapshot de venda/permuta
-- (sienge_vendas). frozen_since deixa de ser escrito: não há mais nada para
-- "recuperar" quando a unidade sai de vendida/permuta, porque ela nunca parou
-- de ser reajustada.

create or replace function public.handle_sienge_tabela_venda_situacao_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_frozen boolean := OLD.situacao in ('vendida', 'permuta');
  v_new_frozen boolean := NEW.situacao in ('vendida', 'permuta');
begin
  -- Entrando em vendida/permuta: copia os valores atuais para sienge_vendas.
  -- Só quando `venda_confirmada_em` muda no mesmo UPDATE — a trava que impede
  -- importação de planilha e correção de cadastro de gerarem venda fantasma.
  if not v_old_frozen and v_new_frozen
     and NEW.venda_confirmada_em is not null
     and NEW.venda_confirmada_em is distinct from OLD.venda_confirmada_em then
    insert into public.sienge_vendas (
      unidade_id, project_id, unidade, valor_congelado, campos_extra_congelados,
      comprador, data_venda, motivo, situacao_origem
    )
    values (
      NEW.id, NEW.project_id, NEW.unidade, NEW.valor_tabela, NEW.campos_extra,
      NEW.comprador, NEW.venda_confirmada_em, NEW.situacao_motivo, NEW.situacao
    );
  end if;

  -- Saindo de vendida/permuta: encerra o registro ativo (distrato).
  if v_old_frozen and not v_new_frozen then
    update public.sienge_vendas
       set data_distrato = now(),
           motivo_distrato = NEW.situacao_motivo,
           updated_at = now()
     where unidade_id = OLD.id and data_distrato is null;

    NEW.comprador := null;
    NEW.venda_confirmada_em := null;
  end if;

  return NEW;
end;
$$;

drop trigger if exists sienge_tabela_vendas_situacao_change on public.sienge_tabela_vendas;
create trigger sienge_tabela_vendas_situacao_change
  before update on public.sienge_tabela_vendas
  for each row
  when (OLD.situacao is distinct from NEW.situacao)
  execute function public.handle_sienge_tabela_venda_situacao_change();
