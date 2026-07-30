-- Colunas dinâmicas por empreendimento: cada projeto pode ter um conjunto
-- diferente de colunas na Tabela de Vendas (além das fixas unidade/valor/
-- situação, que sustentam o congelamento de venda e o reajuste de INCC).
create table public.sienge_tabela_vendas_colunas (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  key text not null,
  label text not null,
  tipo text not null default 'moeda' check (tipo in ('numero', 'moeda', 'texto')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, key)
);

alter table public.sienge_tabela_vendas_colunas enable row level security;

drop policy if exists "auth_all_sienge_tabela_vendas_colunas" on public.sienge_tabela_vendas_colunas;
create policy "auth_all_sienge_tabela_vendas_colunas" on public.sienge_tabela_vendas_colunas
  for all to authenticated using (true) with check (true);

drop trigger if exists broadcast_sienge_tabela_vendas_colunas_changes on public.sienge_tabela_vendas_colunas;
create trigger broadcast_sienge_tabela_vendas_colunas_changes
  after insert or update or delete on public.sienge_tabela_vendas_colunas
  for each row execute function public.broadcast_row_change('sienge-changes');

-- Valores das colunas dinâmicas, por unidade.
alter table public.sienge_tabela_vendas
  add column if not exists campos_extra jsonb not null default '{}';

-- Migra os dados hoje fixos (m², adesão, custo de construção) para o novo
-- formato dinâmico, e cria as definições de coluna correspondentes por
-- projeto que já usa a tabela — preservando os dados existentes do Rivage.
update public.sienge_tabela_vendas
set campos_extra = jsonb_build_object(
  'area_m2', area_m2,
  'adesao_total', adesao_total,
  'custo_construcao', custo_construcao
);

insert into public.sienge_tabela_vendas_colunas (project_id, key, label, tipo, sort_order)
select distinct project_id, 'area_m2', 'm²', 'numero', 1 from public.sienge_tabela_vendas
union all
select distinct project_id, 'adesao_total', 'Adesão Total', 'moeda', 2 from public.sienge_tabela_vendas
union all
select distinct project_id, 'custo_construcao', 'Custo de Construção', 'moeda', 3 from public.sienge_tabela_vendas
on conflict (project_id, key) do nothing;

alter table public.sienge_tabela_vendas
  drop column area_m2,
  drop column adesao_total,
  drop column custo_construcao;
