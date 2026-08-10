-- Compare-and-swap da descrição via RPC: a base vai no corpo do POST, não na URL.
-- Sem isto, descrições grandes (ex.: imagem base64 embutida) estouravam o limite de
-- tamanho de URL do PostgREST no filtro .eq('description', base), o UPDATE casava 0
-- linhas e disparava um conflito falso que descartava o texto digitado.
create or replace function public.update_task_description_cas(
  p_task_id uuid,
  p_new_description text,
  p_base_description text,
  p_base_empty boolean
) returns boolean
language plpgsql
as $$
declare
  v_rows int;
begin
  update public.tasks
     set description = p_new_description
   where id = p_task_id
     and (
       (p_base_empty and (description is null or description = ''))
       or (not p_base_empty and description = p_base_description)
     );
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;
