-- Empreendimentos fora do Dashboard de Vendas (tela e e-mail semanal).
--
-- Independe do "oculto" de Ajustar Metas: aquele também tira o empreendimento
-- da Tabela de Vendas, e aqui a exclusão vale só para o resumo. Começa com
-- Uchôa e Casa Uchôa, que não são produtos à venda.

alter table public.relatorio_vendas_config
  add column if not exists projetos_excluidos text[] not null default '{}';

update public.relatorio_vendas_config
set projetos_excluidos = array(
  select distinct unnest(projetos_excluidos || array['p-1782353555616', 'p-1789148903024'])
)
where id = 'default';

create or replace function public.relatorio_vendas_resumo()
returns table (
  project_id text,
  project_name text,
  sort_order integer,
  situacao text,
  unidades bigint,
  vgv numeric
)
language sql
stable
set search_path = public
as $$
  select
    p.id::text,
    p.name,
    coalesce(d.sort_order, 2147483647),
    u.situacao::text,
    count(*),
    coalesce(sum(u.valor_tabela), 0)
  from public.sienge_tabela_vendas u
  join public.projects p on p.id::text = u.project_id::text
  left join public.sienge_project_display d on d.project_id::text = p.id::text
  left join public.sienge_tabela_vendas_versoes v
    on v.project_id::text = u.project_id::text and v.principal
  where coalesce(d.hidden, false) = false
    and (v.id is null or u.versao_id = v.id)
    and not exists (
      select 1 from public.relatorio_vendas_config c
      where c.id = 'default' and p.id::text = any(c.projetos_excluidos)
    )
  group by p.id, p.name, d.sort_order, u.situacao
$$;
