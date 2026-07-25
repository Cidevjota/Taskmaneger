-- =============================================================================
-- Migração: Realtime via Broadcast para tasks/subtasks/task_labels
-- -----------------------------------------------------------------------------
-- Motivo: o canal único de postgres_changes (9 inscrições) não estava entregando
-- os eventos de tasks de forma confiável — a atualização entre usuários só chegava
-- via F5 ou pelo polling de segurança. Broadcast é o mecanismo recomendado pela
-- Supabase para baixa latência e melhor escala (a presença do app já usa Broadcast
-- e chega instantânea).
--
-- Segurança do desenho:
--   * A função é SECURITY DEFINER e envolve o realtime.send num bloco EXCEPTION —
--     qualquer falha do realtime é engolida e NUNCA derruba o INSERT/UPDATE/DELETE
--     da task (não há risco de perder gravação).
--   * Canal PRIVADO: só usuários autenticados recebem, via policy em
--     realtime.messages (mesmo nível da RLS atual, que é "authenticated").
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Autorização: usuários autenticados podem RECEBER broadcasts (canal privado)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_can_receive_broadcasts" ON realtime.messages;
CREATE POLICY "authenticated_can_receive_broadcasts"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 2. Função de broadcast à prova de falha
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.broadcast_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM realtime.send(
      jsonb_build_object(
        'operation',  TG_OP,
        'table',      TG_TABLE_NAME,
        'record',     CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
        'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
      ),
      TG_OP,            -- event: 'INSERT' | 'UPDATE' | 'DELETE'
      'tasks-changes',  -- tópico único compartilhado por todos os usuários
      true              -- canal privado (exige usuário autenticado para receber)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Realtime NUNCA bloqueia a escrita: se o send falhar, ignoramos.
    NULL;
  END;
  RETURN NULL; -- AFTER trigger: retorno é ignorado
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Triggers (AFTER: só dispara depois da escrita já ter sido confirmada)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS broadcast_tasks_changes ON public.tasks;
CREATE TRIGGER broadcast_tasks_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_row_change();

DROP TRIGGER IF EXISTS broadcast_subtasks_changes ON public.subtasks;
CREATE TRIGGER broadcast_subtasks_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.subtasks
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_row_change();

DROP TRIGGER IF EXISTS broadcast_task_labels_changes ON public.task_labels;
CREATE TRIGGER broadcast_task_labels_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.task_labels
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_row_change();
