-- Tarefas privadas: só quem tem permissionLevel 1 vê, edita ou apaga.
--
-- A regra vive na RLS, não só na interface. Filtrar apenas no client deixaria a
-- tarefa "privada" trafegando para todos os navegadores — bastaria abrir o
-- devtools para ler o conteúdo.

alter table public.tasks add column if not exists is_private boolean not null default false;

create index if not exists tasks_is_private_idx on public.tasks (is_private) where is_private;

-- security definer: a policy precisa ler users_profile mesmo para o usuário que
-- ainda não passou na checagem, e sem isso a leitura do perfil alheio seria
-- barrada pela RLS da própria users_profile.
create or replace function public.is_permission_level_1()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users_profile p
    where p.id = auth.uid()
      and (p.preferences ->> 'permissionLevel') = '1'
  );
$$;

revoke execute on function public.is_permission_level_1() from public;
grant execute on function public.is_permission_level_1() to authenticated;

-- Substitui a policy única e permissiva (using true) por uma por comando, para
-- que o with_check impeça alguém de nível 2 marcar a própria tarefa como privada.
drop policy if exists "auth_all_tasks" on public.tasks;

create policy "tasks_select_non_private" on public.tasks
  for select to authenticated
  using (not is_private or public.is_permission_level_1());

create policy "tasks_insert" on public.tasks
  for insert to authenticated
  with check (not is_private or public.is_permission_level_1());

create policy "tasks_update" on public.tasks
  for update to authenticated
  using (not is_private or public.is_permission_level_1())
  with check (not is_private or public.is_permission_level_1());

create policy "tasks_delete" on public.tasks
  for delete to authenticated
  using (not is_private or public.is_permission_level_1());
