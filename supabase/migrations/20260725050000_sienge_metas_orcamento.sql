-- Metas mensais de VGV/unidades e alocação de % de orçamento por categoria,
-- por empreendimento — base do dashboard estratégico (Metas & Orçamento).
create table if not exists public.sienge_project_metas (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  ano int not null,
  mes int not null check (mes between 1 and 12),
  vgv_meta numeric not null default 0,
  unidades_meta int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, ano, mes)
);

create table if not exists public.sienge_categoria_orcamento (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  centro_custo text not null check (centro_custo in ('comercial', 'marketing')),
  categoria text not null,
  percentual numeric not null default 0, -- % do VGV mensal (ex: 0.5 = 0,5%)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, centro_custo, categoria)
);

alter table public.sienge_project_metas enable row level security;
alter table public.sienge_categoria_orcamento enable row level security;

drop policy if exists "auth_all_sienge_project_metas" on public.sienge_project_metas;
create policy "auth_all_sienge_project_metas" on public.sienge_project_metas
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_sienge_categoria_orcamento" on public.sienge_categoria_orcamento;
create policy "auth_all_sienge_categoria_orcamento" on public.sienge_categoria_orcamento
  for all to authenticated using (true) with check (true);

-- Broadcast realtime, mesmo tópico compartilhado usado pelos demais dados Sienge.
drop trigger if exists broadcast_sienge_project_metas_changes on public.sienge_project_metas;
create trigger broadcast_sienge_project_metas_changes
  after insert or update or delete on public.sienge_project_metas
  for each row execute function public.broadcast_row_change('sienge-changes');

drop trigger if exists broadcast_sienge_categoria_orcamento_changes on public.sienge_categoria_orcamento;
create trigger broadcast_sienge_categoria_orcamento_changes
  after insert or update or delete on public.sienge_categoria_orcamento
  for each row execute function public.broadcast_row_change('sienge-changes');
