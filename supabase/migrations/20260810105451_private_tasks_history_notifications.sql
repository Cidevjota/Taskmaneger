-- task_history guarda old_value/new_value de cada campo (inclusive título e
-- descrição) e notifications carrega o título na mensagem. Ambas as tabelas
-- estavam liberadas para todo autenticado, o que reabriria por fora o conteúdo
-- que a RLS de tasks fechou.
--
-- ATENÇÃO: as policies criadas aqui têm uma falha corrigida na migration
-- seguinte (20260810105523) — a subconsulta em tasks também sofre a RLS de
-- tasks e acabava liberando o acesso. Mantida no histórico por fidelidade.

drop policy if exists "auth_all_task_history" on public.task_history;

create policy "task_history_select" on public.task_history
  for select to authenticated
  using (
    not exists (
      select 1 from public.tasks t
      where t.id = task_history.task_id and t.is_private
    )
    or public.is_permission_level_1()
  );

create policy "task_history_write" on public.task_history
  for all to authenticated
  using (
    not exists (
      select 1 from public.tasks t
      where t.id = task_history.task_id and t.is_private
    )
    or public.is_permission_level_1()
  )
  with check (true);

drop policy if exists "auth_all_notifications" on public.notifications;

create policy "notifications_select" on public.notifications
  for select to authenticated
  using (
    task_id is null
    or not exists (
      select 1 from public.tasks t
      where t.id = notifications.task_id and t.is_private
    )
    or public.is_permission_level_1()
  );

create policy "notifications_write" on public.notifications
  for all to authenticated
  using (
    task_id is null
    or not exists (
      select 1 from public.tasks t
      where t.id = notifications.task_id and t.is_private
    )
    or public.is_permission_level_1()
  )
  with check (true);
