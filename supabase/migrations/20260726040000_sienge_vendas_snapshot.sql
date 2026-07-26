-- Snapshot imutável de venda: valor de tabela congelado no instante em que uma
-- unidade vira "vendida". A Tabela de Vendas continua viva e sofre reajuste de
-- INCC, mas o cálculo de orçamento real usa sempre o valor daqui, nunca o valor
-- atual da unidade.
create table public.sienge_vendas (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.sienge_tabela_vendas(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  unidade text not null,
  valor_congelado numeric not null,
  data_venda timestamptz not null default now(),
  data_distrato timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Só pode haver uma venda ativa (não distratada) por unidade ao mesmo tempo.
create unique index sienge_vendas_unidade_ativa_uidx on public.sienge_vendas(unidade_id) where data_distrato is null;

alter table public.sienge_vendas enable row level security;

drop policy if exists "auth_all_sienge_vendas" on public.sienge_vendas;
create policy "auth_all_sienge_vendas" on public.sienge_vendas
  for all to authenticated using (true) with check (true);

drop trigger if exists broadcast_sienge_vendas_changes on public.sienge_vendas;
create trigger broadcast_sienge_vendas_changes
  after insert or update or delete on public.sienge_vendas
  for each row execute function public.broadcast_row_change('sienge-changes');
