-- VGV total e unidades totais por empreendimento — usado como base para calcular
-- automaticamente o VGV de um mês (preço médio por unidade × unidades daquele mês)
-- quando o usuário não define um VGV explícito na planilha de metas mensais.
create table if not exists public.sienge_project_totais (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  vgv_total numeric not null default 0,
  unidades_total numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

alter table public.sienge_project_totais enable row level security;

drop policy if exists "auth_all_sienge_project_totais" on public.sienge_project_totais;
create policy "auth_all_sienge_project_totais" on public.sienge_project_totais
  for all to authenticated using (true) with check (true);

drop trigger if exists broadcast_sienge_project_totais_changes on public.sienge_project_totais;
create trigger broadcast_sienge_project_totais_changes
  after insert or update or delete on public.sienge_project_totais
  for each row execute function public.broadcast_row_change('sienge-changes');

-- unidades_meta agora aceita fracionário (ex.: 2,5 unidades) na planilha de metas mensais.
alter table public.sienge_project_metas alter column unidades_meta type numeric using unidades_meta::numeric;
alter table public.sienge_project_metas alter column unidades_meta set default 0;
