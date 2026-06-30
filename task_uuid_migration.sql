-- MIGRAÇÃO DE CHAVE PRIMÁRIA (TEXTO -> UUID)
-- AVISO: Execute isso no painel SQL do Supabase.

-- 1. Criar extensão para UUID se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Adicionar novas colunas UUID
ALTER TABLE public.tasks ADD COLUMN new_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE public.tasks ADD COLUMN new_parent_id UUID;
ALTER TABLE public.subtasks ADD COLUMN new_task_id UUID;
ALTER TABLE public.task_labels ADD COLUMN new_task_id UUID;

-- OBS: Se houver tabela notifications com FK para tasks, descomente as linhas abaixo:
-- ALTER TABLE public.notifications ADD COLUMN new_task_id UUID;

-- 3. Preencher os UUIDs usando mapeamento pelo ID atual
-- 3.1. Parent Task ID
UPDATE public.tasks t1
SET new_parent_id = t2.new_id
FROM public.tasks t2
WHERE t1.parent_task_id = t2.id;

-- 3.2. Subtasks
UPDATE public.subtasks s
SET new_task_id = t.new_id
FROM public.tasks t
WHERE s.task_id = t.id;

-- 3.3. Task Labels
UPDATE public.task_labels tl
SET new_task_id = t.new_id
FROM public.tasks t
WHERE tl.task_id = t.id;

-- 3.4. Notificações (se existir)
-- UPDATE public.notifications n
-- SET new_task_id = t.new_id
-- FROM public.tasks t
-- WHERE n.task_id = t.id;

-- 4. Remover constraints de chaves estrangeiras existentes
-- Atenção: O nome das constraints pode variar de acordo com como o Supabase gerou. Assumimos os nomes padrão.
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_parent_task_id_fkey;
ALTER TABLE public.subtasks DROP CONSTRAINT IF EXISTS subtasks_task_id_fkey;
ALTER TABLE public.task_labels DROP CONSTRAINT IF EXISTS task_labels_task_id_fkey;
-- ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_task_id_fkey;

-- Remover a chave primária da tabela tasks
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_pkey CASCADE;

-- 5. Renomear a coluna de ID antiga para task_code
ALTER TABLE public.tasks RENAME COLUMN id TO task_code;

-- 6. Renomear as novas colunas UUID para o nome original
ALTER TABLE public.tasks RENAME COLUMN new_id TO id;
ALTER TABLE public.tasks RENAME COLUMN new_parent_id TO parent_task_id;
ALTER TABLE public.subtasks RENAME COLUMN new_task_id TO task_id;
ALTER TABLE public.task_labels RENAME COLUMN new_task_id TO task_id;
-- ALTER TABLE public.notifications RENAME COLUMN new_task_id TO task_id;

-- 7. Recriar constraints de chave primária e estrangeira
ALTER TABLE public.tasks ADD PRIMARY KEY (id);

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.subtasks
  ADD CONSTRAINT subtasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.task_labels
  ADD CONSTRAINT task_labels_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- ALTER TABLE public.notifications
--   ADD CONSTRAINT notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- 8. Criar a Sequência para gerar os task_codes automaticamente
DO $$
DECLARE
    max_id integer;
BEGIN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(task_code, '\D', '', 'g'), '')::integer), 100)
    INTO max_id
    FROM public.tasks
    WHERE task_code LIKE 'TSK-%';

    EXECUTE 'CREATE SEQUENCE IF NOT EXISTS task_code_seq START WITH ' || (max_id + 1);
END $$;

-- 9. Criar trigger para auto-incrementar o task_code em novas tarefas
CREATE OR REPLACE FUNCTION set_task_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.task_code IS NULL OR NEW.task_code = '' THEN
        NEW.task_code := 'TSK-' || nextval('task_code_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_task_code ON public.tasks;
CREATE TRIGGER trigger_set_task_code
    BEFORE INSERT ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_task_code();

-- Fim da Migração
