-- Preferências de exibição por empreendimento, escopadas ao dashboard de Metas &
-- Orçamento: permite ocultar um empreendimento dessa visão (sem afetar o resto do
-- app, onde o projeto continua existindo normalmente) e definir a ordem de exibição.
create table if not exists public.sienge_project_display (
  project_id text primary key references public.projects(id) on delete cascade,
  hidden boolean not null default false,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.sienge_project_display enable row level security;

drop policy if exists "auth_all_sienge_project_display" on public.sienge_project_display;
create policy "auth_all_sienge_project_display" on public.sienge_project_display
  for all to authenticated using (true) with check (true);

drop trigger if exists broadcast_sienge_project_display_changes on public.sienge_project_display;
create trigger broadcast_sienge_project_display_changes
  after insert or update or delete on public.sienge_project_display
  for each row execute function public.broadcast_row_change('sienge-changes');
