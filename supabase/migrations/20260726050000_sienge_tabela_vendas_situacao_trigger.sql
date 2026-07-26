-- Regra de negócio central: ao mudar a situação de uma unidade, (a) cria/fecha
-- o snapshot imutável de venda em sienge_vendas, (b) congela/descongela o valor
-- de tabela para efeito de reajuste de INCC, e (c) em caso de distrato/permuta
-- desfeita, recupera retroativamente os reajustes de INCC "geral" perdidos
-- enquanto a unidade esteve congelada.
create or replace function public.handle_sienge_tabela_venda_situacao_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_frozen boolean := OLD.situacao in ('vendida', 'permuta');
  v_new_frozen boolean := NEW.situacao in ('vendida', 'permuta');
  v_revisao record;
begin
  -- Entrando em "vendida" (de qualquer outro estado): registra o snapshot de venda.
  if OLD.situacao <> 'vendida' and NEW.situacao = 'vendida' then
    insert into public.sienge_vendas (unidade_id, project_id, unidade, valor_congelado, data_venda)
    values (NEW.id, NEW.project_id, NEW.unidade, NEW.valor_tabela, now());
  end if;

  -- Saindo de "vendida" (para qualquer outro estado, inclusive permuta): fecha a venda ativa.
  if OLD.situacao = 'vendida' and NEW.situacao <> 'vendida' then
    update public.sienge_vendas
    set data_distrato = now(), updated_at = now()
    where unidade_id = OLD.id and data_distrato is null;
  end if;

  -- Congelando (entrando em vendida/permuta vindo de um estado não congelado): marca desde quando.
  if not v_old_frozen and v_new_frozen then
    NEW.frozen_since := now();
  end if;

  -- Descongelando (voltando a disponível/bloqueada): recupera os reajustes gerais perdidos.
  if v_old_frozen and not v_new_frozen then
    for v_revisao in
      select percentual from public.sienge_tabela_vendas_revisoes
      where project_id = OLD.project_id and tipo = 'geral' and created_at > OLD.frozen_since
      order by numero asc
    loop
      NEW.valor_tabela := round(NEW.valor_tabela * (1 + v_revisao.percentual / 100), 2);
    end loop;
    NEW.frozen_since := null;
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
