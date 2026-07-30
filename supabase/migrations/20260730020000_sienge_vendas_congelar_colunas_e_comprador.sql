-- Nome do comprador atual da unidade (preenchido ao marcar como vendida).
alter table public.sienge_tabela_vendas
  add column if not exists comprador text;

-- O snapshot de venda passa a congelar TODAS as colunas dinâmicas da unidade
-- (não só o valor de tabela) e o nome do comprador, no instante da venda.
alter table public.sienge_vendas
  add column if not exists comprador text,
  add column if not exists campos_extra_congelados jsonb not null default '{}';

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
  -- Entrando em "vendida" (de qualquer outro estado): registra o snapshot de
  -- venda com TODAS as colunas da unidade congeladas, mais o comprador.
  if OLD.situacao <> 'vendida' and NEW.situacao = 'vendida' then
    insert into public.sienge_vendas (unidade_id, project_id, unidade, valor_congelado, campos_extra_congelados, comprador, data_venda)
    values (NEW.id, NEW.project_id, NEW.unidade, NEW.valor_tabela, NEW.campos_extra, NEW.comprador, now());
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
