-- Tabela de vendas por unidade, por empreendimento — valor de tabela,
-- área e situação comercial de cada unidade (base para reajustes de INCC).
create table if not exists public.sienge_tabela_vendas (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  unidade text not null,
  area_m2 numeric not null default 0,
  valor_tabela numeric not null default 0,
  situacao text not null default 'disponivel' check (situacao in ('vendida', 'disponivel', 'permuta', 'bloqueada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, unidade)
);

alter table public.sienge_tabela_vendas enable row level security;

drop policy if exists "auth_all_sienge_tabela_vendas" on public.sienge_tabela_vendas;
create policy "auth_all_sienge_tabela_vendas" on public.sienge_tabela_vendas
  for all to authenticated using (true) with check (true);

drop trigger if exists broadcast_sienge_tabela_vendas_changes on public.sienge_tabela_vendas;
create trigger broadcast_sienge_tabela_vendas_changes
  after insert or update or delete on public.sienge_tabela_vendas
  for each row execute function public.broadcast_row_change('sienge-changes');
