-- =============================================================================
-- Migração: estende o Realtime via Broadcast para projects, labels e Sienge
-- -----------------------------------------------------------------------------
-- A Etapa anterior migrou tasks/subtasks/task_labels para Broadcast. Aqui fazemos
-- o mesmo para as tabelas que ainda dependiam do canal postgres_changes lotado
-- (que estava mudo). A função ganha um parâmetro de tópico (via TG_ARGV) para
-- publicar em tópicos por domínio, mantendo a mesma garantia de segurança
-- (SECURITY DEFINER + EXCEPTION: erro no realtime nunca bloqueia a escrita).
-- =============================================================================

-- Generaliza a função: topico vem do argumento do trigger; fallback 'tasks-changes'
-- para os triggers de tasks já existentes (que chamam sem argumento).
CREATE OR REPLACE FUNCTION public.broadcast_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topic text := COALESCE(TG_ARGV[0], 'tasks-changes');
BEGIN
  BEGIN
    PERFORM realtime.send(
      jsonb_build_object(
        'operation',  TG_OP,
        'table',      TG_TABLE_NAME,
        'record',     CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
        'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
      ),
      TG_OP,
      v_topic,
      true
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- realtime nunca bloqueia a escrita
  END;
  RETURN NULL;
END;
$$;

-- projects → tópico 'projects-changes'
DROP TRIGGER IF EXISTS broadcast_projects_changes ON public.projects;
CREATE TRIGGER broadcast_projects_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_row_change('projects-changes');

-- labels → tópico 'labels-changes'
DROP TRIGGER IF EXISTS broadcast_labels_changes ON public.labels;
CREATE TRIGGER broadcast_labels_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.labels
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_row_change('labels-changes');

-- Sienge (títulos, lotes, faturas) → tópico compartilhado 'sienge-changes'
DROP TRIGGER IF EXISTS broadcast_sienge_titles_changes ON public.sienge_titles;
CREATE TRIGGER broadcast_sienge_titles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.sienge_titles
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_row_change('sienge-changes');

DROP TRIGGER IF EXISTS broadcast_sienge_lotes_changes ON public.sienge_lotes;
CREATE TRIGGER broadcast_sienge_lotes_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.sienge_lotes
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_row_change('sienge-changes');

DROP TRIGGER IF EXISTS broadcast_sienge_faturas_changes ON public.sienge_faturas;
CREATE TRIGGER broadcast_sienge_faturas_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.sienge_faturas
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_row_change('sienge-changes');
