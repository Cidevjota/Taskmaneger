-- Substitui o config único e fixo (mensal/semestral, sempre sobre "custo de
-- construção") por uma lista de regras por empreendimento: cada uma vira uma
-- coluna calculada na Tabela de Vendas, com título, quantidade de parcelas,
-- percentual, e a coluna base (dinâmica ou o valor de tabela) sobre a qual o
-- percentual incide — necessário porque cada empreendimento tem colunas
-- diferentes.
drop trigger if exists broadcast_sienge_calculo_config_changes on public.sienge_calculo_config;
drop table if exists public.sienge_calculo_config;

create table public.sienge_calculo_regras (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  titulo text not null,
  quantidade integer not null default 1,
  percentual numeric not null default 0,
  coluna_base_key text not null default 'valor_tabela',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sienge_calculo_regras enable row level security;

drop policy if exists "auth_all_sienge_calculo_regras" on public.sienge_calculo_regras;
create policy "auth_all_sienge_calculo_regras" on public.sienge_calculo_regras
  for all to authenticated using (true) with check (true);

drop trigger if exists broadcast_sienge_calculo_regras_changes on public.sienge_calculo_regras;
create trigger broadcast_sienge_calculo_regras_changes
  after insert or update or delete on public.sienge_calculo_regras
  for each row execute function public.broadcast_row_change('sienge-changes');

-- Semeia as regras do Rivage com o mesmo comportamento que já existia
-- (mensal 48x a 77%, semestral 7x a 23%, ambas sobre o custo de construção).
insert into public.sienge_calculo_regras (project_id, titulo, quantidade, percentual, coluna_base_key, sort_order)
values
  ('p1', 'Mensal', 48, 77, 'custo_construcao', 1),
  ('p1', 'Semestral', 7, 23, 'custo_construcao', 2);
