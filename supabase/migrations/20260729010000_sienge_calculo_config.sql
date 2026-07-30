-- Regras de cálculo das parcelas (mensal e semestral) da Tabela de Vendas.
-- Antes eram constantes fixas no client (48x a 77%, 7x a 23% do custo de
-- construção); agora ficam configuráveis, com o mesmo efeito imediato na
-- tabela de vendas.
create table public.sienge_calculo_config (
  id text primary key default 'default',
  mensal_descricao text not null default 'Mensais',
  mensal_quantidade integer not null default 48,
  mensal_percentual numeric not null default 77,
  semestral_descricao text not null default 'Semestrais',
  semestral_quantidade integer not null default 7,
  semestral_percentual numeric not null default 23,
  updated_at timestamptz not null default now()
);

insert into public.sienge_calculo_config (id) values ('default');

alter table public.sienge_calculo_config enable row level security;

drop policy if exists "auth_all_sienge_calculo_config" on public.sienge_calculo_config;
create policy "auth_all_sienge_calculo_config" on public.sienge_calculo_config
  for all to authenticated using (true) with check (true);

drop trigger if exists broadcast_sienge_calculo_config_changes on public.sienge_calculo_config;
create trigger broadcast_sienge_calculo_config_changes
  after insert or update or delete on public.sienge_calculo_config
  for each row execute function public.broadcast_row_change('sienge-changes');
