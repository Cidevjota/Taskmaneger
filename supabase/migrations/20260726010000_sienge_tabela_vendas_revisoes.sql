-- Histórico (resumo) de revisões de reajuste da tabela de vendas: percentual
-- aplicado, se foi geral (todas as unidades) ou seletiva (unidades escolhidas),
-- e quais unidades foram afetadas.
create table if not exists public.sienge_tabela_vendas_revisoes (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  numero int not null,
  tipo text not null check (tipo in ('geral', 'seletiva')),
  percentual numeric not null,
  unidades_afetadas int not null default 0,
  unidades text[] null,
  descricao text null,
  created_at timestamptz not null default now(),
  unique (project_id, numero)
);

alter table public.sienge_tabela_vendas_revisoes enable row level security;

drop policy if exists "auth_all_sienge_tabela_vendas_revisoes" on public.sienge_tabela_vendas_revisoes;
create policy "auth_all_sienge_tabela_vendas_revisoes" on public.sienge_tabela_vendas_revisoes
  for all to authenticated using (true) with check (true);

drop trigger if exists broadcast_sienge_tabela_vendas_revisoes_changes on public.sienge_tabela_vendas_revisoes;
create trigger broadcast_sienge_tabela_vendas_revisoes_changes
  after insert or update or delete on public.sienge_tabela_vendas_revisoes
  for each row execute function public.broadcast_row_change('sienge-changes');

-- Aplica um reajuste percentual ao valor de tabela das unidades de um
-- empreendimento (todas, se p_unidade_ids for null, ou apenas as informadas),
-- e registra a revisão correspondente de forma atômica.
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
  where project_id = p_project_id and (p_unidade_ids is null or id = any(p_unidade_ids));

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
  where project_id = p_project_id and (p_unidade_ids is null or id = any(p_unidade_ids));

  return v_revisao_id;
end;
$$;
