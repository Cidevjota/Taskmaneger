-- Contador leve de anexos para a listagem de títulos/despesas.
-- A coluna `attachments` fica fora do SELECT da lista (linhas antigas guardam PDF em
-- base64 e estouram o tempo da query), então a tela não tinha como saber se um título
-- tem anexo. Esta coluna gerada resolve isso sem trafegar o conteúdo.
alter table public.sienge_titles
  add column if not exists attachments_count integer
  generated always as (
    case when jsonb_typeof(attachments) = 'array' then jsonb_array_length(attachments) else 0 end
  ) stored;
