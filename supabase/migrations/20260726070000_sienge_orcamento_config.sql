-- Data de corte a partir da qual o gasto de títulos Sienge passa a contar no
-- controle de orçamento real (não existe histórico de gastos confiável antes
-- disso, então o controle começa do zero na data configurada, junto com o VGV
-- real das vendas).
create table public.sienge_orcamento_config (
  id text primary key default 'default',
  controle_inicio date not null default current_date,
  updated_at timestamptz not null default now()
);

insert into public.sienge_orcamento_config (id) values ('default');

alter table public.sienge_orcamento_config enable row level security;

drop policy if exists "auth_all_sienge_orcamento_config" on public.sienge_orcamento_config;
create policy "auth_all_sienge_orcamento_config" on public.sienge_orcamento_config
  for all to authenticated using (true) with check (true);

drop trigger if exists broadcast_sienge_orcamento_config_changes on public.sienge_orcamento_config;
create trigger broadcast_sienge_orcamento_config_changes
  after insert or update or delete on public.sienge_orcamento_config
  for each row execute function public.broadcast_row_change('sienge-changes');
