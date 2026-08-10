-- Isolamento de tarefas privadas no Realtime.
--
-- O broadcast publica a linha inteira (to_jsonb(NEW)) num tópico único que todos
-- os autenticados assinam. A RLS protege o SELECT, mas não o canal de realtime —
-- sem isto, editar uma tarefa privada empurraria título e descrição para o
-- navegador de todo o time, contornando a regra de privacidade.

create or replace function public.broadcast_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_private boolean := false;
  v_topic text := 'tasks-changes';
begin
  begin
    v_row := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;

    if TG_TABLE_NAME = 'tasks' then
      v_private := coalesce((v_row ->> 'is_private')::boolean, false);
    elsif TG_TABLE_NAME in ('subtasks', 'task_labels') then
      -- Subtarefa/label de uma tarefa privada carrega conteúdo dela: segue o
      -- mesmo tópico restrito.
      select coalesce(t.is_private, false) into v_private
        from public.tasks t
       where t.id = (v_row ->> 'task_id')::uuid;
    end if;

    if coalesce(v_private, false) then
      v_topic := 'tasks-changes-admin';
    end if;

    perform realtime.send(
      jsonb_build_object(
        'operation',  TG_OP,
        'table',      TG_TABLE_NAME,
        'record',     case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end,
        'old_record', case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end
      ),
      TG_OP,
      v_topic,
      true
    );
  exception when others then
    -- Realtime NUNCA bloqueia a escrita.
    null;
  end;
  return null;
end;
$$;

-- Ao marcar como privada, o time precisa ver a tarefa sumir; ao desmarcar, voltar.
-- Esses dois eventos não podem depender do tópico restrito, senão a tarefa ficaria
-- fantasma na tela de quem perdeu (ou ganhou) acesso até o próximo refetch.
-- Quando vira privada mandamos só o id (sem conteúdo) para o cliente descartá-la.
create or replace function public.broadcast_privacy_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if OLD.is_private is distinct from NEW.is_private then
      perform realtime.send(
        jsonb_build_object(
          'operation',  'UPDATE',
          'table',      'tasks',
          'record',     case when NEW.is_private then null else to_jsonb(NEW) end,
          'old_record', jsonb_build_object('id', OLD.id)
        ),
        'UPDATE',
        'tasks-changes',
        true
      );
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;

drop trigger if exists broadcast_tasks_privacy_transition on public.tasks;
create trigger broadcast_tasks_privacy_transition
  after update of is_private on public.tasks
  for each row execute function public.broadcast_privacy_transition();

-- Autorização por tópico: o tópico admin só é entregue a quem tem nível 1.
drop policy if exists "authenticated_can_receive_broadcasts" on realtime.messages;

create policy "authenticated_can_receive_broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    topic <> 'tasks-changes-admin' or public.is_permission_level_1()
  );
