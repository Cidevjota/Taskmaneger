-- Correção da migration anterior.
--
-- Uma subconsulta em public.tasks dentro de uma policy também sofre a RLS de
-- tasks: para quem não é nível 1 a tarefa privada é invisível, o `exists` dá
-- falso e o `not exists` LIBERAVA o acesso — exatamente o oposto do pretendido.
-- Verificado na prática: um usuário nível 2 continuava lendo as 39 linhas de
-- histórico de uma tarefa privada.
--
-- A função abaixo roda como owner e enxerga a linha independentemente da RLS.
create or replace function public.is_task_private(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select t.is_private from public.tasks t where t.id = p_task_id), false);
$$;

revoke execute on function public.is_task_private(uuid) from public;
grant execute on function public.is_task_private(uuid) to authenticated;

drop policy if exists "task_history_select" on public.task_history;
drop policy if exists "task_history_write" on public.task_history;

create policy "task_history_access" on public.task_history
  for all to authenticated
  using (not public.is_task_private(task_id) or public.is_permission_level_1())
  with check (true);

drop policy if exists "notifications_select" on public.notifications;
drop policy if exists "notifications_write" on public.notifications;

create policy "notifications_access" on public.notifications
  for all to authenticated
  using (
    task_id is null
    or not public.is_task_private(task_id)
    or public.is_permission_level_1()
  )
  with check (true);
